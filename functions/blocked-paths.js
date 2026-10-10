/**
 * Internal paths that must 404.
 * functions/_middleware.ts uses isBlocked(). _routes.json include is ["/*"]
 * so percent-encoded requests still reach the middleware; exclude is only
 * the real site. Keep PUBLIC_EXCLUDES in sync with _routes.json.
 */

export const EXACT_PATHS = [
  "/DEPLOYMENT.md",
  "/marketing-truths.json",
  "/.secrets-baseline.json",
  "/.gitignore",
  "/.nojekyll",
  "/_routes.json",
  "/_redirects",
  "/_headers",
  "/README",
  "/README.md",
  "/package.json",
  "/package-lock.json",
  "/yarn.lock",
  "/pnpm-lock.yaml",
  "/wrangler.toml",
  "/wrangler.json",
  "/wrangler.jsonc",
];

export const PREFIXES = [
  "/docs",
  "/marketing-audits",
  "/tools",
  "/e2e",
  "/tests",
  "/scripts",
  "/.github",
  "/.git-hooks",
  "/.claude",
  "/.wrangler",
  "/.git",
  "/functions",
];

export const PUBLIC_EXCLUDES = [
  "/",
  "/index.html",
  "/404.html",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/google9896ae5a7c94f3f5.html",
  "/favicon.ico",
  "/css/*",
  "/js/*",
  "/images/*",
  "/pages/*",
  "/about",
  "/services",
  "/privacy",
  "/modular-compliance",
  "/blog/*",
];

/** Percent-decode until the path stops changing, then lower-case it. */
export function normalizePath(pathname) {
  let path = pathname || "/";
  for (let i = 0; i < 5; i++) {
    let decoded;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      break;
    }
    if (decoded === path) break;
    path = decoded;
  }
  path = path.toLowerCase();
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function isBlocked(pathname) {
  const path = normalizePath(pathname);
  if (EXACT_PATHS.some((item) => item.toLowerCase() === path)) return true;
  return PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
