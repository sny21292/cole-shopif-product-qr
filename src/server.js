const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./db/init');
const { lookupVariantBySku, lookupVariantDetails } = require('./shopify/client');
const { generateQr } = require('./qr/generator');

const app = express();

// Serve dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// QR endpoint
app.get('/qr', async (req, res) => {
  const { sku } = req.query;

  if (!sku) {
    return res.status(400).json({ error: 'Missing ?sku= parameter' });
  }

  try {
    // Check cache first
    const cached = db.getCache(sku);
    if (cached) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600');
      res.set('X-Cache', 'HIT');
      return res.send(cached.qr_png);
    }

    // Lookup variant in Shopify
    const videoUrl = await lookupVariantBySku(sku);
    // QR points to install page which handles single vs multiple videos
    const targetUrl = videoUrl
      ? `https://qr.turnoffroad.com/install?sku=${encodeURIComponent(sku)}`
      : config.fallbackUrl;

    // Generate QR
    const pngBuffer = await generateQr(targetUrl);

    // Cache it
    db.setCache(sku, targetUrl, pngBuffer);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('X-Cache', 'MISS');
    res.send(pngBuffer);
  } catch (err) {
    console.error(`[QR] Error for SKU "${sku}":`, err.message);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Install video landing page
app.get('/install', async (req, res) => {
  const { sku } = req.query;

  if (!sku) {
    return res.redirect(config.fallbackUrl);
  }

  try {
    const details = await lookupVariantDetails(sku);

    if (!details || details.urls.length === 0) {
      return res.redirect(config.fallbackUrl);
    }

    // Single video — redirect straight to YouTube
    if (details.urls.length === 1) {
      return res.redirect(details.urls[0]);
    }

    // Multiple videos — show landing page
    const videoEmbeds = details.urls.map((url, i) => {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin: 0 0 8px;">Video ${i + 1}</h3>
            <iframe width="100%" height="250" src="https://www.youtube.com/embed/${videoId}"
              frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen style="border-radius: 8px;"></iframe>
          </div>`;
      }
      return `<div style="margin-bottom: 20px;"><a href="${url}" style="color: #2c6ecb; font-size: 16px;">Watch Video ${i + 1}</a></div>`;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Install Instructions - ${details.productTitle}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #f5f5f5; color: #1a1a1a; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { font-size: 20px; margin-bottom: 4px; }
          .header p { font-size: 14px; color: #aaa; }
          .content { background: white; border-radius: 0 0 12px 12px; padding: 20px; }
          .product-info { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
          .product-info h2 { font-size: 18px; margin-bottom: 4px; }
          .product-info .sku { font-size: 13px; color: #666; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; }
          .footer a { color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Install Instructions</h1>
            <p>Turn Offroad</p>
          </div>
          <div class="content">
            <div class="product-info">
              <h2>${details.productTitle}</h2>
              <div class="sku">SKU: ${sku}</div>
            </div>
            ${videoEmbeds}
          </div>
          <div class="footer">
            <a href="https://turnoffroad.com">turnoffroad.com</a> | <a href="mailto:help@turnoffroad.com">help@turnoffroad.com</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(`[Install] Error for SKU "${sku}":`, err.message);
    res.redirect(config.fallbackUrl);
  }
});

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Clear cache for a specific SKU
app.get('/cache/clear', (req, res) => {
  const { sku } = req.query;

  if (!sku) {
    db.clearCache();
    console.log('[Cache] Cleared all cache');
    return res.json({ message: 'All cache cleared' });
  }

  db.clearCacheBySku(sku);
  console.log(`[Cache] Cleared cache for SKU: ${sku}`);
  res.json({ message: `Cache cleared for SKU: ${sku}` });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  process.exit(0);
});

app.listen(config.port, () => {
  console.log(`QR service running on http://localhost:${config.port}`);
});
