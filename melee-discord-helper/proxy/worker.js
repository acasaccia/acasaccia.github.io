// Cloudflare Worker: minimal CORS proxy for the Melee.gg API.
//
// melee.gg does not send CORS headers, so the static page cannot call it
// directly. This worker forwards the few read-only endpoints the page needs.
// It holds no secrets and logs nothing: the user's credentials arrive in the
// Authorization header and are passed through to melee.gg as-is.

const ALLOWED_ORIGINS = [
  "https://acasaccia.github.io",
  // Local development (any port)
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

// Only these read-only endpoints are forwarded
const ALLOWED_PATHS =
  /^\/api\/(player\/list|match\/list\/current|tournament|standing\/list\/current)\/[\w-]+$/;

function isAllowedOrigin(origin) {
  return (
    origin !== null &&
    ALLOWED_ORIGINS.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin),
    )
  );
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");

    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Accept",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const { pathname } = new URL(request.url);
    if (!ALLOWED_PATHS.test(pathname)) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return new Response("Missing credentials", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const upstream = await fetch(`https://melee.gg${pathname}`, {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
};
