# Joe's Trading Log

A mobile-first HYPE and DOGE spot trading journal running entirely in Joe's
Cloudflare account.

## Production architecture

- `bigmagic.ai` is a custom domain of the `bigmagic-trading-log` Worker.
- Trade records are stored in the `bigmagic-trading-log` D1 database.
- Reading is public; `/owner/*` is protected by Cloudflare Access.
- The application no longer depends on ChatGPT Sites for production traffic,
  authentication, or data storage.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
npm test
npm run deploy
```

`npm run deploy` builds and tests the exact source before publishing it through
`wrangler.bigmagic.jsonc`.
