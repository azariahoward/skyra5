// netlify/functions/stripe-webhook.js
// The SOURCE OF TRUTH for who has paid. Stripe calls this after payment events.
// Verifies the signature, resolves the plan, then sets each account's entitlement.
// Works with BOTH the /api/create-checkout function (metadata.plan) AND Stripe
// Payment Links (which have no metadata — we map the purchased price -> plan).
//
// Grant access ONLY from here — never from the browser success redirect (that can be faked).

import Stripe from "stripe";
import { setEntitlement, setEntitlementByCustomer } from "./_db.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map your Stripe Price IDs -> plan names (set these env vars in Netlify).
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_SINGLE]: "single",
  [process.env.STRIPE_PRICE_FAMILY]: "family",
};

async function planFromSession(session) {
  if (session.metadata?.plan) return session.metadata.plan;      // set by create-checkout
  try {                                                          // Payment Links: look up the price
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const price = items.data[0]?.price?.id;
    if (PLAN_BY_PRICE[price]) return PLAN_BY_PRICE[price];
  } catch (_) {}
  return "single";
}

export default async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();                 // raw body is required to verify the signature

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const email = s.customer_details?.email || s.customer_email;
        const plan = await planFromSession(s);
        await setEntitlement(email, plan, s.customer);   // grant + link Stripe customer
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const active = sub.status === "active" || sub.status === "trialing";
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = active ? (sub.metadata?.plan || PLAN_BY_PRICE[priceId] || "single") : "free";
        await setEntitlementByCustomer(sub.customer, plan); // renewals & cancellations
        break;
      }
    }
  } catch (err) {
    return new Response("Handler error: " + err.message, { status: 500 });
  }

  return Response.json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
