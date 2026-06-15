// Unit tests for the Cloudflare Pages Function POST /api/contact.
//
// These exercise the function's real behaviour in isolation: JSON parsing,
// honeypot handling, field validation, email/length checks, env-config
// gating, response shaping, and the Resend upstream call (mocked).
//
// The function is plain logic over the Fetch API (Request/Response), which is
// available natively in Node 22 / the vitest runtime — no Cloudflare runtime
// is required. We import the TS source directly; vitest/esbuild erases the
// `PagesFunction<Env>` type annotation, so the absence of @cloudflare/workers-types
// at runtime is harmless.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost, onRequestOptions, onRequest } from "./contact";

// Minimal stand-in for the Cloudflare Pages handler context. Only `request`
// and `env` are read by the function under test.
function makeCtx(body: unknown, env: Record<string, unknown> = {}) {
  const request =
    typeof body === "string"
      ? new Request("https://instilligent.com/api/contact", { method: "POST", body })
      : new Request("https://instilligent.com/api/contact", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        });
  // The handler signature is destructured { request, env }; extra fields are unused.
  return { request, env } as never;
}

const validPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  interest: "Modular Compliance",
  message: "I would like a demo.",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("onRequestPost — body parsing", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await onRequestPost(makeCtx("not-json{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("responds with JSON content-type", async () => {
    const res = await onRequestPost(makeCtx("not-json{"));
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });
});

describe("onRequestPost — honeypot", () => {
  it("silently succeeds (200 ok) when the honeypot field is filled, without sending mail", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(
      makeCtx(
        { ...validPayload, website: "http://spam.example" },
        { RESEND_API_KEY: "re_test" },
      ),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // The honeypot short-circuits before any upstream send.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only honeypot as empty (not a bot)", async () => {
    // website is trimmed; "   " -> "" -> falsy, so it should NOT short-circuit.
    // With no API key configured it should fall through to the 503 config gate,
    // proving the honeypot branch was not taken.
    const res = await onRequestPost(makeCtx({ ...validPayload, website: "   " }, {}));
    expect(res.status).toBe(503);
  });
});

describe("onRequestPost — required field validation", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["missing name", { email: "a@b.co", message: "hi" }],
    ["blank name (whitespace)", { name: "   ", email: "a@b.co", message: "hi" }],
    ["missing email", { name: "A", message: "hi" }],
    ["missing message", { name: "A", email: "a@b.co" }],
    ["all missing", {}],
    ["non-string name is ignored -> treated as missing", { name: 123, email: "a@b.co", message: "hi" }],
  ];

  for (const [label, payload] of cases) {
    it(`returns 400 for ${label}`, async () => {
      const res = await onRequestPost(makeCtx(payload, { RESEND_API_KEY: "re_test" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "name, email, and message are required" });
    });
  }
});

describe("onRequestPost — email validation", () => {
  const bad = ["plainaddress", "no-at-sign.com", "two@@at.com", "spaces in@email.com", "missing@domain", "@nolocal.com"];
  for (const email of bad) {
    it(`rejects invalid email: ${JSON.stringify(email)}`, async () => {
      const res = await onRequestPost(
        makeCtx({ name: "A", email, message: "hi" }, { RESEND_API_KEY: "re_test" }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid email" });
    });
  }

  it("accepts a well-formed email (reaches the upstream send)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(makeCtx(validPayload, { RESEND_API_KEY: "re_test" }));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("onRequestPost — length limits", () => {
  const tooLong: Array<[string, Record<string, unknown>]> = [
    ["name > 200", { name: "x".repeat(201), email: "a@b.co", message: "hi" }],
    ["email > 320", { name: "A", email: "x".repeat(320) + "@b.co", message: "hi" }],
    ["interest > 200", { name: "A", email: "a@b.co", interest: "y".repeat(201), message: "hi" }],
    ["message > 5000", { name: "A", email: "a@b.co", message: "z".repeat(5001) }],
  ];
  for (const [label, payload] of tooLong) {
    it(`returns 400 for ${label}`, async () => {
      const res = await onRequestPost(makeCtx(payload, { RESEND_API_KEY: "re_test" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "field too long" });
    });
  }

  it("accepts values exactly at the boundary (length === limit)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(
      makeCtx(
        { name: "n".repeat(200), email: "a@b.co", interest: "i".repeat(200), message: "m".repeat(5000) },
        { RESEND_API_KEY: "re_test" },
      ),
    );
    expect(res.status).toBe(200);
  });
});

describe("onRequestPost — service configuration gate", () => {
  it("returns 503 when RESEND_API_KEY is absent", async () => {
    const res = await onRequestPost(makeCtx(validPayload, {}));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "contact service is not configured" });
  });
});

describe("onRequestPost — Resend upstream call", () => {
  it("sends a correctly-shaped Resend request with defaults and returns 200", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(makeCtx(validPayload, { RESEND_API_KEY: "re_secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_secret");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const sent = JSON.parse(init.body);
    expect(sent.from).toBe("Instilligent Contact <noreply@instilligent.com>");
    expect(sent.to).toEqual(["marc@instilligent.com"]);
    expect(sent.reply_to).toBe("ada@example.com");
    expect(sent.subject).toBe("Website Enquiry: Modular Compliance");
    expect(sent.text).toContain("Name: Ada Lovelace");
    expect(sent.text).toContain("Email: ada@example.com");
    expect(sent.text).toContain("Interest: Modular Compliance");
    expect(sent.text).toContain("I would like a demo.");
  });

  it("honors CONTACT_TO and CONTACT_FROM env overrides", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await onRequestPost(
      makeCtx(validPayload, {
        RESEND_API_KEY: "re_secret",
        CONTACT_TO: "sales@instilligent.com",
        CONTACT_FROM: "Sales <sales@instilligent.com>",
      }),
    );

    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.to).toEqual(["sales@instilligent.com"]);
    expect(sent.from).toBe("Sales <sales@instilligent.com>");
  });

  it("uses subject 'General' and '(not specified)' when interest is omitted", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { interest, ...noInterest } = validPayload;
    await onRequestPost(makeCtx(noInterest, { RESEND_API_KEY: "re_secret" }));

    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.subject).toBe("Website Enquiry: General");
    expect(sent.text).toContain("Interest: (not specified)");
  });

  it("returns 502 when Resend responds non-ok, including upstream status + truncated detail", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("e".repeat(500), { status: 422 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(makeCtx(validPayload, { RESEND_API_KEY: "re_secret" }));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string; status: number; detail: string };
    expect(json.error).toBe("send failed");
    expect(json.status).toBe(422);
    expect(json.detail.length).toBe(300); // detail truncated to 300 chars
  });

  it("returns 502 when the fetch itself throws (network error), with truncated detail", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("ECONNRESET boom"));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await onRequestPost(makeCtx(validPayload, { RESEND_API_KEY: "re_secret" }));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string; detail: string };
    expect(json.error).toBe("upstream send failed");
    expect(json.detail).toContain("ECONNRESET boom");
    expect(json.detail.length).toBeLessThanOrEqual(200);
  });
});

describe("onRequestOptions — CORS preflight", () => {
  it("returns 204 with the documented CORS headers", async () => {
    const res = await onRequestOptions({} as never);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});

describe("onRequest — fallback for other methods", () => {
  it("returns 405 Method Not Allowed with an Allow header", async () => {
    const res = await onRequest({} as never);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(await res.text()).toBe("Method Not Allowed");
  });
});
