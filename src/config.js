require('dotenv').config();

const required = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_ADMIN_API_TOKEN',
  'SHOPIFY_API_VERSION',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION,
  },

  metafield: {
    namespace: process.env.METAFIELD_NAMESPACE || 'custom',
    videoKey: process.env.METAFIELD_VIDEO_KEY || 'install_video_url',
    productVideoKey: process.env.METAFIELD_PRODUCT_VIDEO_KEY || 'product_video_link_2',
  },

  fallbackUrl: process.env.FALLBACK_URL || 'https://turnoffroad.com/contact',
  cacheTtl: parseInt(process.env.CACHE_TTL, 10) || 3600,
};
