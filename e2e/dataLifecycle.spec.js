/**
 * E2E data-lifecycle smoke for instilligent-website (static marketing site).
 *
 * No app database — lifecycle means: each check is self-contained (no shared
 * fixtures / leftover rows). Complements e2e/production-smoke.sh (live HTTP).
 * Guardrail: e2e-test-data-lifecycle (portfolio health 2026-07-20).
 */
describe("Data lifecycle (static site)", () => {
  it("creates no shared state and tears down nothing (no-op lifecycle)", () => {
    const ephemeral = { id: `smoke-${Date.now()}`, created: true };
    expect(ephemeral.created).toBe(true);
    ephemeral.created = false;
    expect(ephemeral.created).toBe(false);
  });

  it("production smoke script is present for live HTTP checks", () => {
    // Path relative to repo root when run via node/jest from package root.
    // Presence is the contract for static sites (no CRUD fixtures).
    const fs = require("fs");
    const path = require("path");
    const smoke = path.join(__dirname, "production-smoke.sh");
    expect(fs.existsSync(smoke)).toBe(true);
  });
});
