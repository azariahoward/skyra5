// POST /api/login  { email, password }  -> verifies, sets session cookie
import { getAccount } from "./_db.js";
import { verifyPassword } from "./_auth.js";
import { signSession, sessionCookie } from "./_session.js";
const json = (o, status=200, extra={}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type":"application/json", ...extra } });

export default async (req) => {
  if(req.method !== "POST") return json({ error:"Method not allowed" }, 405);
  const { email, password } = await req.json();
  const e = (email||"").trim().toLowerCase();
  const acct = await getAccount(e);
  if(!acct || !verifyPassword(password||"", acct.pass_hash))
    return json({ error:"Email or password is incorrect." }, 401);
  const token = signSession({ email:e });
  return json({ email:e, name:acct.name||e, entitlement: acct.entitlement || "free", token }, 200, { "Set-Cookie": sessionCookie(token) });
};
export const config = { path: "/api/login" };
