# Enterprise Picard — Venture Portfolio Blind Teaser Portal

A standalone React + Vite web application that dynamically pulls `[App]: Blind Teaser & Capital Metrics Summary` tables from Notion and renders them into an accessible, searchable collapsible accordion list.

## Architecture & Security

1. **Dynamic Notion Table Discovery (`src/server/notionFetcher.js`)**
   - Queries Notion (`POST /v1/search`) for all pages matching `"Blind Teaser & Capital Metrics Summary"`.
   - Fetches each page's block children (`GET /v1/blocks/{page_id}/children`), locates the Notion `table` block, and reads all `table_row` children (`GET /v1/blocks/{table_id}/children`).
   - **Pre-NDA Server-Side Redaction:** Strips the internal application name from the Notion page title on the server before returning JSON to the browser, ensuring external visitors only ever see the blind codenames (`Project Alpha` through `Project Keystone`) and sanitized metrics (`TAM`, `SAM`, `SOM`, `TCV`, `CARR`, and phased raise targets).
2. **Pre-Seeded Snapshot Fallback (`src/data/fallbackTeasers.json`)**
   - Pre-populated with all 7 current Enterprise Picard venture blind teasers so the app renders immediately out of the box even before `NOTION_API_KEY` is configured.
3. **Modern Web Accordion UX (`src/App.jsx` & `src/App.css`)**
   - Built with semantic HTML `<details class="disclosure">` and `<summary>` elements so collapsed table contents remain discoverable via native browser Find-in-Page (`Ctrl+F` / `Cmd+F`).
   - Supports toggling between **Single-Open Mode** (native `<details name="venture-blind-teaser">`) and **Multi-Expand Mode**, plus **Expand All / Collapse All** controls and smooth intrinsic size transitions (`interpolate-size: allow-keywords`).

---

## Quick Start (Local Development)

```bash
cd /home/drake/enterprise-picard/blind-teaser-portal
npm install
npm run dev
```

To enable live real-time Notion API queries on every page load or when clicking **↻ Sync from Notion**:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set `NOTION_API_KEY=ntn_...` to your Notion integration secret (ensure the **Enterprise Picard: Venture Portfolio Command Center** page is shared with that integration in Notion).

---

## Separate Hosting Options

### Option A: Netlify or Vercel (Live Dynamic Serverless Mode)
- **Netlify:** Included [`netlify.toml`](./netlify.toml) and [`netlify/functions/teasers.mjs`](./netlify/functions/teasers.mjs) automatically expose `/api/teasers`. Add `NOTION_API_KEY` in Netlify Site Settings -> Environment Variables.
- **Vercel:** Included [`api/teasers.js`](./api/teasers.js) automatically exposes `/api/teasers`. Add `NOTION_API_KEY` in Vercel Project Settings -> Environment Variables.
- Whenever you generate a new `[App]: Blind Teaser & Capital Metrics Summary` subpage in Notion, clicking **↻ Sync from Notion** (or refreshing the page) will automatically discover and render the new venture table.

### Option B: Pure Static Hosting (Firebase Hosting, S3, GitHub Pages)
If you prefer to host the compiled `dist/` folder on a static CDN without serverless functions, run the CLI sync script whenever you add a new venture in Notion:

```bash
NOTION_API_KEY=ntn_... npm run sync-notion
npm run build
```

This updates `src/data/fallbackTeasers.json` directly from Notion and bundles the latest tables into `dist/`.
