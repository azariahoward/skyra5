// POST /api/signup  { name, email, password }  -> creates account, sets session cookie
import { getAccount, createUser } from "./_db.js";
import { hashPassword } from "./_auth.js";
import { signSession, sessionCookie } from "./_session.js";
const json = (o, status=200, extra={}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type":"application/json", ...extra } });

export default async (req) => {
  if(req.method !== "POST") return json({ error:"Method not allowed" }, 405);
  const { name, email, password } = await req.json();
  const e = (email||"").trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error:"Please enter a valid email address." }, 400);
  if((password||"").length < 8)             return json({ error:"Password must be at least 8 characters." }, 400);
  const existing = await getAccount(e);
  if(existing?.pass_hash) return json({ error:"An account with that email already exists — try logging in." }, 409);
  await createUser(e, name||e, hashPassword(password));
  const token = signSession({ email:e });
  return json({ email:e, name:name||e, entitlement: existing?.entitlement || "free" }, 200, { "Set-Cookie": sessionCookie(token) });
};
export const config = { path: "/api/signup" };
