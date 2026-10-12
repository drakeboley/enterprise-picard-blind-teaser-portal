import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBlindTeasersFromNotion } from '../src/server/notionFetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.resolve(__dirname, '../src/data/fallbackTeasers.json');

async function run() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: NOTION_API_KEY environment variable is required to sync live Notion tables.'
    );
    console.error('Usage: NOTION_API_KEY=ntn_... npm run sync-notion');
    process.exit(1);
  }

  console.log('Searching Notion for "Blind Teaser & Capital Metrics Summary" pages...');
  const payload = await fetchBlindTeasersFromNotion(apiKey);
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(
    `Successfully synced ${payload.teasers.length} Blind Teaser tables to ${targetPath}`
  );
}

run().catch((err) => {
  console.error('Failed to sync from Notion:', err.message);
  process.exit(1);
});
