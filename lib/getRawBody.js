// Stripe webhook signature verification needs the exact, unparsed request
// body. This reads the raw bytes off the request stream before any JSON
// parsing happens (the webhook route disables Vercel's default body parser).

async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

module.exports = { getRawBody };
