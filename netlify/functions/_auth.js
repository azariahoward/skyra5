// Password hashing (Node crypto scrypt — no external dep) + unified identity resolver.
import crypto from "crypto";
import { verifySession, readCookie } from "./_session.js";

export function hashPassword(pw){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return salt + ":" + hash;
}
export function verifyPassword(pw, stored){
  if(!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(test, "hex"), b = Buffer.from(hash, "hex");
  return a.length===b.length && crypto.timingSafeEqual(a, b);
}

// Validate a Google ID token string and return its email.
async function emailFromGoogleToken(token){
  if(!token) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
  if(!r.ok) return null;
  const info = await r.json();
  if(process.env.GOOGLE_CLIENT_ID && info.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if(info.email_verified === "false") return null;
  return info.email || null;
}

// Trusted email from ANY of: our session cookie, our session token (Bearer),
// or a Google ID token (Bearer). Token-based so it works even if cookies are blocked.
export async function authedEmail(req){
  // 1) our signed session cookie
  const cookieSess = verifySession(readCookie(req));
  if(cookieSess?.email) return cookieSess.email;
  // 2) Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if(token){
    const ours = verifySession(token);              // our email/password session token
    if(ours?.email) return ours.email;
    const g = await emailFromGoogleToken(token);     // otherwise a Google ID token
    if(g) return g;
  }
  return null;
}
