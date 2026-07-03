const handler = require('../api/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.writeHead = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/auth', () => {
  beforeEach(() => {
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
  });

  test('rejects non-GET requests', () => {
    const req = { method: 'POST', headers: {} };
    const res = mockRes();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 500 when GITHUB_OAUTH_CLIENT_ID is not configured', () => {
    delete process.env.GITHUB_OAUTH_CLIENT_ID;

    const req = { method: 'GET', headers: { host: 'bpdunboxed.test' } };
    const res = mockRes();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('redirects to GitHub with a state cookie set', () => {
    const req = {
      method: 'GET',
      headers: { host: 'bpdunboxed.test', 'x-forwarded-proto': 'https' },
    };
    const res = mockRes();

    handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('decap_oauth_state=')
    );
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('HttpOnly'));
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Secure'));

    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: expect.any(String) }));
    const location = res.writeHead.mock.calls[0][1].Location;
    expect(location).toContain('https://github.com/login/oauth/authorize');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('redirect_uri=' + encodeURIComponent('https://bpdunboxed.test/api/callback'));
  });

  test('omits Secure cookie attribute over plain http (local dev)', () => {
    const req = { method: 'GET', headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' } };
    const res = mockRes();

    handler(req, res);

    const cookieHeader = res.setHeader.mock.calls.find((call) => call[0] === 'Set-Cookie')[1];
    expect(cookieHeader).not.toContain('Secure');
  });
});
