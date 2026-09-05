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

// Verify a Google ID token (Authorization: Bearer <id_token>) and return its email.
export async function emailFromGoogle(req){
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if(!token) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
  if(!r.ok) return null;
  const info = await r.json();
  if(process.env.GOOGLE_CLIENT_ID && info.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if(info.email_verified === "false") return null;
  return info.email || null;
}

// Trusted email from EITHER an email/password session cookie OR a Google token.
export async function authedEmail(req){
  const sess = verifySession(readCookie(req));
  if(sess?.email) return sess.email;
  return await emailFromGoogle(req);
}
