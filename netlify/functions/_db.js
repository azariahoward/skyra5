// Shared Supabase client + entitlement helpers used by the Stripe webhook and /api/me.
// Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Netlify → Environment variables.
// The service key is server-only — never expose it in the site HTML.
import { createClient } from "@supabase/supabase-js";

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

// Normalize emails the same way everywhere: trim + lowercase, so a stray space
// or capital letter never causes a "paid but still locked" mismatch.
const norm = (e) => (e || "").trim().toLowerCase();

// Grant/downgrade a plan by email. `customerId` links the Stripe customer so
// later subscription events (renewals, cancellations) can find the same row.
export async function setEntitlement(email, plan, customerId) {
  if (!email) return;
  const row = { email: norm(email), entitlement: plan, updated_at: new Date().toISOString() };
  if (customerId) row.stripe_customer = customerId;
  const { error } = await db.from("accounts").upsert(row, { onConflict: "email" });
  if (error) throw new Error("db upsert: " + error.message);
}

// Used on subscription.updated / .deleted, where we only have the Stripe customer id.
export async function setEntitlementByCustomer(customerId, plan) {
  if (!customerId) return;
  const { error } = await db.from("accounts")
    .update({ entitlement: plan, updated_at: new Date().toISOString() })
    .eq("stripe_customer", customerId);
  if (error) throw new Error("db update: " + error.message);
}

// Read a single account's entitlement (defaults to "free" if not found).
export async function getEntitlement(email) {
  if (!email) return "free";
  const { data, error } = await db.from("accounts")
    .select("entitlement").eq("email", norm(email)).maybeSingle();
  if (error) throw new Error("db select: " + error.message);
  return data?.entitlement || "free";
}

// --- account rows (email/password + profile) ---
export async function getAccount(email){
  if(!email) return null;
  const { data, error } = await db.from("accounts").select("*").eq("email", norm(email)).maybeSingle();
  if(error) throw new Error("db select: " + error.message);
  return data;
}
export async function createUser(email, name, passHash){
  const { error } = await db.from("accounts").upsert(
    { email: norm(email), name, pass_hash: passHash, updated_at: new Date().toISOString() },
    { onConflict: "email" });          // updates name/pass_hash; leaves entitlement untouched
  if(error) throw new Error("db upsert: " + error.message);
}
