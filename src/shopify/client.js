const axios = require('axios');
const config = require('../config');

const shopifyApi = axios.create({
  baseURL: `https://${config.shopify.storeDomain}/admin/api/${config.shopify.apiVersion}`,
  headers: {
    'X-Shopify-Access-Token': config.shopify.accessToken,
    'Content-Type': 'application/json',
  },
});

// Shopify rate limit: back off on 429
shopifyApi.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 429) {
    const retryAfter = parseFloat(error.response.headers['retry-after']) || 2;
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return shopifyApi.request(error.config);
  }
  throw error;
});

async function lookupVariantBySku(sku) {
  // GraphQL: get variant metafield + product metafield in one call
  const query = `
    {
      productVariants(first: 1, query: "sku:${sku.replace(/"/g, '\\"')}") {
        edges {
          node {
            id
            sku
            metafield(namespace: "${config.metafield.namespace}", key: "${config.metafield.videoKey}") {
              value
            }
            product {
              metafield(namespace: "${config.metafield.namespace}", key: "${config.metafield.productVideoKey}") {
                value
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyApi.post('/graphql.json', { query });

  const edges = data.data?.productVariants?.edges;
  if (!edges || edges.length === 0) {
    console.log(`[Shopify] No variant found for SKU: ${sku}`);
    return null;
  }

  const node = edges[0].node;

  // 1. Check variant-level metafield first
  const variantUrl = node.metafield?.value || null;
  if (variantUrl) {
    console.log(`[Shopify] SKU "${sku}" → variant URL: ${variantUrl}`);
    return variantUrl;
  }

  // 2. Fall back to product-level metafield
  const productUrl = node.product?.metafield?.value || null;
  if (productUrl) {
    let firstUrl = productUrl;
    try {
      const parsed = JSON.parse(productUrl);
      if (Array.isArray(parsed) && parsed.length > 0) {
        firstUrl = parsed[0];
      }
    } catch (e) {
      // not JSON, use as-is
    }
    console.log(`[Shopify] SKU "${sku}" → product URL: ${firstUrl}`);
    return firstUrl;
  }

  console.log(`[Shopify] SKU "${sku}" → (no video URL)`);
  return null;
}

async function lookupVariantDetails(sku) {
  const query = `
    {
      productVariants(first: 1, query: "sku:${sku.replace(/"/g, '\\"')}") {
        edges {
          node {
            id
            sku
            title
            metafield(namespace: "${config.metafield.namespace}", key: "${config.metafield.videoKey}") {
              value
            }
            product {
              title
              metafield(namespace: "${config.metafield.namespace}", key: "${config.metafield.productVideoKey}") {
                value
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyApi.post('/graphql.json', { query });

  const edges = data.data?.productVariants?.edges;
  if (!edges || edges.length === 0) return null;

  const node = edges[0].node;
  const productTitle = node.product?.title || '';

  let urls = [];

  // Check variant-level metafield
  const variantUrl = node.metafield?.value || null;
  if (variantUrl) {
    try {
      const parsed = JSON.parse(variantUrl);
      if (Array.isArray(parsed)) urls = parsed;
      else urls = variantUrl.split(',').map(u => u.trim()).filter(Boolean);
    } catch (e) {
      urls = variantUrl.split(',').map(u => u.trim()).filter(Boolean);
    }
  }

  // Fall back to product-level if no variant URLs
  if (urls.length === 0) {
    const productUrl = node.product?.metafield?.value || null;
    if (productUrl) {
      try {
        const parsed = JSON.parse(productUrl);
        if (Array.isArray(parsed)) urls = parsed;
        else urls = productUrl.split(',').map(u => u.trim()).filter(Boolean);
      } catch (e) {
        urls = productUrl.split(',').map(u => u.trim()).filter(Boolean);
      }
    }
  }

  return { sku, productTitle, urls };
}

module.exports = { lookupVariantBySku, lookupVariantDetails };
