// Server-side source of truth for shop products. Prices are defined here
// (never trusted from the client) so a tampered request can't change what a
// customer is charged. Printful variant IDs come from env vars because
// they're store-specific and shouldn't require a code change to configure.

const CATALOG = {
  'before-you-spiral': {
    name: 'Before You Spiral',
    priceCents: 2700,
    variantEnvVar: 'PRINTFUL_VARIANT_BEFORE_YOU_SPIRAL',
  },
  'fawn-to-no-script-kit': {
    name: 'The Fawn to No Script Kit',
    priceCents: 3700,
    variantEnvVar: 'PRINTFUL_VARIANT_FAWN_KIT',
  },
  'nervous-system-check': {
    name: 'Is It Me or My Nervous System?',
    priceCents: 3200,
    variantEnvVar: 'PRINTFUL_VARIANT_NERVOUS_SYSTEM',
  },
  'boundary-reset': {
    name: 'Borderlegend Boundary Reset',
    priceCents: 4700,
    variantEnvVar: 'PRINTFUL_VARIANT_BOUNDARY_RESET',
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
