import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AuthResult = { user: any | null; error: string | null };

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCaller } = await import("./auth.server");
  const c = await getCaller();
  return { user: c?.user ?? null, isAdmin: c?.isAdmin ?? false };
});

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; fullName?: string }) => d)
  .handler(async ({ data }): Promise<AuthResult> => {
    const a = await import("./auth.server");
    const { d1 } = await import("./d1.server");
    const email = String(data.email ?? "").trim().toLowerCase();
    const password = String(data.password ?? "");
    if (!EMAIL.test(email) || email.length > 254) return { user: null, error: "Enter a valid email address." };
    if (password.length < 8 || password.length > 128) return { user: null, error: "Password must be 8–128 characters." };
    try { await a.rateLimit(`signup:${email}`, 5, 900); } catch (e: any) { return { user: null, error: e.message }; }
    const exists = await d1("SELECT id FROM auth_users WHERE email = ?", [email]);
    if (exists[0]) return { user: null, error: "An account with this email already exists." };
    const fullName = String(data.fullName ?? "").trim().slice(0, 100);
    const row = await a.createUser(email, { password, metadata: fullName ? { full_name: fullName } : {} });
    await a.startSession(row.id);
    return { user: a.toPublicUser(row), error: null };
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }): Promise<AuthResult> => {
    const a = await import("./auth.server");
    const { d1 } = await import("./d1.server");
    const email = String(data.email ?? "").trim().toLowerCase();
    try { await a.rateLimit(`signin:${email}`, 10, 900); } catch (e: any) { return { user: null, error: e.message }; }
    const row: any = (await d1("SELECT u.*, p.is_banned FROM auth_users u LEFT JOIN profiles p ON p.id = u.id WHERE u.email = ?", [email]))[0];
    const ok = row?.password_hash && (await a.verifyPassword(String(data.password ?? ""), row.salt, row.password_hash));
    if (!ok) return { user: null, error: "Invalid email or password." };
    if (row.is_banned) return { user: null, error: "This account has been suspended." };
    await a.startSession(row.id);
    return { user: a.toPublicUser(row), error: null };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./auth.server");
  await endSession();
  return { ok: true };
});

export const updateUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; currentPassword?: string; data?: Record<string, any> }) => d)
  .handler(async ({ data }): Promise<AuthResult> => {
    const a = await import("./auth.server");
    const { d1 } = await import("./d1.server");
    const c = await a.getCaller();
    if (!c) return { user: null, error: "Please sign in to continue." };
    const row: any = (await d1("SELECT * FROM auth_users WHERE id = ?", [c.user.id]))[0];
    if (data.password !== undefined) {
      if (data.password.length < 8 || data.password.length > 128) return { user: null, error: "Password must be 8–128 characters." };
      if (row.password_hash && !(data.currentPassword && (await a.verifyPassword(data.currentPassword, row.salt, row.password_hash))))
        return { user: null, error: "Your current password is incorrect." };
      const salt = a.randomToken(16);
      await d1("UPDATE auth_users SET password_hash = ?, salt = ? WHERE id = ?", [await a.hashPassword(data.password, salt), salt, c.user.id]);
      // Sign out other devices after a password change.
      await d1("DELETE FROM auth_sessions WHERE user_id = ?", [c.user.id]);
      await a.startSession(c.user.id);
    }
    if (data.data && typeof data.data === "object") {
      const allowed: Record<string, any> = {};
      for (const k of ["full_name", "avatar_url"]) if (k in data.data) allowed[k] = String(data.data[k] ?? "").slice(0, 500);
      let meta: Record<string, any> = {};
      try { meta = JSON.parse(row.user_metadata || "{}"); } catch { /* ignore */ }
      await d1("UPDATE auth_users SET user_metadata = ? WHERE id = ?", [JSON.stringify({ ...meta, ...allowed }), c.user.id]);
    }
    const fresh = (await d1("SELECT * FROM auth_users WHERE id = ?", [c.user.id]))[0];
    return { user: a.toPublicUser(fresh), error: null };
  });
