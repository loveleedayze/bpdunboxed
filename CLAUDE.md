# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A marketing site for "BPD Unboxed" (brand: "Feel Loudly. Heal Loudly.") with three parts: a static homepage, a Stripe/Printful shop checkout backend, and an Eleventy-built blog editable through a Git-based CMS (Decap) at `/admin`. The homepage itself is plain HTML/CSS/JS with no build step — open `index.html` directly in a browser to preview markup/style changes. The blog requires the Eleventy build; checkout requires the Node backend. Both are described below.

## Commands

- `npm install` — install dependencies (`stripe`, `@11ty/eleventy`, `jest`).
- `npm run build` — build the blog (`content/blog/**` → `blog/`) via Eleventy. Run this after any change under `content/blog/` or `.eleventy.js`.
- `npm test` — run the Jest suite for the API endpoints (`tests/*.test.js`). Run a single file with `npx jest tests/create-checkout-session.test.js`.
- `vercel dev` — run the whole site (static files + `/api` functions + Eleventy build via `vercel.json`'s `buildCommand`) locally. Requires the Vercel CLI and a `.env` populated from `.env.example`.

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

## Blog + CMS architecture (Eleventy + Decap CMS)

The blog is generated, not hand-written — content lives as markdown in `content/blog/posts/*.md`, and `npm run build` (Eleventy, config in `.eleventy.js`) renders it into `blog/` at the repo root, which is gitignored and rebuilt on every Vercel deploy via `vercel.json`'s `buildCommand`.

- **`content/blog/posts/*.md`** — one file per post, frontmatter `title` / `date` / `excerpt` + a markdown `body`. `posts.json` in that folder is an Eleventy directory data file supplying the shared `layout`, `tags`, and `permalink` so individual posts don't repeat that boilerplate.
- **`content/blog/index.njk`** — the listing page (`/blog/`), loops over `collections.post`.
- **`content/blog/_includes/base.njk`** — shared HTML shell (nav/footer/fonts) reused by both the listing and article layouts, kept visually consistent with the homepage's `style.css` classes.
- **`content/blog/_includes/post.njk`** — individual article layout.
- **Permalinks are written without a `/blog` prefix** (e.g. `/index.html`, `/{{ page.fileSlug }}/index.html`) because Eleventy's `output` dir is already `blog` — adding the prefix in the permalink double-nests the output (`blog/blog/...`). Links *to* posts are built manually as `/blog/{{ post.fileSlug }}/` rather than via `post.url`, since Eleventy's computed `url` doesn't know these files get served under a `/blog` path once deployed alongside the rest of the static site.
- **`admin/index.html` + `admin/config.yml`** — Decap CMS. The `github` backend commits directly to `content/blog/posts/` on `main` on publish. `config.yml`'s `base_url` must be set to the site's real production domain (must exactly match the GitHub OAuth App's callback URL).
- **`api/auth.js` + `api/callback.js`** — a self-hosted GitHub OAuth provider for Decap (no Netlify dependency), implementing the standard `authorization:github:success:{...}` postMessage handshake the CMS expects. `api/auth.js` sets a random `state` in an HttpOnly cookie before redirecting to GitHub; `api/callback.js` validates it matches on return (CSRF protection) before exchanging the code for a token server-side. Env vars: `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.
- **Actual access control is GitHub's, not this code's**: any GitHub user can complete the OAuth login, but only accounts with write/collaborator access to this repo can actually push a save — GitHub's own API enforces that. There is no separate allowlist to maintain here.

## Editing conventions already in place

- Shop products are a hand-written repeated markup block (`.product-card`) in `index.html`, not generated from data — add new ones by copying an existing block's structure (and adding a matching entry to `lib/products.js` if it should be purchasable).
- New homepage sections should follow the existing pattern: a `<section class="name" id="name">` wrapping a `.container`, with a matching nav item added in both the desktop `.nav-menu` and footer `.footer-links` lists in `index.html`.
- `script.js` is shared across the homepage, blog pages, and any other page that includes it — element lookups for page-specific features (like the contact form) must null-check before adding listeners, since not every page has every element.
