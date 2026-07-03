// Thin wrapper around the Printful order-creation call. This never throws -
// it always resolves an { ok, ... } result - so a Printful outage or bad
// response can be logged and handled by the caller instead of crashing the
// webhook handler.

const PRINTFUL_ORDERS_URL = 'https://api.printful.com/orders';

async function createPrintfulOrder(orderPayload) {
  if (!process.env.PRINTFUL_API_KEY) {
    return { ok: false, error: 'Missing PRINTFUL_API_KEY environment variable' };
  }

  let response;

  try {
    response = await fetch(PRINTFUL_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
  } catch (error) {
    return { ok: false, error: `Printful request failed: ${error.message}` };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, status: response.status, error: data };
  }

  return { ok: true, data };
}

module.exports = { createPrintfulOrder };
