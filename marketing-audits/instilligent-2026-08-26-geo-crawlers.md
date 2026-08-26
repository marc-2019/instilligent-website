# Marketing audit — instilligent.com GEO crawler, OG, NZBN

**Date:** 2026-08-26  
**Surface:** `instilligent-website` on branch `fix/geo-ai-crawlers-2026-08-26` from `main`  
**Trigger:** Live `llms.txt` still showed NZBN **9429051796284**. Homepage footer on `main` already had **9429041896853**. OG image URL 200’d as HTML (file missing). Partial OG tags.  
**Do not mix** with dirty `feat/ga4-portfolio-2026-05-17` worktree.

## Claims

| Claim | Surface | Verdict | Evidence |
|-------|---------|---------|----------|
| Instilligent Limited NZBN 9429041896853 | `llms.txt`, privacy, about, services, OG image, Organization JSON-LD, marketing-truths `instilligent.legal.nzbn` | IMPLEMENTED | Certificate of Incorporation / MC 2026-08-21 audit. Replaced remaining `9429051796284` on `main`. |
| Privacy policy written in accordance with Privacy Act 2020 | `pages/privacy.html` meta description | IMPLEMENTED | Replaced banned “Compliant with” (eye-pair HOLD 2026-08-26). |
| og:site_name Instilligent + 1200×630 PNG | `index.html`, `images/og-image.png` | IMPLEMENTED | Generated locally (Ubuntu font, brand purple `#6B21A8` on `#111827`). No new product claims. |
| Citation crawlers allowed; ClaudeBot training-blocked | `robots.txt` | IMPLEMENTED (origin) | Same split as modularcompliance.com. Live file still has Cloudflare prepend until Marc dashboard click. |

## Deploy

Cloudflare Pages production branch is **`main`**. This work is on `fix/geo-ai-crawlers-2026-08-26` from `main`. Do not push the GA4 feature branch.

## Marc

Ship this branch to `main` after four-eyes, then AI Crawl Control on the instilligent.com zone (same allow/block list as the MC audit).
