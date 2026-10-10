// Server-only 8-digit email verification codes, stored hashed in D1.
import { d1 } from "./d1.server";
import { randomToken, sha256 } from "./auth.server";
import { sendMail } from "./mail.server";

const OTP_TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 100_000_000).padStart(8, "0");
}

/** Creates and emails a fresh 8-digit code for the address. */
export async function sendOtp(email: string) {
  const code = generateOtp();
  const hash = await sha256(`${email}:${code}`);
  const now = new Date().toISOString();
  const expires = Math.floor(Date.now() / 1000) + OTP_TTL_SEC;
  await d1(
    "INSERT INTO auth_otps (email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at",
    [email, hash, expires, now],
  );
  await sendMail(
    email,
    "Your Vision verification code",
    `Hi,\n\nYour Vision verification code is:\n\n${code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.\n\n— Vision`,
  );
}

/** Checks a code; returns true and consumes it when valid. */
export async function checkOtp(email: string, code: string): Promise<boolean> {
  const row = (await d1<{ code_hash: string; expires_at: number; attempts: number }>(
    "SELECT code_hash, expires_at, attempts FROM auth_otps WHERE email = ?", [email],
  ))[0];
  if (!row) return false;
  if (row.attempts >= MAX_ATTEMPTS || row.expires_at < Math.floor(Date.now() / 1000)) return false;
  const ok = row.code_hash === (await sha256(`${email}:${code}`));
  if (ok) {
    await d1("DELETE FROM auth_otps WHERE email = ?", [email]);
  } else {
    await d1("UPDATE auth_otps SET attempts = attempts + 1 WHERE email = ?", [email]);
  }
  return ok;
}

export { randomToken };
