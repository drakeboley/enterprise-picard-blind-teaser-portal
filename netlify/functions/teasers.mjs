import fallbackPayload from '../../src/data/fallbackTeasers.json' with { type: 'json' };
import { fetchBlindTeasersFromNotion } from '../../src/server/notionFetcher.js';

export default async () => {
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        ...fallbackPayload,
        source: 'notion-snapshot',
        note: 'Set NOTION_API_KEY in your environment variables to enable live real-time Notion API queries.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  }

  try {
    const livePayload = await fetchBlindTeasersFromNotion(apiKey);
    return new Response(JSON.stringify(livePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ...fallbackPayload,
        source: 'notion-snapshot-fallback',
        warning: error.message,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const config = {
  path: '/api/teasers',
};
