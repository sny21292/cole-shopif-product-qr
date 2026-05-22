# qr-integration

Turn Offroad install-instruction QR code service.

A small Node.js + Express server that generates per-variant QR codes pointing to each Shopify product variant's install video. The codes are rendered onto ShipStation packing slips so the warehouse can drop a "Scan for install instructions" card into each shipping box, mapped to the right product.

## Status

**Placeholder only.** Right now this serves a single explainer page at `/` and a `/health` endpoint. The actual QR generation, Shopify lookup, and ShipStation template wiring land in subsequent commits.

## Why this exists

Cole's warehouse currently has no scalable way to associate per-product install videos with shipping labels. Maintaining 100+ ShipStation templates by hand is the wrong shape. The plan is:

1. A new variant-level Shopify metafield `custom.install_video_url` holds one URL per variant (source of truth).
2. This service exposes `GET /qr?sku=<sku>` — looks up the variant in Shopify, reads the install URL, returns a PNG of the QR code.
3. The existing ShipStation packing slip template loops over line items and renders `<img src="https://qr.turnoffroad.com/qr?sku=[Sku]">` per item — one 4×6 page per product, automatic.

See the discussion thread with Cole for the full requirements, scope, and pricing tracker.

## What's here

```
qr-integration/
├── index.js              ← Express entry point
├── package.json
├── public/
│   └── index.html        ← The "what is this" landing page
├── .gitignore
└── README.md
```

## Run it locally

```bash
npm install
npm start
# → qr-integration listening on http://localhost:3003
```

Then visit `http://localhost:3003/` for the page, or `http://localhost:3003/health` for the JSON health check.

## Deployment

Lives on the shared **Shopify-integrations droplet** alongside the other three integrations.

- **Server:** `159.203.85.16` (Ubuntu, root@, SSH key auth via `~/.ssh/gretrix`)
- **Path on server:** `/root/qr-integration/`
- **Port:** `3003`
- **PM2 process:** `qr-integration`
- **Public URL:** `https://qr.turnoffroad.com/` (Let's Encrypt cert, auto-renews)

### Redeploy after a change

```bash
ssh -i ~/.ssh/gretrix root@159.203.85.16
cd /root/qr-integration
git pull origin main
npm ci                       # only when package.json changed
pm2 restart qr-integration
pm2 logs qr-integration --lines 50
```

### Sister apps on the same droplet (for context)

| App | Port | PM2 name | Public URL |
|-----|------|----------|------------|
| Katana Integration | 3000 | `shopify-katana-integration` | https://katana.turnoffroad.com |
| FreightClub Integration | 3001 | `freightclub-integration` | https://freightclub.turnoffroad.com |
| Inventory Feed Integration | 3002 | `inventory-feed-integration` | https://inventoryfeed.turnoffroad.com |
| **QR Integration (this)** | 3003 | `qr-integration` | https://qr.turnoffroad.com |

The droplet is 1 vCPU / 512 MB / 10 GB and runs swap — keep memory footprint modest. nginx terminates TLS and reverse-proxies each subdomain to the right localhost port.

## Conventions inherited from sibling integrations

- **CommonJS** (`require`/`module.exports`), not ESM
- Secrets in `.env` — never commit
- Logs via PM2 (`pm2 logs <name>` / `~/.pm2/logs/`)
- Rate-limit Shopify writes at 550ms (per Katana app's pattern) once we start hitting the API
- Shopify API version `2024-10`

## What the dev will add next

1. **`GET /qr?sku=<sku>`** — resolves SKU → Shopify variant → reads `custom.install_video_url` → generates QR PNG using `qrcode` package → returns image. Cache aggressively (Shopify metafield changes slowly).
2. **Shopify Admin API client** — small wrapper for the variant + metafield lookup, mirror the pattern in `shopify-katana-integration/services/shopify.js`.
3. **Variant-level metafield** — once Cole confirms creation of `custom.install_video_url` (single URL, per-variant), Cole's team or we populate it via Matrixify CSV import.
4. **Fallback behavior** — when a variant has no install video set: TBD with Cole (skip the QR label entirely vs. print a generic "visit turnoffroad.com").
5. **ShipStation template snippet** — Cole pastes a small HTML chunk into the existing custom 4×6 packing slip template's "Order Items" section, referencing `[Sku]`.
6. **Tests** — at minimum a smoke test that `/qr?sku=KNOWN_SKU` returns a PNG with the expected payload (encode→decode roundtrip).

See the conversation history with Cole + Sunil's notes for the open questions (label stock, per-unit vs per-line-item, etc.).
