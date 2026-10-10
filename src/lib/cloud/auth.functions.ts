import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AuthResult = { user: any | null; error: string | null; needsVerification?: boolean };

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
    try {
      const { sendOtp } = await import("./otp.server");
      await sendOtp(email);
    } catch (e) {
      console.error("[signup] otp send failed", e);
      return { user: null, error: "Account created, but we couldn't send the verification email. Please try signing in to resend it." };
    }
    // Session starts only after the email code is verified.
    return { user: null, error: null, needsVerification: true };
  });

export const verifyEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; code: string }) => d)
  .handler(async ({ data }): Promise<AuthResult> => {
    const a = await import("./auth.server");
    const { d1 } = await import("./d1.server");
    const email = String(data.email ?? "").trim().toLowerCase();
    const code = String(data.code ?? "").trim();
    if (!EMAIL.test(email) || !/^\d{8}$/.test(code)) return { user: null, error: "Enter the 8-digit code from your email." };
    try { await a.rateLimit(`verify:${email}`, 10, 900); } catch (e: any) { return { user: null, error: e.message }; }
    const { checkOtp } = await import("./otp.server");
    if (!(await checkOtp(email, code))) return { user: null, error: "That code is incorrect or expired." };
    const row: any = (await d1("SELECT * FROM auth_users WHERE email = ?", [email]))[0];
    if (!row) return { user: null, error: "Account not found. Please sign up again." };
    await d1("UPDATE auth_users SET email_verified = 1 WHERE id = ?", [row.id]);
    await a.startSession(row.id);
    return { user: a.toPublicUser(row), error: null };
  });

export const resendVerificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const a = await import("./auth.server");
    const { d1 } = await import("./d1.server");
    const email = String(data.email ?? "").trim().toLowerCase();
    try { await a.rateLimit(`resend:${email}`, 3, 900); } catch (e: any) { return { ok: false, error: e.message }; }
    const row: any = (await d1("SELECT id, email_verified FROM auth_users WHERE email = ?", [email]))[0];
    if (!row || row.email_verified) return { ok: true, error: null }; // don't reveal account state
    try {
      const { sendOtp } = await import("./otp.server");
      await sendOtp(email);
      return { ok: true, error: null };
    } catch (e) {
      console.error("[resend] otp send failed", e);
      return { ok: false, error: "Couldn't send the email. Please try again in a moment." };
    }
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
    if (!row.email_verified) {
      try {
        const { sendOtp } = await import("./otp.server");
        await sendOtp(email);
      } catch (e) { console.error("[signin] otp send failed", e); }
      return { user: null, error: null, needsVerification: true };
    }
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
