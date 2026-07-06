jest.mock('../lib/stripeClient', () => ({
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
}));

const stripe = require('../lib/stripeClient');
const handler = require('../api/create-checkout-session');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/create-checkout-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLIENT_URL = 'https://bpdunboxed.test';
  });

  test('rejects non-POST requests', async () => {
    const req = { method: 'GET' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('rejects an empty items array', async () => {
    const req = { method: 'POST', body: { items: [] } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('rejects unknown product ids', async () => {
    const req = { method: 'POST', body: { items: [{ id: 'not-a-real-product', quantity: 1 }] } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('rejects invalid quantities', async () => {
    const req = { method: 'POST', body: { items: [{ id: 'crop-hoodie', quantity: 0 }] } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('never trusts a client-supplied price - line item amount always comes from the server catalog', async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session/test' });

    const req = {
      method: 'POST',
      // A tampered client could try to send its own "price" - it must be ignored.
      body: { items: [{ id: 'crop-hoodie', quantity: 2, price: 1 }] },
    };
    const res = mockRes();

    await handler(req, res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 4350,
            }),
          }),
        ],
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.com/session/test' });
  });

  test('returns 500 if Stripe throws', async () => {
    stripe.checkout.sessions.create.mockRejectedValue(new Error('stripe is down'));

    const req = {
      method: 'POST',
      body: { items: [{ id: 'crop-hoodie', quantity: 1 }] },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
