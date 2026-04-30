// Cloudflare Pages Function — POST /api/contact
//
// Replaces the previous mailto: handler (js/main.js) with a real backend.
// Receives the contact form payload, validates it, and forwards to
// marc@instilligent.com via the Resend API.
//
// 2026-04-30 — added as part of the marketing-truth recall (PR B).
// Marc reported the mailto: form failed silently for users without a
// configured default mail client. Per the audit-before-copy directive,
// any "submit" affordance on a public site must actually deliver — UI
// affordance without delivery is UX deception.
//
// REQUIRED CLOUDFLARE PAGES ENV VARS:
//   RESEND_API_KEY  — same Resend key as Modular Compliance.
//                     Configure in Pages dashboard:
//                     instilligent-website → Settings → Environment
//                     variables → Production. (Encrypted)
//
// OPTIONAL ENV VARS:
//   CONTACT_TO      — recipient address (default: marc@instilligent.com)
//   CONTACT_FROM    — from header        (default: Instilligent Contact
//                                          <noreply@instilligent.com>)
//                     The from address must be on a domain verified in
//                     the Resend account. instilligent.com should already
//                     be verified there since MC uses it.

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  interest?: unknown;
  message?: unknown;
  // Honeypot — bots fill it, humans don't see it.
  website?: unknown;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const isString = (v: unknown): v is string => typeof v === "string";
const trim = (v: unknown): string => (isString(v) ? v.trim() : "");

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // Honeypot — silently succeed on bot submissions.
  if (trim(payload.website)) {
    return json(200, { ok: true });
  }

  const name = trim(payload.name);
  const email = trim(payload.email);
  const interest = trim(payload.interest);
  const message = trim(payload.message);

  if (!name || !email || !message) {
    return json(400, { error: "name, email, and message are required" });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { error: "invalid email" });
  }
  if (name.length > 200 || email.length > 320 || interest.length > 200 || message.length > 5000) {
    return json(400, { error: "field too long" });
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Service not configured — be explicit so the site owner notices in logs.
    return json(503, { error: "contact service is not configured" });
  }

  const to = env.CONTACT_TO || "marc@instilligent.com";
  const from = env.CONTACT_FROM || "Instilligent Contact <noreply@instilligent.com>";

  const subject = `Website Enquiry: ${interest || "General"}`;
  const body =
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Interest: ${interest || "(not specified)"}\n` +
    `\n` +
    `Message:\n${message}\n` +
    `\n` +
    `--\n` +
    `Sent from instilligent.com contact form.\n` +
    `Reply directly to this message — replies route to ${email}.`;

  let resendResp: Response;
  try {
    resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        text: body,
      }),
    });
  } catch (err) {
    return json(502, { error: "upstream send failed", detail: String(err).slice(0, 200) });
  }

  if (!resendResp.ok) {
    const detail = await resendResp.text().catch(() => "");
    return json(502, {
      error: "send failed",
      status: resendResp.status,
      detail: detail.slice(0, 300),
    });
  }

  return json(200, { ok: true });
};

// CORS preflight (in case the form ever submits cross-origin).
export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });

// Reject other methods (GET etc.) so this endpoint can't be probed for info.
export const onRequest: PagesFunction = async () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
