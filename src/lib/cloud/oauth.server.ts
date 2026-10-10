// Google, GitHub and Cloudflare (Zero Trust Access OIDC) sign-in (server-only).
// Callback paths: /google/callback, /github/callback, /cloudflare/callback.
// All callback URLs derive from AUTH_ORIGIN when set, so a domain change only
// needs one update here — provider dashboards keep the same stable origin.
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { d1 } from "./d1.server";
import { createUser, randomToken, startSession } from "./auth.server";
import { providerCallbackUrl, type OAuthProvider } from "./oauth-urls";

export type Provider = "google" | "github" | "cloudflare";
const STATE_COOKIE = "vision_oauth_state";

const cfg = (p: Provider) => {
  const env: Record<Provider, [string | undefined, string | undefined]> = {
    google: [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET],
    github: [process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET],
    cloudflare: [process.env.CLOUDFLARE_ACCESS_CLIENT_ID, process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET],
  };
  const [id, secret] = env[p];
  return id && secret ? { id, secret } : null;
};

const label = (p: Provider) => (p === "google" ? "Google" : p === "github" ? "GitHub" : "Cloudflare");

export const providerCallbackUrl = (base: string, p: Provider) => `${base.replace(/\/+$/, "")}/${p}/callback`;
const redirectUri = (req: Request, p: Provider) =>
  providerCallbackUrl(process.env.AUTH_ORIGIN || new URL(req.url).origin, p);
const back = (req: Request, path: string) => Response.redirect(new URL(path, req.url).toString(), 302);

const normalizeTeamDomain = (raw: string | undefined) => {
  if (!raw) return null;
  const host = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host ? `https://${host}` : null;
};

export function startOAuth(req: Request, p: Provider) {
  const c = cfg(p);
  if (!c) return back(req, `/login?error=${encodeURIComponent(`${label(p)} sign-in isn't set up yet.`)}`);
  if (p === "cloudflare" && !normalizeTeamDomain(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN))
    return back(req, `/login?error=${encodeURIComponent("Cloudflare sign-in isn't set up yet.")}`);
  const state = randomToken(16);
  setCookie(STATE_COOKIE, `${p}:${state}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  const url = p === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : p === "github"
    ? new URL("https://github.com/login/oauth/authorize")
    : new URL(`${normalizeTeamDomain(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN)}/cdn-cgi/access/oauth/authorize`);
  url.searchParams.set("client_id", c.id);
  url.searchParams.set("redirect_uri", redirectUri(req, p));
  url.searchParams.set("state", state);
  if (p === "google") { url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "openid email profile"); url.searchParams.set("prompt", "select_account"); }
  else if (p === "github") url.searchParams.set("scope", "read:user user:email");
  else { url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "openid email profile"); }
  return Response.redirect(url.toString(), 302);
}

const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
const jsonB64url = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// Verify a Cloudflare Access id_token: RS256 signature via the team JWKS,
// audience matches this SaaS app's client id, and it hasn't expired.
async function verifyAccessIdToken(idToken: string, jwksUri: string, clientId: string) {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) throw new Error("token shape");
  const header: any = jsonB64url(h);
  if (header.alg !== "RS256") throw new Error("unsupported algorithm");
  const jwks: any = await (await fetch(jwksUri)).json();
  const key = (jwks.keys as any[]).find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (!key) throw new Error("signing key");
  const cryptoKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, cryptoKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error("bad signature");
  const claims: any = jsonB64url(p);
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) throw new Error("expired token");
  const audOk = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  if (!audOk) throw new Error("audience mismatch");
  return claims;
}

async function profileFor(p: Provider, code: string, req: Request, c: { id: string; secret: string }) {
  if (p === "google") {
    const t: any = await (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri(req, p), grant_type: "authorization_code" }),
    })).json();
    if (!t.access_token) throw new Error("token");
    const u: any = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    if (!u.sub || !u.email || !u.email_verified) throw new Error("email");
    return { id: String(u.sub), email: String(u.email).toLowerCase(), name: u.name ?? null, avatar: u.picture ?? null };
  }
  if (p === "github") {
    const t: any = await (await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: c.id, client_secret: c.secret, code, redirect_uri: redirectUri(req, p) }),
    })).json();
    if (!t.access_token) throw new Error("token");
    const h = { Authorization: `Bearer ${t.access_token}`, "User-Agent": "Vision", Accept: "application/vnd.github+json" };
    const u: any = await (await fetch("https://api.github.com/user", { headers: h })).json();
    const emails: any[] = await (await fetch("https://api.github.com/user/emails", { headers: h })).json();
    const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
    if (!u.id || !primary?.email) throw new Error("email");
    return { id: String(u.id), email: String(primary.email).toLowerCase(), name: u.name ?? u.login ?? null, avatar: u.avatar_url ?? null };
  }
  // Cloudflare Access (Zero Trust SaaS OIDC application).
  const team = normalizeTeamDomain(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN)!;
  const discovery: any = await fetch(`${team}/cdn-cgi/access/.well-known/openid-configuration`).then((r) => r.json());
  const tokenEndpoint: string = discovery.token_endpoint ?? `${team}/cdn-cgi/access/oauth/token`;
  const jwksUri: string = discovery.jwks_uri ?? `${team}/cdn-cgi/access/certs`;
  const t: any = await (await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri(req, p), grant_type: "authorization_code" }),
  })).json();
  if (!t.id_token) throw new Error("token");
  const claims = await verifyAccessIdToken(t.id_token, jwksUri, c.id);
  if (!claims.email) throw new Error("email");
  return { id: String(claims.sub), email: String(claims.email).toLowerCase(), name: claims.name ?? claims.preferred_username ?? null, avatar: claims.picture ?? null };
}

export async function finishOAuth(req: Request, p: Provider) {
  const c = cfg(p);
  const url = new URL(req.url);
  const saved = getCookie(STATE_COOKIE);
  deleteCookie(STATE_COOKIE, { path: "/" });
  const code = url.searchParams.get("code");
  if (!c || !code || !saved || saved !== `${p}:${url.searchParams.get("state")}`)
    return back(req, "/login?error=" + encodeURIComponent("Sign-in was cancelled or expired. Please try again."));
  try {
    const prof = await profileFor(p, code, req, c);
    let userId = (await d1<{ user_id: string }>("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?", [p, prof.id]))[0]?.user_id;
    if (!userId) {
      // Link to an existing account with the same verified email, or create one.
      userId = (await d1<{ id: string }>("SELECT id FROM auth_users WHERE email = ?", [prof.email]))[0]?.id;
      if (!userId) userId = (await createUser(prof.email, { metadata: { full_name: prof.name, avatar_url: prof.avatar } })).id;
      await d1("INSERT OR IGNORE INTO auth_identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)", [p, prof.id, userId]);
    }
    const banned = (await d1<{ is_banned: number }>("SELECT is_banned FROM profiles WHERE id = ?", [userId]))[0]?.is_banned;
    if (banned) return back(req, "/login?error=" + encodeURIComponent("This account has been suspended."));
    await startSession(userId!);
    return back(req, "/app/new");
  } catch (e) {
    console.error("[oauth]", p, e);
    return back(req, "/login?error=" + encodeURIComponent("Sign-in failed. Please try again."));
  }
}
