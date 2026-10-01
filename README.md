# Yolias platform

This repository holds two products:

- **Yolias** (`Yolias/`): the customer app, a Prospect Intelligence & Discovery Platform.
- **Yolias Admin** (repo root): the company and platform control center, built on the former Taysonsta BOS.

Start with [`docs/README.md`](docs/README.md): vision, rules, architecture, roadmap and decisions.

## Run locally

```bash
npm install && (cd Yolias && npm install)
npm run local
```

- Yolias: http://localhost:3200
- Yolias Admin: http://admin.localhost:3200

Needs Docker (or Colima) for the local Supabase databases. The root
`.env.local` holds the Admin settings (Taysonsta Supabase, `BOS_SECRETS_KEY`,
`RESEND_API_KEY`, ...); `npm run local` adds the `YOLIAS_*` variables itself.

## Deploy

Cloudflare (OpenNext), once the product is finished (docs/12-decisions.md D-001).
