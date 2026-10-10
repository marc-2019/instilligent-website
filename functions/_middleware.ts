// Real 404s for repo files that sit in the Pages publish root.
//
// _routes.json include is ["/*"] with excludes only for site assets and
// pages. An include list of the literal blocked paths lets percent-encoded
// requests skip the middleware and return 200. Decoding happens here, after
// the request has already been routed.
import { isBlocked } from "./blocked-paths.js";

interface Env {
  ASSETS: { fetch: (input: Request | string) => Promise<Response> };
}

export const onRequest: PagesFunction<Env> = async ({ request, next, env }) => {
  const { pathname } = new URL(request.url);
  if (!isBlocked(pathname)) return next();

  let body = "Not found\n";
  let type = "text/plain; charset=utf-8";
  try {
    const page = await env.ASSETS.fetch(new URL("/404.html", request.url).toString());
    if (page.ok) {
      body = await page.text();
      type = "text/html; charset=utf-8";
    }
  } catch {
    // Plain-text 404 if the asset fetch fails.
  }
  return new Response(body, {
    status: 404,
    headers: {
      "content-type": type,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
};
