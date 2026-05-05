<div align="center">

<img src="/public/icons/icon-512x512.png" alt="Next Whois" width="64" height="64">

# Next Whois

A fast, modern WHOIS/RDAP lookup tool built with Next.js. Optimized for Edge Runtimes (Cloudflare Pages, Vercel Edge).

[English](/README.md) · [简体中文](/docs/README_CN.md) · [繁體中文](/docs/README_TW.md) · [Русский](/docs/README_RU.md) · [日本語](/docs/README_JP.md) · [Deutsch](/docs/README_DE.md) · [Français](/docs/README_FR.md) · [한국어](/docs/README_KR.md)

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/pages/new)
[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/zmh-program/next-whois-ui)

</div>

![Banner](/public/banner.png)

## Features

- **WHOIS & RDAP** - Domain, IPv4, IPv6, ASN, CIDR lookup with RDAP-first approach.
- **Edge Native** - Fully compatible with Cloudflare Pages and Edge Runtime (No Node.js `net/sys` dependencies).
- **Dynamic OG Images** - Satori-based Open Graph image generation via `/api/og`.
- **Responsive UI** - Shadcn UI + Tailwind CSS, works across mobile, tablet, and desktop. PWA support.
- **Dark / Light Theme** - System detection with manual toggle.
- **History & Shortcuts** - Local history with search, filter, and keyboard shortcuts.
- **EPP Status Codes** - Human-readable status descriptions with ICANN references.
- **Registrar & NS Branding** - Auto-detected icons for major registrars and nameserver providers.
- **Domain Metrics** - Moz DA/PA/Spam Score integration (optional).
- **Redis Caching** - Server-side result caching via Upstash (HTTP REST), optimized for Edge.
- **Open API** - `/api/lookup` for programmatic access, `/api/og` for image generation.
- **i18n** - English, Chinese (Simplified/Traditional), German, Russian, Japanese, French, Korean.
- **API Documentation** - Built-in `/docs` page with interactive examples.

## Community Forks

See great work from brilliant builders extending this project:

- [w.is](https://w.is) (by [HiFrey](https://x.com/@HiFrey))
- [14.cx](https://14.cx) ([yisi.yun](https://yisi.yun), by [人皇](https://www.dalao.net/user-4842.htm))

## Deploy

### Platforms (Recommended)

**Cloudflare Pages** (Best for Edge) / **Vercel** / **Netlify** / **Zeabur**

### Docker

```bash
docker run -d -p 3000:3000 programzmh/next-whois-ui
```

### Source Code

```bash
git clone https://github.com/zmh-program/next-whois-ui
cd next-whois-ui
pnpm install
pnpm dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_TITLE` | Site title | Next Whois |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | Site description | — |
| `NEXT_PUBLIC_SITE_KEYWORDS` | Site keywords | — |
| `NEXT_PUBLIC_HISTORY_LIMIT` | Max history items (-1 = unlimited) | -1 |
| `MOZ_ACCESS_ID` | Moz API Access ID | — |
| `MOZ_SECRET_KEY` | Moz API Secret Key | — |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (Enable Edge caching) | — |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | — |
| `REDIS_CACHE_TTL` | Cache TTL in seconds | 3600 |

> **Note**: For Cloudflare Pages deployment, use **Upstash Redis** (HTTP-based) instead of standard TCP Redis to ensure compatibility with the Edge Runtime.

## API

See the built-in [API Documentation](https://who.zmh.me/docs) page, or:

**`GET /api/lookup?query=google.com`** — RDAP/WHOIS lookup (Edge-compatible, merged results)

**`GET /api/og?query=google.com`** — Dynamic OG image generation

## Tech Stack

- Next.js 14 (Pages Router, Edge Runtime)
- [@upstash/redis](https://github.com/upstash/upstash-redis) - HTTP-based Redis client for Edge
- Native Fetch RDAP client (No TCP/net dependencies)
- Satori (via `next/og`) for image generation