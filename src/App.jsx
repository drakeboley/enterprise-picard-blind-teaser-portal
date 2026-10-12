import React, { useEffect, useMemo, useRef, useState } from 'react';
import fallbackPayload from './data/fallbackTeasers.json';

/**
 * Parses a shorthand dollar string like "$19.2B" or "$24.0M" into numeric billions/millions for portfolio totals.
 */
function parseDollarMetricToMillions(value = '') {
  const clean = String(value).replace(/,/g, '').trim();
  const match = clean.match(/\$([\d.]+)\s*([BMK])?/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]);
  if (Number.isNaN(amount)) return 0;
  const unit = (match[2] || '').toUpperCase();
  if (unit === 'B') return amount * 1000;
  if (unit === 'M') return amount;
  if (unit === 'K') return amount / 1000;
  return amount / 1_000_000;
}

function formatMillionsAsCurrency(millions) {
  if (millions >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(1)}M`;
}

export default function App() {
  const [teasers, setTeasers] = useState(fallbackPayload.teasers || []);
  const [dataSource, setDataSource] = useState(fallbackPayload.source || 'notion-snapshot');
  const [syncedAt, setSyncedAt] = useState(fallbackPayload.syncedAt || '');
  const [syncWarning, setSyncWarning] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exclusiveMode, setExclusiveMode] = useState(false);
  const [ndaModalVenture, setNdaModalVenture] = useState(null);
  const accordionContainerRef = useRef(null);

  const syncFromNotion = async () => {
    setIsSyncing(true);
    setSyncWarning('');
    try {
      const response = await fetch(`/api/teasers?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data.teasers) && data.teasers.length > 0) {
        setTeasers(data.teasers);
        setDataSource(data.source || 'notion-live');
        setSyncedAt(data.syncedAt || new Date().toISOString());
        if (data.warning) {
          setSyncWarning(data.warning);
        }
      }
    } catch (err) {
      setDataSource('notion-snapshot');
      setSyncWarning(
        `Using pre-synced Notion snapshot (${err.message}). Configure NOTION_API_KEY for live serverless queries.`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncFromNotion();
  }, []);

  const filteredTeasers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teasers;
    return teasers.filter((item) => {
      const haystack = [
        item.codename,
        item.abstractedTitle,
        item.sector,
        item.elevatorPitch,
        item.intendedRaise,
        ...(item.tableRows || []).map((r) => `${r.field} ${r.value}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [teasers, searchQuery]);

  const portfolioTotals = useMemo(() => {
    let totalTamM = 0;
    let totalSamM = 0;
    let totalSomM = 0;
    let totalCarrM = 0;

    for (const item of teasers) {
      totalTamM += parseDollarMetricToMillions(item.metrics?.tam);
      totalSamM += parseDollarMetricToMillions(item.metrics?.sam);
      totalSomM += parseDollarMetricToMillions(item.metrics?.som);
      totalCarrM += parseDollarMetricToMillions(item.metrics?.carr);
    }

    return {
      ventureCount: teasers.length,
      tam: formatMillionsAsCurrency(totalTamM),
      sam: formatMillionsAsCurrency(totalSamM),
      som: formatMillionsAsCurrency(totalSomM),
      carr: formatMillionsAsCurrency(totalCarrM),
    };
  }, [teasers]);

  const handleExpandAll = (shouldOpen) => {
    if (shouldOpen && exclusiveMode) {
      setExclusiveMode(false);
    }
    requestAnimationFrame(() => {
      const detailsNodes =
        accordionContainerRef.current?.querySelectorAll('details.disclosure') || [];
      detailsNodes.forEach((node) => {
        node.open = shouldOpen;
      });
    });
  };

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-header__inner">
          <div className="portal-brand-row">
            <div className="portal-badge-group">
              <span className="status-pill status-pill--confidential">
                PRE-NDA CONFIDENTIAL DOSSIER
              </span>
              <span
                className={`status-pill ${
                  dataSource === 'notion-live' ? 'status-pill--live' : 'status-pill--snapshot'
                }`}
              >
                <span className="status-dot" />
                {dataSource === 'notion-live'
                  ? 'Live Notion API Connected'
                  : 'Notion Synced Snapshot'}
              </span>
            </div>

            <div className="portal-sync-actions">
              {syncedAt && (
                <span className="sync-timestamp">
                  Last synced: {new Date(syncedAt).toLocaleString()}
                </span>
              )}
              <button
                type="button"
                className="btn btn--secondary"
                onClick={syncFromNotion}
                disabled={isSyncing}
              >
                {isSyncing ? 'Syncing Notion...' : '↻ Sync from Notion'}
              </button>
            </div>
          </div>

          <h1 className="portal-title">
            Enterprise Picard — Venture Portfolio Blind Teaser Matrix
          </h1>
          <p className="portal-subtitle">
            Dynamic pre-NDA executive summaries pulled directly from each venture&apos;s{' '}
            <code>Blind Teaser &amp; Capital Metrics Summary</code> table in Notion. Select any
            codenamed project below to inspect its target raise phases, TAM, SAM, SOM, TCV, and
            5-Year CARR trajectory.
          </p>

          {syncWarning && <div className="sync-notice">{syncWarning}</div>}

          <div className="kpi-ribbon" aria-label="Aggregate Portfolio Capital Metrics">
            <div className="kpi-card">
              <span className="kpi-card__label">Active Blind Ventures</span>
              <strong className="kpi-card__value">{portfolioTotals.ventureCount}</strong>
              <span className="kpi-card__sub">Standardized EPIC-MVP Protocol</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">Combined Portfolio TAM</span>
              <strong className="kpi-card__value">{portfolioTotals.tam}</strong>
              <span className="kpi-card__sub">SAM: {portfolioTotals.sam}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">5-Year Combined SOM</span>
              <strong className="kpi-card__value">{portfolioTotals.som}</strong>
              <span className="kpi-card__sub">Risk-Adjusted Target Capture</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label">Year 5 Combined Exit CARR</span>
              <strong className="kpi-card__value">{portfolioTotals.carr}</strong>
              <span className="kpi-card__sub">$385K Phased Raise / Venture</span>
            </div>
          </div>
        </div>
      </header>

      <main className="portal-main">
        <section className="controls-bar" aria-label="Accordion and Filter Controls">
          <div className="search-input-wrap">
            <input
              type="search"
              className="search-input"
              placeholder="Filter ventures by codename, sector, TAM/CARR, or keyword (or press Ctrl+F to search inside hidden tables)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter blind teaser tables"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear
              </button>
            )}
          </div>

          <div className="accordion-controls">
            <label className="mode-toggle" title="When enabled, opening one teaser automatically collapses the others using native HTML details[name]">
              <input
                type="checkbox"
                checked={exclusiveMode}
                onChange={(e) => setExclusiveMode(e.target.checked)}
              />
              <span>Single-Open Mode</span>
            </label>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => handleExpandAll(true)}
            >
              Expand All
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => handleExpandAll(false)}
            >
              Collapse All
            </button>
          </div>
        </section>

        <section
          className="accordion-list"
          ref={accordionContainerRef}
          aria-label="Venture Blind Teaser Accordion List"
        >
          {filteredTeasers.length === 0 ? (
            <div className="empty-state">
              <p>No blind teaser tables match &ldquo;{searchQuery}&rdquo;.</p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setSearchQuery('')}
              >
                Reset Filter
              </button>
            </div>
          ) : (
            filteredTeasers.map((venture, index) => (
              <details
                key={venture.id || venture.codename}
                className="disclosure"
                name={exclusiveMode ? 'venture-blind-teaser' : undefined}
                defaultOpen={index === 0}
              >
                <summary className="disclosure__summary">
                  <div className="summary-left">
                    <div className="summary-codename-row">
                      <span className="codename-badge">{venture.codename}</span>
                      <span className="sector-tag">{venture.sector}</span>
                    </div>
                    <h2 className="summary-title">{venture.abstractedTitle}</h2>
                    <p className="summary-pitch-preview">{venture.elevatorPitch}</p>
                  </div>

                  <div className="summary-right">
                    <div className="metric-chips">
                      <div className="metric-chip">
                        <span className="metric-chip__label">TAM</span>
                        <span className="metric-chip__val">{venture.metrics?.tam}</span>
                      </div>
                      <div className="metric-chip">
                        <span className="metric-chip__label">SAM</span>
                        <span className="metric-chip__val">{venture.metrics?.sam}</span>
                      </div>
                      <div className="metric-chip">
                        <span className="metric-chip__label">SOM</span>
                        <span className="metric-chip__val">{venture.metrics?.som}</span>
                      </div>
                      <div className="metric-chip metric-chip--highlight">
                        <span className="metric-chip__label">Y5 CARR</span>
                        <span className="metric-chip__val">{venture.metrics?.carr}</span>
                      </div>
                    </div>
                    <span className="disclosure-chevron" aria-hidden="true" />
                  </div>
                </summary>

                <div className="disclosure__content">
                  <div className="teaser-table-wrapper">
                    <table className="teaser-table">
                      <thead>
                        <tr>
                          <th scope="col" className="col-dimension">
                            Metric / Dimension
                          </th>
                          <th scope="col" className="col-spec">
                            Blind Teaser Specification (Synced from Notion)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(venture.tableRows || []).map((row) => (
                          <tr key={row.field}>
                            <th scope="row" className="cell-dimension">
                              {row.field}
                            </th>
                            <td className="cell-spec">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="disclosure__footer">
                    <div className="notion-meta">
                      <span className="notion-meta__badge">Notion Page ID:</span>
                      <code>{venture.id}</code>
                    </div>
                    <div className="disclosure__cta-group">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setNdaModalVenture(venture)}
                      >
                        Request Bilateral NDA to Unlock Full Data Room →
                      </button>
                    </div>
                  </div>
                </div>
              </details>
            ))
          )}
        </section>
      </main>

      {ndaModalVenture && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nda-modal-title"
          onClick={() => setNdaModalVenture(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <span className="codename-badge">{ndaModalVenture.codename}</span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setNdaModalVenture(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <h3 id="nda-modal-title" className="modal-card__title">
              Execute Bilateral NDA for {ndaModalVenture.codename}
            </h3>
            <p className="modal-card__desc">
              Full technical architecture, unredacted brand identity, 5-year financial model, and
              Post-Money SAFE ($3.5M Cap / 20% Discount) offering documents for{' '}
              <strong>{ndaModalVenture.abstractedTitle}</strong> are gated behind a mutual
              non-disclosure covenant.
            </p>
            <div className="modal-card__summary-box">
              <div>
                <span>Target Seed Raise:</span>
                <strong>$350,000 Post-Money SAFE ($385K Total Phased)</strong>
              </div>
              <div>
                <span>TAM / SOM / Y5 CARR:</span>
                <strong>
                  {ndaModalVenture.metrics?.tam} / {ndaModalVenture.metrics?.som} /{' '}
                  {ndaModalVenture.metrics?.carr}
                </strong>
              </div>
            </div>
            <div className="modal-card__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setNdaModalVenture(null)}
              >
                Cancel
              </button>
              <a
                className="btn btn--primary"
                href={`mailto:ventures@enterprisepicard.io?subject=${encodeURIComponent(
                  `Bilateral NDA Request — ${ndaModalVenture.codename} (${ndaModalVenture.id})`
                )}&body=${encodeURIComponent(
                  `Please issue the bilateral NDAme execution link to unlock the full Notion Data Room for ${ndaModalVenture.abstractedTitle} (Notion Teaser ID: ${ndaModalVenture.id}).`
                )}`}
              >
                Dispatch NDA Execution Link via Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
