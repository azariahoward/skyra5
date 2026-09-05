// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session for an annual (subscription) plan.
// The app's Billing.startCheckout() POSTs { plan } here and redirects to session.url.
//
// SECURITY: the price is chosen SERVER-SIDE from env vars, so the browser can never
// pass an arbitrary/cheaper price. Never put your secret key in the site HTML.

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for your annual plans (set these in Netlify → Environment variables)
const PRICE = {
  single: process.env.STRIPE_PRICE_SINGLE, // e.g. price_123...  ($19/yr)
  family: process.env.STRIPE_PRICE_FAMILY, // e.g. price_456...  ($39/yr)
};

export default async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const { plan, email } = await req.json();
    const price = PRICE[plan];
    if (!price) return new Response("Unknown plan", { status: 400 });

    const origin = req.headers.get("origin") || "https://skyraroadmap.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",                       // annual recurring
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,                // lets coupon codes (e.g. SCHOOL26) apply
      customer_email: email || undefined,         // ties the sale to the signed-in account
      metadata: { plan },
      subscription_data: { metadata: { plan } },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    return new Response("Server error: " + err.message, { status: 500 });
  }
};

export const config = { path: "/api/create-checkout" };
