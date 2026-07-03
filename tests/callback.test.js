const handler = require('../api/callback');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq({ query = '', cookie = '' } = {}) {
  return {
    method: 'GET',
    url: `/api/callback${query}`,
    headers: { host: 'bpdunboxed.test', cookie },
  };
}

describe('GET /api/callback', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('rejects non-GET requests', async () => {
    const req = { method: 'POST', headers: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 when GitHub reports an authorization error', async () => {
    const req = mockReq({ query: '?error=access_denied' });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('authorization:github:error:'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns 400 when the state cookie is missing (possible CSRF)', async () => {
    const req = mockReq({ query: '?code=abc123&state=xyz' });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns 400 when the state does not match the cookie', async () => {
    const req = mockReq({ query: '?code=abc123&state=xyz', cookie: 'decap_oauth_state=different' });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns 500 when OAuth client credentials are not configured', async () => {
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET;

    const req = mockReq({ query: '?code=abc123&state=xyz', cookie: 'decap_oauth_state=xyz' });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('exchanges the code for a token and returns the postMessage success handshake', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'gho_test_token' }),
    });

    const req = mockReq({ query: '?code=abc123&state=xyz', cookie: 'decap_oauth_state=xyz' });
    const res = mockRes();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body).toContain('authorization:github:success:');
    expect(body).toContain('gho_test_token');
  });

  test('returns 400 when GitHub rejects the code exchange', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'bad_verification_code' }),
    });

    const req = mockReq({ query: '?code=abc123&state=xyz', cookie: 'decap_oauth_state=xyz' });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 500 without crashing when the GitHub request itself throws', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    const req = mockReq({ query: '?code=abc123&state=xyz', cookie: 'decap_oauth_state=xyz' });
    const res = mockRes();

    await expect(handler(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
