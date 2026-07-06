jest.mock('../lib/stripeClient', () => ({
  webhooks: { constructEvent: jest.fn() },
  checkout: { sessions: { listLineItems: jest.fn() } },
}));
jest.mock('../lib/getRawBody', () => ({
  getRawBody: jest.fn().mockResolvedValue(Buffer.from('{}')),
}));
jest.mock('../lib/printful', () => ({ createPrintfulOrder: jest.fn() }));

const stripe = require('../lib/stripeClient');
const { createPrintfulOrder } = require('../lib/printful');
const handler = require('../api/webhooks/stripe');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

function baseSession(overrides = {}) {
  return {
    id: 'cs_test_123',
    shipping_details: {
      name: 'Jamie Rivera',
      address: {
        line1: '123 Main St',
        line2: '',
        city: 'Austin',
        state: 'TX',
        postal_code: '78701',
        country: 'US',
      },
    },
    customer_details: { email: 'jamie@example.com', name: 'Jamie Rivera' },
    ...overrides,
  };
}

function lineItemsWithProduct(internalId, quantity = 1) {
  return {
    data: [
      {
        quantity,
        description: internalId,
        price: { product: { metadata: { internal_id: internalId } } },
      },
    ],
  };
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.PRINTFUL_VARIANT_CROP_HOODIE = 'variant_123';
  });

  test('rejects non-POST requests', async () => {
    const req = { method: 'GET', headers: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 when signature verification fails', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const req = { method: 'POST', headers: { 'stripe-signature': 'bad' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('acknowledges but ignores unrelated event types', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(stripe.checkout.sessions.listLineItems).not.toHaveBeenCalled();
  });

  test('parses shipping + items and sends a Printful order on checkout.session.completed', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: baseSession() },
    });
    stripe.checkout.sessions.listLineItems.mockResolvedValue(
      lineItemsWithProduct('crop-hoodie', 1)
    );
    createPrintfulOrder.mockResolvedValue({ ok: true, data: { result: { id: 999 } } });

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await handler(req, res);

    expect(createPrintfulOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: expect.stringMatching(/^[0-9a-f]{32}$/),
        recipient: expect.objectContaining({
          name: 'Jamie Rivera',
          city: 'Austin',
          state_code: 'TX',
          country_code: 'US',
          zip: '78701',
          email: 'jamie@example.com',
        }),
        items: [{ sync_variant_id: 'variant_123', quantity: 1 }],
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not crash and still returns 200 when the Printful call fails', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: baseSession() },
    });
    stripe.checkout.sessions.listLineItems.mockResolvedValue(
      lineItemsWithProduct('crop-hoodie', 1)
    );
    createPrintfulOrder.mockResolvedValue({ ok: false, error: 'Printful is down' });

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await expect(handler(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not crash when Printful itself throws (network error)', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: baseSession() },
    });
    stripe.checkout.sessions.listLineItems.mockResolvedValue(
      lineItemsWithProduct('crop-hoodie', 1)
    );
    createPrintfulOrder.mockRejectedValue(new Error('ECONNRESET'));

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await expect(handler(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('skips the Printful call when no shipping address is present', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: baseSession({ shipping_details: null, customer_details: { email: 'x@example.com' } }) },
    });

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await handler(req, res);

    expect(createPrintfulOrder).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('skips items with no configured Printful variant instead of sending bad data', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: baseSession() },
    });
    stripe.checkout.sessions.listLineItems.mockResolvedValue(
      lineItemsWithProduct('not-a-real-product', 1) // not in the catalog at all
    );

    const req = { method: 'POST', headers: { 'stripe-signature': 'valid' } };
    const res = mockRes();

    await handler(req, res);

    expect(createPrintfulOrder).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
