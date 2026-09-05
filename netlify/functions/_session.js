// Minimal signed-session helper (HMAC-SHA256), no external dependency.
// Set SESSION_SECRET in Netlify → Environment variables.
import crypto from "crypto";
const SECRET = process.env.SESSION_SECRET || "dev-insecure-change-me";
const COOKIE = "sr_session";
const DAYS = 30;
const b64u = (s)=>Buffer.from(s).toString("base64url");

export function signSession(payload){
  const body = { ...payload, exp: Date.now() + DAYS*864e5 };
  const data = b64u(JSON.stringify({alg:"HS256",typ:"JWT"})) + "." + b64u(JSON.stringify(body));
  const sig  = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return data + "." + sig;
}
export function verifySession(token){
  if(!token || token.split(".").length!==3) return null;
  const [h,p,s] = token.split(".");
  const expect = crypto.createHmac("sha256", SECRET).update(h+"."+p).digest("base64url");
  const a=Buffer.from(s), b=Buffer.from(expect);
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
  let body; try{ body = JSON.parse(Buffer.from(p,"base64url").toString()); }catch{ return null; }
  if(!body.exp || Date.now() > body.exp) return null;
  return body;
}
export const sessionCookie = (token)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS*864e2}`;
export const clearCookie   = ()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function readCookie(req){
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp("(?:^|; )"+COOKIE+"=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}
