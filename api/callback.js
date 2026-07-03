// Step 2 of the Decap CMS "github" backend OAuth flow: GitHub redirects here
// with a one-time code. We exchange it server-side for an access token (the
// client secret never reaches the browser) and hand the token back to the
// admin login popup via the exact postMessage handshake Decap CMS expects.
//
// Access control note: this token belongs to whichever GitHub user just
// logged in, scoped to THEIR own permissions. GitHub itself will reject any
// write to this repo from a user who isn't a collaborator - this endpoint
// does not need its own allowlist, the repo's collaborator list is the
// actual security boundary.

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function renderMessagePage(script) {
  return `<!doctype html><html><body><script>${script}</script></body></html>`;
}

function successScript(token) {
  const payloadLiteral = JSON.stringify(JSON.stringify({ token, provider: 'github' }));
  return `
    function receiveMessage(message) {
      window.opener.postMessage(
        'authorization:github:success:' + ${payloadLiteral},
        message.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  `;
}

function errorScript(message) {
  const payloadLiteral = JSON.stringify(JSON.stringify({ message }));
  return `
    function receiveMessage(message) {
      window.opener.postMessage(
        'authorization:github:error:' + ${payloadLiteral},
        message.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  `;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const cookies = parseCookies(req.headers.cookie);
  const expectedState = cookies.decap_oauth_state;

  // Single-use state cookie - clear it regardless of outcome.
  res.setHeader('Set-Cookie', 'decap_oauth_state=; HttpOnly; Path=/; Max-Age=0');

  if (oauthError) {
    return res.status(400).send(renderMessagePage(errorScript(`GitHub authorization was denied: ${oauthError}`)));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return res.status(400).send(renderMessagePage(errorScript('Invalid or missing OAuth state. Please try logging in again.')));
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send(renderMessagePage(errorScript('OAuth is not configured on the server.')));
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;

  let tokenData;

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      console.error('GitHub OAuth token exchange failed:', tokenData);
      return res.status(400).send(renderMessagePage(errorScript('Could not complete GitHub login. Please try again.')));
    }
  } catch (error) {
    console.error('GitHub OAuth token exchange error:', error);
    return res.status(500).send(renderMessagePage(errorScript('Unexpected error completing GitHub login.')));
  }

  return res.status(200).send(renderMessagePage(successScript(tokenData.access_token)));
};
