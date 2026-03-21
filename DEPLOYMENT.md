# Instilligent Website - Deployment & DNS Migration Guide

## Architecture Decision

**Old**: Simvoly website builder → DNS Made Easy → 52.2.101.114 (Simvoly server)
**New**: Static HTML/CSS/JS → Cloudflare Pages → Cloudflare DNS

### Why This Change
- Full control over code and design
- Free hosting (Cloudflare Pages: unlimited bandwidth, global CDN, auto SSL)
- Free DNS (Cloudflare DNS)
- Fixes api.instilligent.com SSL issue (currently resolves to Simvoly wildcard)
- Faster iteration (I can update the site in any Claude session)
- Saves Simvoly subscription cost ($12+/month)

---

## Step 1: Deploy to Cloudflare Pages

### Option A: Direct Upload (Fastest)
1. Log into Cloudflare Dashboard → Pages
2. Create a project → Upload assets
3. Upload the entire `instilligent-website/` folder
4. Name: `instilligent`
5. It will deploy to `instilligent.pages.dev`

### Option B: GitHub (Recommended for ongoing updates)
1. Create a GitHub repo: `instilligent-website`
2. Push this folder to main branch
3. Cloudflare Dashboard → Pages → Create project → Connect to Git
4. Select the repo, branch: `main`
5. Build settings: None needed (static site)
6. Deploy

---

## Step 2: Verify Pages Deployment

Visit `instilligent.pages.dev` (or whatever Cloudflare assigns) and confirm:
- [ ] Home page loads correctly
- [ ] Modular Compliance page works
- [ ] Services page works
- [ ] Navigation between pages works
- [ ] Mobile responsive
- [ ] Contact form mailto works
- [ ] All icons render (Lucide)

---

## Step 3: Add Custom Domain

In Cloudflare Pages project settings:
1. Custom domains → Add domain
2. Enter: `instilligent.com`
3. Also add: `www.instilligent.com`
4. Cloudflare will prompt you to move DNS if not already on Cloudflare

---

## Step 4: Migrate DNS to Cloudflare

### Current DNS Records (DNS Made Easy)
| Type  | Name | Value | Notes |
|-------|------|-------|-------|
| A     | @    | 52.2.101.114 | Simvoly - REMOVE |
| A     | www  | 52.2.101.114 | Simvoly - REMOVE |
| A     | *    | 52.2.101.114 | Simvoly wildcard - REMOVE |
| CNAME | api  | (should point to Railway) | FIX - currently broken |

### New DNS Records (Cloudflare)
| Type  | Name | Value | Proxy | Notes |
|-------|------|-------|-------|-------|
| CNAME | @    | instilligent.pages.dev | ✅ | Cloudflare Pages |
| CNAME | www  | instilligent.pages.dev | ✅ | Redirect to root |
| CNAME | api  | trademate-nz-production.up.railway.app | ✅ | BossBoard API |
| CNAME | cortex | [tunnel-id].cfargotunnel.com | ✅ | CortexForge tunnel |
| TXT   | _railway | [Railway verification] | - | Keep if exists |
| MX    | @    | [Keep existing MX records] | - | Email |

### Migration Steps
1. **Add domain to Cloudflare**: Dashboard → Add a site → `instilligent.com` → Free plan
2. **Cloudflare auto-imports records**: Review them carefully
3. **Fix records**: Remove Simvoly A records, add Pages CNAME, fix api CNAME
4. **Change nameservers at registrar**: Cloudflare will show you two nameservers
5. **Update at domain registrar**: Replace DNS Made Easy nameservers with Cloudflare's
6. **Wait**: Propagation takes 2-4 hours (max 24)
7. **Verify**: Check instilligent.com loads from Pages

### CRITICAL: Preserve These Records
- Any MX records (email routing)
- The `cortex` subdomain CNAME (CortexForge tunnel)
- Any Railway TXT verification records
- SPF/DKIM records if present

### Things That Will Break During Migration
- **Brief downtime** (2-4 hours while nameservers propagate)
- **api.instilligent.com** - will actually get FIXED (currently broken anyway)
- **Simvoly site** - will stop working (this is intended)

---

## Step 5: Post-Migration Verification

- [ ] instilligent.com loads the new site
- [ ] www.instilligent.com redirects to instilligent.com
- [ ] api.instilligent.com points to Railway (BossBoard)
- [ ] cortex.instilligent.com tunnel still works
- [ ] SSL certificates active on all subdomains
- [ ] Email still works (MX records intact)

---

## Step 6: Cancel Simvoly

Once everything is confirmed working (give it 48 hours):
1. Log into Simvoly
2. Cancel the subscription
3. No need to delete the old site - it just won't be reachable

---

## File Structure

```
instilligent-website/
├── index.html                    # Home page
├── css/
│   └── style.css                 # All styles
├── js/
│   └── main.js                   # Navigation, animations, form
├── images/
│   └── favicon.svg               # Purple "I" favicon
├── pages/
│   ├── modular-compliance.html   # Product page
│   └── services.html             # Services page
├── _redirects                    # Cloudflare Pages URL redirects
├── _headers                      # Security headers & caching
└── DEPLOYMENT.md                 # This file
```

## Future Enhancements
- Contact form via Cloudflare Workers (replace mailto)
- Blog/News section
- Product-specific subdomains (mc.instilligent.com)
- Analytics (Cloudflare Web Analytics - free, privacy-friendly)
- OG images for social sharing
