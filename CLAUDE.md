# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing site for "BPD Unboxed" (brand: "Feel Loudly. Heal Loudly.") with a small serverless backend for shop checkout. The page itself is plain HTML/CSS/JS with no build step — open `index.html` directly in a browser or serve the directory with any static file server to preview markup/style changes. The checkout flow requires the Node backend described below.

## Commands

- `npm install` — install backend dependencies (`stripe`, `jest`).
- `npm test` — run the Jest suite for the API endpoints (`tests/*.test.js`). Run a single file with `npx jest tests/create-checkout-session.test.js`.
- `vercel dev` — run the site + `/api` serverless functions locally (requires the Vercel CLI and a `.env` populated from `.env.example`).

## Architecture

The entire site is one page (`index.html`) divided into anchor-linked sections that double as the nav targets: `#home`, `#about`, `#features`, `#blog`, `#shop`, `#contact`. All three files are tightly coupled by ID/class name — when editing one, check the other two:

- **index.html** — markup for all sections plus the footer. Section order in the DOM defines both scroll order and nav menu order.
- **style.css** — all styling, driven by CSS custom properties defined once in `:root` (`--color-black`, `--color-red`, `--color-white`, `--color-gray-light`, `--color-gray-dark`, `--font-heading` = Bebas Neue, `--font-body` = Ubuntu). Change brand colors/fonts here only, not per-rule. Responsive breakpoints are `768px` and `480px` at the bottom of the file.
- **script.js** — vanilla JS, no dependencies, organized into clearly delimited blocks: mobile nav toggle, smooth-scroll for anchor links, contact form handling, scroll-triggered fade-in animations (via `IntersectionObserver`), and a navbar shadow-on-scroll effect.

## Contact form has no backend

`script.js`'s form handler validates fields client-side and simulated-submits (`console.log` + a success message) — it does not send data anywhere. If wiring this to a real backend/email service, that logic lives in the `contactForm.addEventListener('submit', ...)` block.

## Checkout / fulfillment architecture (Stripe + Printful)

Deployed as Vercel serverless functions under `api/`, backed by a shared `lib/` layer:

- **`lib/products.js`** — the server-side source of truth for product name/price. The client only ever sends a product `id` and quantity; prices are never trusted from the request, so a tampered client can't change what gets charged. Printful variant IDs are read from env vars (`PRINTFUL_VARIANT_*`) rather than hardcoded, since they're store-specific.
- **`api/create-checkout-session.js`** — validates `{ items: [{ id, quantity }] }`, builds Stripe `price_data` line items from the server catalog, and creates a Checkout Session with `shipping_address_collection` enabled. Returns `{ url }` for the client to redirect to (no Stripe.js/publishable key needed). Each line item's ad-hoc Stripe Product is tagged with `metadata.internal_id` so the webhook can map it back to our catalog later.
- **`api/webhooks/stripe.js`** — verifies the Stripe signature (needs the *raw* body, so it disables Vercel's default body parser via `module.exports.config = { api: { bodyParser: false } }` and reads the stream with `lib/getRawBody.js`). On `checkout.session.completed`, it pulls `shipping_details`, expands line items to recover each `internal_id`, maps to a Printful variant via `lib/products.js`, and calls `lib/printful.js`.
- **`lib/printful.js`** — POSTs to `https://api.printful.com/orders`. Always resolves `{ ok, ... }` instead of throwing, so a Printful outage can never crash the webhook handler. There is currently no database/queue, so a failed Printful call is only logged — no automatic retry. Add a durable store before relying on this for real order volume.
- **`success.html` / `cancel.html`** — the Stripe `success_url`/`cancel_url` targets. Keep their copy in the site's voice (warm, no shame, no corporate checkout-speak) since this is the moment right after a purchase decision.

Required env vars (see `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRINTFUL_API_KEY`, one `PRINTFUL_VARIANT_*` per product, and `CLIENT_URL`. Never commit a real `.env` — it's gitignored.

## Editing conventions already in place

- Blog posts and shop products are hand-written repeated markup blocks (`.blog-post`, `.product-card`), not generated from data — add new ones by copying an existing block's structure.
- New page sections should follow the existing pattern: a `<section class="name" id="name">` wrapping a `.container`, with a matching nav item added in both the desktop `.nav-menu` and footer `.footer-links` lists in `index.html`.
