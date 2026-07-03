const crypto = require('crypto');

// Step 1 of the Decap CMS "github" backend OAuth flow: redirect the admin
// login popup to GitHub's authorize screen. A random state value is stored
// in an HttpOnly cookie so /api/callback can verify the redirect back is
// genuine (CSRF protection), since these are stateless functions with no
// server-side session store.

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;

  if (!clientId) {
    return res.status(500).send('OAuth is not configured: missing GITHUB_OAUTH_CLIENT_ID');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;

  const cookieParts = [
    `decap_oauth_state=${state}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=600',
    'SameSite=Lax',
  ];
  if (proto === 'https') {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo');
  authorizeUrl.searchParams.set('state', state);

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
};
