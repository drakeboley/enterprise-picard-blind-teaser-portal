const NOTION_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

/**
 * Extracts plain text from an array of Notion rich_text objects.
 */
function plainTextFromRichText(richTextArray = []) {
  return richTextArray.map((item) => item?.plain_text || '').join('').trim();
}

/**
 * Extracts a short headline value (e.g. "$19.2B" or "$5.41M") from a verbose Notion metric cell.
 */
function extractShortMetric(rawText = '', metricType = '') {
  if (!rawText) return '—';

  if (metricType === 'carr') {
    const year5Match = rawText.match(/\$([\d.,]+)\s*(Million|Billion|M|B)\s*\(Year 5/i);
    if (year5Match) {
      const unit = year5Match[2].toLowerCase().startsWith('b') ? 'B' : 'M';
      return `$${year5Match[1]}${unit}`;
    }
    const allDollarMatches = [...rawText.matchAll(/\$([\d,]+(?:\.\d+)?)/g)];
    if (allDollarMatches.length > 0) {
      const lastRaw = allDollarMatches[allDollarMatches.length - 1][1].replace(/,/g, '');
      const numeric = Number.parseFloat(lastRaw);
      if (!Number.isNaN(numeric) && numeric >= 1_000_000) {
        return `$${(numeric / 1_000_000).toFixed(2)}M`;
      }
    }
  }

  if (metricType === 'tcv') {
    const rangeMatch = rawText.match(/(\$[\d,]+\s*[–-]\s*\$[\d,]+)/);
    if (rangeMatch) return rangeMatch[1];
    const twoPrices = [...rawText.matchAll(/\$[\d,]+/g)];
    if (twoPrices.length >= 2) {
      return `${twoPrices[0][0]} – ${twoPrices[1][0]}`;
    }
  }

  const billionMatch = rawText.match(/\$([\d.,]+)\s*Billion/i);
  if (billionMatch) return `$${billionMatch[1]}B`;

  const millionMatch = rawText.match(/\$([\d.,]+)\s*Million/i);
  if (millionMatch) return `$${millionMatch[1]}M`;

  const firstCurrency = rawText.match(/\$[\d,.]+[BMK]?/i);
  return firstCurrency ? firstCurrency[0] : rawText.slice(0, 24);
}

/**
 * Fetches JSON from the Notion REST API.
 */
async function notionRequest(path, { method = 'GET', body, apiKey }) {
  const response = await fetch(`${NOTION_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Notion API ${method} ${path} failed (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Parses a single Notion "Blind Teaser & Capital Metrics Summary" page into a sanitized Blind Teaser object.
 * Internal application names in the Notion page title are deliberately stripped server-side.
 */
async function parseTeaserPage(page, apiKey) {
  const pageId = page.id;
  const blocksData = await notionRequest(`/blocks/${pageId}/children?page_size=100`, { apiKey });
  const blocks = blocksData.results || [];

  const tableBlock = blocks.find((b) => b.type === 'table');
  if (!tableBlock) {
    return null;
  }

  const rowsData = await notionRequest(`/blocks/${tableBlock.id}/children?page_size=100`, { apiKey });
  const rowBlocks = (rowsData.results || []).filter((b) => b.type === 'table_row');

  const tableRows = [];
  for (let i = 0; i < rowBlocks.length; i += 1) {
    const cells = rowBlocks[i].table_row?.cells || [];
    const field = plainTextFromRichText(cells[0]);
    const value = plainTextFromRichText(cells[1]);

    // Skip the markdown table header row ("Metric / Dimension" | "Blind Teaser Specification")
    if (i === 0 && /metric\s*\/\s*dimension/i.test(field)) {
      continue;
    }
    if (field || value) {
      tableRows.push({ field, value });
    }
  }

  const findRowValue = (pattern) => {
    const row = tableRows.find((r) => pattern.test(r.field));
    return row ? row.value : '';
  };

  const abstractedTitle =
    findRowValue(/abstracted|vague project title/i) || 'Confidential Venture Project';
  const codenameMatch = abstractedTitle.match(/^(Project\s+[A-Za-z0-9]+)/i);
  const codename = codenameMatch ? codenameMatch[1] : abstractedTitle.split('—')[0].trim();

  const subtitleParts = abstractedTitle.split('—');
  const sector = subtitleParts[1] ? subtitleParts[1].trim() : 'Autonomous Enterprise Venture';

  const elevatorPitch = findRowValue(/elevator pitch/i);
  const intendedRaise = findRowValue(/intended raise/i);
  const tamRaw = findRowValue(/\bTAM\b/i);
  const samRaw = findRowValue(/\bSAM\b/i);
  const somRaw = findRowValue(/\bSOM\b/i);
  const tcvRaw = findRowValue(/\bTCV\b/i);
  const carrRaw = findRowValue(/\bCARR\b/i);

  return {
    id: pageId,
    codename,
    abstractedTitle,
    sector,
    status: 'Pre-NDA Blind Teaser',
    elevatorPitch,
    intendedRaise,
    metrics: {
      tam: extractShortMetric(tamRaw, 'tam'),
      sam: extractShortMetric(samRaw, 'sam'),
      som: extractShortMetric(somRaw, 'som'),
      tcv: extractShortMetric(tcvRaw, 'tcv'),
      carr: extractShortMetric(carrRaw, 'carr'),
    },
    tableRows,
  };
}

/**
 * Dynamically searches Notion for all "Blind Teaser & Capital Metrics Summary" pages
 * and returns a sanitized array of Blind Teaser records sorted by codename.
 */
export async function fetchBlindTeasersFromNotion(apiKey) {
  if (!apiKey) {
    throw new Error('NOTION_API_KEY is not configured');
  }

  const searchData = await notionRequest('/search', {
    method: 'POST',
    apiKey,
    body: {
      query: 'Blind Teaser & Capital Metrics Summary',
      filter: {
        property: 'object',
        value: 'page',
      },
      page_size: 50,
    },
  });

  const candidatePages = (searchData.results || []).filter((page) => {
    if (page.archived || page.in_trash) return false;
    const titleProp =
      page.properties?.title?.title ||
      page.properties?.Name?.title ||
      Object.values(page.properties || {}).find((p) => p?.type === 'title')?.title ||
      [];
    const titleText = plainTextFromRichText(titleProp);
    return /Blind Teaser\s*&\s*Capital Metrics Summary/i.test(titleText);
  });

  const parsedTeasers = await Promise.all(
    candidatePages.map((page) => parseTeaserPage(page, apiKey).catch(() => null))
  );

  const validTeasers = parsedTeasers
    .filter(Boolean)
    .sort((a, b) => a.codename.localeCompare(b.codename));

  return {
    source: 'notion-live',
    syncedAt: new Date().toISOString(),
    portfolioMasterPageId:
      process.env.NOTION_MASTER_MATRIX_PAGE_ID || '3f7fff10-6abc-81d9-9e3a-de2c7f074ac7',
    teasers: validTeasers,
  };
}
