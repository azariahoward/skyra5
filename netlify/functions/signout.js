// POST /api/signout  -> clears the session cookie
import { clearCookie } from "./_session.js";
export default async () =>
  new Response(JSON.stringify({ ok:true }), { status:200, headers:{ "Content-Type":"application/json", "Set-Cookie": clearCookie() } });
export const config = { path: "/api/signout" };
