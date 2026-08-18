export const ALLOWED_ORIGINS = new Set([
  "https://www.onefind.com.br",
  "https://onefind.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    allowed: !origin || ALLOWED_ORIGINS.has(origin),
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
        ? origin
        : "https://www.onefind.com.br",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  };
}
