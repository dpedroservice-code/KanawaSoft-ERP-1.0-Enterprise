const CONFIG_PATH = "/runtime-config.js";

function buildRuntimeConfig(env) {
  const isProduction = env.KANAWA_ENV === "production";
  const url = isProduction && typeof env.KANAWA_SUPABASE_URL === "string"
    ? env.KANAWA_SUPABASE_URL.trim()
    : "";
  const publishableKey = isProduction && typeof env.KANAWA_SUPABASE_PUBLISHABLE_KEY === "string"
    ? env.KANAWA_SUPABASE_PUBLISHABLE_KEY.trim()
    : "";
  const enabled = isProduction && Boolean(url && publishableKey);

  const config = {
    enabled,
    url: enabled ? url : "",
    publishableKey: enabled ? publishableKey : ""
  };

  return [
    "window.KANAWA_SUPABASE_CONFIG = Object.freeze(" + JSON.stringify(config) + ");",
    "window.KANAWA_PREVIEW_DEMO = " + String(!isProduction) + ";",
    "window.KANAWA_PREVIEW_READ_ONLY = " + String(!enabled) + ";",
    ""
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === CONFIG_PATH) {
      const body = buildRuntimeConfig(env);
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          "Pragma": "no-cache",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
