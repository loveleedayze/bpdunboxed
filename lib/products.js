// Server-side source of truth for shop products. Prices are defined here
// (never trusted from the client) so a tampered request can't change what a
// customer is charged. Printful variant IDs come from env vars because
// they're store-specific and shouldn't require a code change to configure.

const CATALOG = {
  'crop-hoodie': {
    name: "Un-F*ck You Crop Hoodie",
    priceCents: 4350,
    variantEnvVar: 'PRINTFUL_VARIANT_CROP_HOODIE',
  },
};

function getProductById(id) {
  const entry = CATALOG[id];
  if (!entry) return null;

  return {
    id,
    name: entry.name,
    priceCents: entry.priceCents,
    printfulVariantId: process.env[entry.variantEnvVar] || null,
  };
}

module.exports = { CATALOG, getProductById };
