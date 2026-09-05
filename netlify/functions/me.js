// GET /api/me  -> the signed-in user's entitlement (from a session cookie OR a Google token)
import { authedEmail } from "./_auth.js";
import { getEntitlement } from "./_db.js";

export default async (req) => {
  try {
    const email = await authedEmail(req);
    if(!email) return Response.json({ signedIn:false, entitlement:"free" });
    const entitlement = await getEntitlement(email);
    return Response.json({ signedIn:true, email, entitlement });
  } catch (err) {
    return new Response("Server error: " + err.message, { status: 500 });
  }
};
export const config = { path: "/api/me" };
