const stripe = require('../lib/stripeClient');
const { getProductById } = require('../lib/products');

const MAX_QUANTITY_PER_ITEM = 20;
// Printful ships to most of the world; this is a starter set of countries to
// collect shipping addresses for. Expand as needed.
const ALLOWED_SHIPPING_COUNTRIES = ['US', 'CA', 'GB', 'AU', 'IE', 'DE', 'FR'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const items = req.body && req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty "items" array.' });
  }

  const lineItems = [];

  for (const item of items) {
    const product = getProductById(item && item.id);

    if (!product) {
      return res.status(400).json({ error: `Unknown product id: ${item && item.id}` });
    }

    const rawQuantity = item.quantity === undefined ? 1 : Number(item.quantity);

    if (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > MAX_QUANTITY_PER_ITEM) {
      return res.status(400).json({ error: `Invalid quantity for product: ${item.id}` });
    }

    lineItems.push({
      quantity: rawQuantity,
      price_data: {
        currency: 'usd',
        unit_amount: product.priceCents,
        product_data: {
          name: product.name,
          // Stored so the webhook can map the Stripe line item back to our
          // internal catalog (and from there, to a Printful variant).
          metadata: { internal_id: product.id },
        },
      },
    });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ALLOWED_SHIPPING_COUNTRIES },
      success_url: `${clientUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/cancel.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    return res.status(500).json({ error: 'Unable to start checkout. Please try again shortly.' });
  }
};
