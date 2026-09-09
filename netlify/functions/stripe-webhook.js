// netlify/functions/stripe-webhook.js
// SOURCE OF TRUTH for who paid. Verifies Stripe's signature, resolves the plan,
// writes entitlement to Supabase. Logs each step so Netlify's function log shows
// exactly what happened (open: Netlify → Functions → stripe-webhook → Logs).

import Stripe from "stripe";
import { setEntitlement, setEntitlementByCustomer } from "./_db.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_SINGLE]: "single",
  [process.env.STRIPE_PRICE_FAMILY]: "family",
};

async function planFromSession(session) {
  if (session.metadata?.plan) return session.metadata.plan;
  try {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const price = items.data[0]?.price?.id;
    console.log("[webhook] line-item price:", price, "→ plan:", PLAN_BY_PRICE[price]);
    if (PLAN_BY_PRICE[price]) return PLAN_BY_PRICE[price];
  } catch (e) { console.log("[webhook] listLineItems failed:", e.message); }
  return "single";
}

export default async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log("[webhook] SIGNATURE FAIL:", err.message);
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  console.log("[webhook] received event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        let email = s.customer_details?.email || s.customer_email;
        // Fallback: pull the email from the Stripe customer if the session didn't carry it
        if (!email && s.customer) {
          try { const c = await stripe.customers.retrieve(s.customer); email = c.email; }
          catch (e) { console.log("[webhook] customer retrieve failed:", e.message); }
        }
        const plan = await planFromSession(s);
        console.log("[webhook] checkout.session.completed → email:", email, "| plan:", plan, "| customer:", s.customer);
        if (!email) { console.log("[webhook] NO EMAIL on session — cannot write a row"); break; }
        await setEntitlement(email, plan, s.customer);
        console.log("[webhook] wrote entitlement:", email, "→", plan);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const active = sub.status === "active" || sub.status === "trialing";
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = active ? (sub.metadata?.plan || PLAN_BY_PRICE[priceId] || "single") : "free";
        console.log("[webhook]", event.type, "→ customer:", sub.customer, "| status:", sub.status, "| plan:", plan);
        await setEntitlementByCustomer(sub.customer, plan);
        break;
      }
      default:
        console.log("[webhook] ignored event type:", event.type);
    }
  } catch (err) {
    console.log("[webhook] HANDLER ERROR:", err.message);
    return new Response("Handler error: " + err.message, { status: 500 });
  }

  return Response.json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
