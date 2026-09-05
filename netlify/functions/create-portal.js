// POST /api/create-portal  -> Stripe Billing portal URL so subscribers can manage/cancel
import Stripe from "stripe";
import { authedEmail } from "./_auth.js";
import { getAccount } from "./_db.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req) => {
  const email = await authedEmail(req);
  if(!email) return new Response(JSON.stringify({ error:"Not signed in." }), { status:401, headers:{ "Content-Type":"application/json" } });
  const acct = await getAccount(email);
  if(!acct?.stripe_customer)
    return new Response(JSON.stringify({ error:"No subscription found for this account." }), { status:404, headers:{ "Content-Type":"application/json" } });
  const origin = req.headers.get("origin") || process.env.SITE_URL || "https://skyraroadmap.com";
  const session = await stripe.billingPortal.sessions.create({ customer: acct.stripe_customer, return_url: origin });
  return Response.json({ url: session.url });
};
export const config = { path: "/api/create-portal" };
