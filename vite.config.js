import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchBlindTeasersFromNotion } from './src/server/notionFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fallbackPath = path.resolve(__dirname, './src/data/fallbackTeasers.json');

function notionTeasersApiPlugin(apiKey) {
  const handleApiRequest = async (req, res, next) => {
    if (!req.url?.startsWith('/api/teasers')) {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');
    const fallbackPayload = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));

    if (!apiKey) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ...fallbackPayload,
          source: 'notion-snapshot',
        })
      );
      return;
    }

    try {
      const livePayload = await fetchBlindTeasersFromNotion(apiKey);
      res.statusCode = 200;
      res.end(JSON.stringify(livePayload));
    } catch (error) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ...fallbackPayload,
          source: 'notion-snapshot-fallback',
          warning: error.message,
        })
      );
    }
  };

  return {
    name: 'notion-teasers-api',
    configureServer(server) {
      server.middlewares.use(handleApiRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApiRequest);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.NOTION_API_KEY || process.env.NOTION_API_KEY || '';

  return {
    plugins: [react(), notionTeasersApiPlugin(apiKey)],
    server: {
      port: 5179,
      host: true,
    },
  };
});
