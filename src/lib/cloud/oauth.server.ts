// Google and GitHub sign-in (server-only).
// Callback paths: /google/callback, /github/callback.
// All callback URLs derive from AUTH_ORIGIN when set, so a domain change only
// needs one update here — provider dashboards keep the same stable origin.
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { d1 } from "./d1.server";
import { createUser, randomToken, startSession } from "./auth.server";
import { oauthLinkMustResetPassword } from "../../../security";
import { providerCallbackUrl, type OAuthProvider } from "./oauth-urls";

export type Provider = OAuthProvider;
const STATE_COOKIE = "vision_oauth_state";

type Creds = { id: string; secret: string };

const envCreds = (p: Provider): Creds | null => {
  const env: Record<Provider, [string | undefined, string | undefined]> = {
    google: [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET],
    github: [process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET],
  };
  const [id, secret] = env[p];
  return id && secret ? { id, secret } : null;
};

const label = (p: Provider) => (p === "google" ? "Google" : "GitHub");

const redirectUri = (req: Request, p: Provider) =>
  providerCallbackUrl(process.env.AUTH_ORIGIN || new URL(req.url).origin, p);
// Response.redirect() has immutable headers, which breaks the dev server's
// header merging ("TypeError: immutable") — build redirects manually instead.
const redirectTo = (url: string) => new Response(null, { status: 302, headers: { Location: url } });
const back = (req: Request, path: string) => redirectTo(new URL(path, req.url).toString());

export async function startOAuth(req: Request, p: Provider) {
  const c = envCreds(p);
  if (!c) return back(req, `/login?error=${encodeURIComponent(`${label(p)} sign-in isn't set up yet.`)}`);
  const state = randomToken(16);
  setCookie(STATE_COOKIE, `${p}:${state}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  const url = p === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", c.id);
  url.searchParams.set("redirect_uri", redirectUri(req, p));
  url.searchParams.set("state", state);
  if (p === "google") { url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "openid email profile"); url.searchParams.set("prompt", "select_account"); }
  else url.searchParams.set("scope", "read:user user:email");
  return redirectTo(url.toString());
}

async function profileFor(p: Provider, code: string, req: Request, c: Creds) {
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

export async function finishOAuth(req: Request, p: Provider) {
  const c = envCreds(p);
  const url = new URL(req.url);
  const saved = getCookie(STATE_COOKIE);
  deleteCookie(STATE_COOKIE, { path: "/" });
  const code = url.searchParams.get("code");
  if (!c || !code || !saved || saved !== `${p}:${url.searchParams.get("state")}`)
    return back(req, "/login?error=" + encodeURIComponent("Sign-in was cancelled or expired. Please try again."));
  try {
    const prof = await profileFor(p, code, req, c);
    let newAccount = false;
    let userId = (await d1<{ user_id: string }>("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?", [p, prof.id]))[0]?.user_id;
    if (!userId) {
      // Link to an existing account with the same verified email, or create one.
      const existing = (await d1<{ id: string; email_verified: number; password_hash: string | null }>("SELECT id, email_verified, password_hash FROM auth_users WHERE email = ?", [prof.email]))[0];
      userId = existing?.id;
      // Pre-hijack defense: an unverified password account was never proven to belong to this email's owner,
      // so its password (possibly set by someone else) is discarded and its other sessions revoked.
      if (existing && oauthLinkMustResetPassword(existing)) {
        await d1("UPDATE auth_users SET password_hash = NULL, salt = NULL WHERE id = ?", [existing.id]);
        await d1("DELETE FROM auth_sessions WHERE user_id = ?", [existing.id]);
      }
      if (!userId) {
        // New account via OAuth: same signup abuse policy as the email form.
        const S = await import("./security.server");
        const { evaluateSignup, recordAccountCreated } = await import("../../../security");
        const facts = S.factsFrom(req.headers, S.ensureDeviceId());
        const keys = await S.keysFor(facts, prof.email);
        const verdict = await evaluateSignup(S.d1Store, { entry: "oauth", email: prof.email, req: facts, keys });
        if (!verdict.allowed) return back(req, "/login?error=" + encodeURIComponent(verdict.userMessage ?? "Sign-up is temporarily unavailable."));
        userId = (await createUser(prof.email, { metadata: { full_name: prof.name, avatar_url: prof.avatar } })).id;
        await recordAccountCreated(S.d1Store, prof.email, keys);
        newAccount = true;
      }
      await d1("INSERT OR IGNORE INTO auth_identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)", [p, prof.id, userId]);
    }
    // Provider-verified email — no code needed.
    await d1("UPDATE auth_users SET email_verified = 1 WHERE id = ?", [userId]);
    const banned = (await d1<{ is_banned: number }>("SELECT is_banned FROM profiles WHERE id = ?", [userId]))[0]?.is_banned;
    if (banned) return back(req, "/login?error=" + encodeURIComponent("This account has been suspended."));
    if (newAccount) {
      const S = await import("./security.server");
      await S.grantWelcomeCredits(userId!, prof.email, S.factsFrom(req.headers, S.ensureDeviceId()));
    }
    await startSession(userId!);
    return back(req, "/app/new");
  } catch (e) {
    console.error("[oauth]", p, e);
    return back(req, "/login?error=" + encodeURIComponent("Sign-in failed. Please try again."));
  }
}
