// Server-only 8-digit email verification codes, stored as keyed hashes in D1.
import { d1 } from "./d1.server";
import { randomToken } from "./auth.server";
import { sendMail } from "./mail.server";
import { randomDigits, safeEqual, SECURITY_CONFIG } from "../../../security";
import { pseudonym } from "./security.server";

const OTP_TTL_SEC = SECURITY_CONFIG.otp.ttlSec;
const MAX_ATTEMPTS = SECURITY_CONFIG.otp.maxAttempts;

export function generateOtp(): string {
  return randomDigits(8);
}

const codeHash = (email: string, code: string) => pseudonym("otp", `${email}:${code}`);

/** Creates and emails a fresh 8-digit code for the address (replaces any previous code). */
export async function sendOtp(email: string) {
  const code = generateOtp();
  const hash = await codeHash(email, code);
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

/** Checks a code. Attempts are counted atomically and a valid code is consumed exactly once. */
export async function checkOtp(email: string, code: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = (await d1<{ code_hash: string; attempts: number }>(
    "UPDATE auth_otps SET attempts = attempts + 1 WHERE email = ? AND expires_at >= ? AND attempts < ? RETURNING code_hash, attempts",
    [email, now, MAX_ATTEMPTS],
  ))[0];
  if (!row) return false;
  if (!safeEqual(row.code_hash, await codeHash(email, code))) return false;
  // Single use: only one concurrent request can delete the row.
  const consumed = await d1("DELETE FROM auth_otps WHERE email = ? AND code_hash = ? RETURNING email", [email, row.code_hash]);
  return consumed.length > 0;
}

export { randomToken };
