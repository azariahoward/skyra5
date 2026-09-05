SKYRA ROADMAP — Stripe + Supabase + Auth functions
===================================================

Endpoints
  POST /api/signup          create email/password account -> sets session cookie
  POST /api/login           email/password login          -> sets session cookie
  POST /api/signout         clear the session cookie
  POST /api/create-checkout Stripe Checkout (annual sub), price chosen server-side
  POST /api/stripe-webhook  Stripe -> writes entitlement to the DB (source of truth)
  POST /api/create-portal   Stripe Billing portal URL (manage/cancel subscription)
  GET  /api/me              signed-in user's entitlement (session cookie OR Google token)

Helpers (not endpoints): _db.js (Supabase), _auth.js (password hash + identity), _session.js (cookie)

Environment variables (Netlify -> Site settings -> Environment variables)
  STRIPE_SECRET_KEY        sk_live_... (sk_test_... while testing)
  STRIPE_WEBHOOK_SECRET    whsec_...   (from the webhook you create)
  STRIPE_PRICE_SINGLE      price_...   (Single Student annual, $19/yr)
  STRIPE_PRICE_FAMILY      price_...   (Family annual, $39/yr)
  SUPABASE_URL             https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY     service_role key (server-only — NEVER in the HTML)
  GOOGLE_CLIENT_ID         OAuth client id (so /api/me trusts only tokens for THIS app)
  SESSION_SECRET           long random string (signs the email/password session cookie)
  SITE_URL                 https://your-domain (optional; used for redirects)

Supabase: create the accounts table (SQL editor)
  create table accounts (
    email            text primary key,
    name             text,
    entitlement      text not null default 'free',   -- free | single | family
    stripe_customer  text,
    pass_hash        text,                            -- scrypt hash (null for Google-only accounts)
    updated_at       timestamptz default now()
  );
  -- functions use the service_role key (bypasses RLS); never expose that key to the browser.

Auth notes
  - Email/password: passwords are hashed with Node crypto scrypt; login issues a signed,
    httpOnly, Secure, SameSite=Lax cookie (sr_session). /api/me and /api/create-portal
    accept EITHER that cookie OR a Google ID token (Authorization: Bearer <token>).
  - Google: the app sends the ID token; /api/me validates it with Google and checks GOOGLE_CLIENT_ID.

Deploy note: functions need npm deps installed, so DON'T use drag-and-drop.
Connect this folder to a GitHub repo in Netlify, or use the CLI:  npm install && netlify deploy --prod

TAX: Stripe does NOT remit sales tax. Add Stripe Tax, or use a merchant of record
(Lemon Squeezy / Paddle) so tax on digital goods is collected & filed for you.
