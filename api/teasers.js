import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBlindTeasersFromNotion } from '../src/server/notionFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fallbackPath = path.resolve(__dirname, '../src/data/fallbackTeasers.json');

export default async function handler(req, res) {
  const fallbackPayload = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      ...fallbackPayload,
      source: 'notion-snapshot',
    });
  }

  try {
    const livePayload = await fetchBlindTeasersFromNotion(apiKey);
    return res.status(200).json(livePayload);
  } catch (error) {
    return res.status(200).json({
      ...fallbackPayload,
      source: 'notion-snapshot-fallback',
      warning: error.message,
    });
  }
}
