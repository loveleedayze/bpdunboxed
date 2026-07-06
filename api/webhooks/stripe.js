const crypto = require('crypto');
const stripe = require('../../lib/stripeClient');
const { getRawBody } = require('../../lib/getRawBody');
const { getProductById } = require('../../lib/products');
const { createPrintfulOrder } = require('../../lib/printful');

// Disable Vercel's automatic body parsing - Stripe signature verification
// requires the exact raw request bytes, not a re-serialized JSON object.
const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await handleCheckoutCompleted(event.data.object);
    } catch (error) {
      // A downstream failure (bad data, Printful being unreachable, etc.)
      // must never surface as a failed webhook response - Stripe would just
      // keep retrying. We've logged what's needed to follow up manually.
      console.error('Error processing checkout.session.completed:', error);
    }
  }

  return res.status(200).json({ received: true });
}

async function handleCheckoutCompleted(session) {
  const shipping = session.shipping_details || (session.customer_details && {
    name: session.customer_details.name,
    address: session.customer_details.address,
  });

  if (!shipping || !shipping.address) {
    console.error(`Session ${session.id}: no shipping address present, skipping Printful order.`);
    return;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ['data.price.product'],
  });

  const printfulItems = [];
  const skipped = [];

  for (const lineItem of lineItems.data) {
    const internalId = lineItem.price
      && lineItem.price.product
      && lineItem.price.product.metadata
      && lineItem.price.product.metadata.internal_id;

    const product = internalId ? getProductById(internalId) : null;

    if (!product || !product.printfulVariantId) {
      skipped.push(lineItem.description || internalId || 'unknown item');
      continue;
    }

    printfulItems.push({
      sync_variant_id: product.printfulVariantId,
      quantity: lineItem.quantity,
    });
  }

  if (skipped.length > 0) {
    console.error(
      `Session ${session.id}: missing Printful variant mapping for: ${skipped.join(', ')}. `
      + 'These items were NOT sent to Printful and need manual fulfillment.'
    );
  }

  if (printfulItems.length === 0) {
    console.error(`Session ${session.id}: no fulfillable items, skipping Printful order.`);
    return;
  }

  const address = shipping.address;

  const orderPayload = {
    // Printful's external_id has a 32-character limit, well under the length
    // of a Stripe session id, so a truncated hash is used instead.
    external_id: crypto.createHash('sha256').update(session.id).digest('hex').slice(0, 32),
    recipient: {
      name: shipping.name || (session.customer_details && session.customer_details.name) || '',
      address1: address.line1 || '',
      address2: address.line2 || '',
      city: address.city || '',
      state_code: address.state || '',
      country_code: address.country || '',
      zip: address.postal_code || '',
      email: session.customer_details && session.customer_details.email,
    },
    items: printfulItems,
  };

  const result = await createPrintfulOrder(orderPayload);

  if (!result.ok) {
    console.error(`Printful order failed for session ${session.id}:`, result.error);
    // NOTE: there's no database/queue in this scaffold, so a failed call here
    // has no automatic retry. Before relying on this for real orders, add a
    // durable store (DB table or queue) to retry/alert on failures.
  } else {
    console.log(`Printful order created for session ${session.id}.`);
  }
}

module.exports = handler;
module.exports.config = config;
