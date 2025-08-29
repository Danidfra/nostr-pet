const BACKEND =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://blobbi-backend-production.up.railway.app";

export function apiUrl(path: string): string {
  if (!BACKEND) throw new Error("BACKEND URL is not set");
  return `${BACKEND}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(apiUrl(path));
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return (await r.json()) as T;
}

export async function apiPost<TResponse = unknown, TBody = unknown>(
  path: string,
  body: TBody
): Promise<TResponse> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} failed: ${r.status}`);
  return (await r.json()) as TResponse;
}