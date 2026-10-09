// Server-only access to the Vision database on Cloudflare D1 (via the Cloudflare API).
const DATABASE_ID = "60c2e0fe-89c3-4a68-a723-be5bc4e8e4f8";

export async function d1<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  if (!account || !token) throw new Error("Database is not configured");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    console.error("[d1] query failed", res.status, JSON.stringify(body?.errors ?? body));
    throw new Error("Database request failed");
  }
  return (body.result?.[0]?.results ?? []) as T[];
}
