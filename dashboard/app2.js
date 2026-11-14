(function () {
  'use strict';

  const radar = window.RADAR;
  const mount = document.getElementById('board');
  if (!radar || !mount) return;

  const view = {
    query: '',
    category: 'all',
    universe: 'pre',
    sortKey: 'value',
    descending: true,
    page: 0,
    pageSize: 25
  };
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value == null ? '' : String(value);
    if (className) node.className = className;
    return node;
  }

  function node(tag, className, children) {
    if (Array.isArray(className) && children === undefined) {
      children = className;
      className = '';
    }
    const element = document.createElement(tag);
    if (className) element.className = className;
    (children || []).forEach(child => {
      if (child) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
  }

  function button(label, action, className) {
    const control = text('button', label, className || '');
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }

  function formatMoney(amount) {
    if (!Number.isFinite(amount)) return '—';
    if (amount >= 1e9) return '$' + (amount / 1e9).toFixed(2) + 'B';
    if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
    if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
    return currency.format(amount);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '—';
    return (value > 0 ? '+' : '') + value.toFixed(2) + '%';
  }

  function formatAge(days) {
    if (!Number.isFinite(days)) return 'unknown';
    return days >= 365 ? (days / 365).toFixed(1) + 'y' : days + 'd';
  }

  function currentRows() {
    const needle = view.query.trim().toLowerCase();
    return radar.rows.filter(row => {
      if (view.category !== 'all' && (row.category || 'Other') !== view.category) return false;
      if (!needle) return true;
      const searchable = [row.name, row.slug, row.category, (row.chains || []).join(' ')];
      return searchable.join(' ').toLowerCase().includes(needle);
    });
  }

  function sortValue(row) {
    if (view.sortKey === 'name') return String(row.name || '').toLowerCase();
    if (view.sortKey === 'tvl') return Number(row.tvl_usd) || 0;
    if (view.sortKey === 'growth') return row.change_7d == null ? -Infinity : Number(row.change_7d);
    if (view.sortKey === 'age') return row.age_days == null ? Infinity : Number(row.age_days);
    if (view.sortKey === 'marketCap') return Number(row.mcap_usd) || 0;
    return Number(row.implied_value_usd ?? row.mcap_usd) || 0;
  }

  function sortedRows(rows) {
    return rows.slice().sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      const base = left < right ? -1 : left > right ? 1 : a.slug.localeCompare(b.slug);
      return base * (view.descending ? -1 : 1);
    });
  }

  function heading() {
    const mast = node('header', 'mast');
    const brand = node('div', 'brand', [text('i', '', 'sig'), text('b', 'SIGNAL / RADAR')]);
    const date = text('div', 'SEALED SNAPSHOT · ' + radar.meta.as_of, 'live-ind');
    mast.append(brand, date);
    return mast;
  }

  function hero() {
    const leader = radar.rows[0];
    const copy = node('div', '', [
      text('div', 'PRE-TOKEN INTELLIGENCE · ' + radar.meta.model_version, 'kicker'),
      text('h1', 'Find the next protocol worth watching.'),
      text('p', 'Ranked implied launch value from a sealed snapshot. Peer-calibrated, not a prediction; each estimate traces to TVL, momentum, tenure and chain footprint.')
    ]);
    const value = node('div', 'hero-stat', [
      text('strong', formatMoney(leader && leader.implied_value_usd)),
      text('span', 'Top implied value · ' + (leader ? leader.name : 'No rows') + ' · estimate, not market price')
    ]);
    return node('section', 'hero', [copy, value]);
  }

  function metricStrip() {
    const values = [
      ['WATCHLIST COVERED', radar.meta.watchlist_size + ' / ' + radar.meta.watchlist_size],
      ['PRE-TOKEN RANKED', radar.rows.length],
      ['BELOW-FLOOR DISCOVERIES', radar.meta.early_size],
      ['LIVE TOKENS SEPARATE', radar.live.length]
    ];
    return node('section', 'metrics', values.map(([label, value]) => node('div', 'metric', [
      text('b', value), text('span', label)
    ])));
  }

  function makeSearch() {
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search protocol, chain, category';
    input.setAttribute('aria-label', 'Search protocols');
    input.value = view.query;
    input.addEventListener('input', () => {
      view.query = input.value;
      view.page = 0;
      draw();
    });
    return input;
  }

  function makeCategoryFilter() {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Filter category');
    const all = text('option', 'All categories');
    all.value = 'all';
    select.appendChild(all);
    [...new Set(radar.rows.map(row => row.category || 'Other'))].sort().forEach(category => {
      const option = text('option', category);
      option.value = category;
      select.appendChild(option);
    });
    select.value = view.category;
    select.addEventListener('change', () => {
      view.category = select.value;
      view.page = 0;
      draw();
    });
    return select;
  }

  function setUniverse(name) {
    view.universe = name;
    view.page = 0;
    draw();
  }

  function toolbar() {
    const tabs = node('div', 'segment', [
      button('Pre-token', () => setUniverse('pre')),
      button('Live tokens', () => setUniverse('live'))
    ]);
    tabs.children[0].setAttribute('aria-pressed', String(view.universe === 'pre'));
    tabs.children[1].setAttribute('aria-pressed', String(view.universe === 'live'));
    const count = view.universe === 'pre' ? currentRows().length + ' candidates' : radar.live.length + ' live-token references';
    return node('div', 'toolbar', [
      node('div', 'field', [text('label', 'Find a protocol'), makeSearch()]),
      node('div', 'field', [text('label', 'Sector'), makeCategoryFilter()]),
      node('div', 'field', [text('span', 'Universe', 'label'), tabs]),
      text('span', count, 'result-count')
    ]);
  }

  function sortControl(key, label) {
    const indicator = view.sortKey === key ? (view.descending ? ' ↓' : ' ↑') : '';
    const control = button(label + indicator, () => {
      if (view.sortKey === key) view.descending = !view.descending;
      else { view.sortKey = key; view.descending = true; }
      draw();
    });
    return node('th', '', [control]);
  }

  function tableHead(live) {
    if (live) return node('thead', '', [node('tr', '', [
      text('th', '—'), sortControl('name', 'Protocol'), sortControl('tvl', 'TVL'),
      sortControl('growth', '7D'), sortControl('marketCap', 'MARKET CAP'), text('th', 'STATUS')
    ])]);
    return node('thead', '', [node('tr', '', [
      text('th', '#'), sortControl('name', 'Protocol'), sortControl('tvl', 'TVL'),
      sortControl('growth', '7D TVL'), sortControl('age', 'TENURE'),
      sortControl('value', 'IMPLIED VALUE'), text('th', 'STATUS')
    ])]);
  }

  function openDetail(row) {
    if (view.universe === 'live') return;
    document.querySelectorAll('.detail, .veil').forEach(item => item.remove());
    const veil = node('div', 'veil');
    veil.addEventListener('click', closeDetail);
    document.body.appendChild(veil);
    document.body.appendChild(detailPanel(row));
    window.addEventListener('keydown', escapeDetail);
  }

  function closeDetail() {
    document.querySelectorAll('.detail, .veil').forEach(item => item.remove());
    window.removeEventListener('keydown', escapeDetail);
  }

  function escapeDetail(event) {
    if (event.key === 'Escape') closeDetail();
  }

  function detailPanel(row) {
    const title = node('div', 'detail-head', [
      node('div', '', [
        text('div', 'RADAR RANK ' + row.rank + ' / ' + radar.rows.length, 'detail-kicker'),
        text('h2', row.name),
        text('div', (row.category || 'Other') + ' · ' + ((row.chains || []).join(', ') || 'chain n/a'), 'sub')
      ]),
      button('×', closeDetail, 'close')
    ]);
    title.lastChild.setAttribute('aria-label', 'Close details');
    const peerText = row.peer_multiple + '× · ' + row.confidence + ' · n=' + row.peer_sample_size + ' ' + row.peer_group + ' peers · clip ' + row.peer_clip_range[0] + '–' + row.peer_clip_range[1] + '×';
    const metrics = [
      ['Peer multiple / sample', peerText],
      ['TVL', formatMoney(row.tvl_usd)],
      ['7d growth factor', row.growth_multiplier + '× · ' + formatPercent(row.change_7d)],
      ['Maturity factor', row.maturity_multiplier + '× · ' + formatAge(row.age_days)],
      ['Chain breadth factor', row.breadth_multiplier + '× · ' + (row.chains || []).length + ' chains']
    ];
    const valueBlock = node('section', 'detail-value', [
      text('div', 'MODEL-IMPLIED VALUE', 'label'), text('strong', formatMoney(row.implied_value_usd)),
      metrics.map(([label, value]) => node('div', '', [text('span', label), text('b', value)]))
    ]);
    const plan = node('ol', '', (row.farm_steps || []).slice(0, 6).map(step => {
      const splitAt = step.indexOf(' Cost: ');
      return node('li', '', [
        text('span', splitAt < 0 ? step : step.slice(0, splitAt)),
        text('small', splitAt < 0 ? '' : step.slice(splitAt + 1), 'step-cost')
      ]);
    }));
    return node('aside', 'detail', [
      title, valueBlock, text('h3', 'Practical farm research plan'), plan,
      text('div', 'No points or airdrop is verified by this snapshot. Confirm eligibility, risks and contract addresses through official channels before committing funds.', 'notice')
    ]);
  }

  function rowElement(row, live) {
    const cells = [
      text('td', live ? 'LIVE' : row.rank, 'rank'),
      node('td', 'protocol', [text('b', row.name), text('span', (row.category || 'Other') + ' · ' + ((row.chains || []).slice(0, 3).join(', ') || 'chain n/a'), 'sub')]),
      text('td', formatMoney(row.tvl_usd), 'mono'),
      text('td', formatPercent(row.change_7d), 'mono ' + (row.change_7d >= 0 ? 'up' : 'down')),
      text('td', live ? '—' : formatAge(row.age_days), 'mono'),
      text('td', formatMoney(live ? row.mcap_usd : row.implied_value_usd), 'mono value'),
      node('td', '', [text('span', live ? 'market token' : 'no token on record', 'tag ' + (live ? '' : 'pre'))])
    ];
    const item = node('tr', cells);
    if (!live) {
      item.tabIndex = 0;
      item.addEventListener('click', () => openDetail(row));
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(row); }
      });
    }
    return item;
  }

  function pager(rows, pageCount) {
    const status = text('span', 'PAGE ' + (view.page + 1) + ' / ' + pageCount + ' · ' + rows.length + ' RECORDS');
    const previous = button('←', () => { view.page -= 1; draw(); });
    previous.setAttribute('aria-label', 'Previous page');
    previous.disabled = view.page === 0;
    const next = button('→', () => { view.page += 1; draw(); });
    next.setAttribute('aria-label', 'Next page');
    next.disabled = view.page >= pageCount - 1;
    return node('div', 'pager', [status, node('div', '', [previous, next])]);
  }

  function board() {
    const live = view.universe === 'live';
    const allRows = sortedRows(live ? radar.live : currentRows());
    const pageCount = Math.max(1, Math.ceil(allRows.length / view.pageSize));
    view.page = Math.min(view.page, pageCount - 1);
    const visible = allRows.slice(view.page * view.pageSize, (view.page + 1) * view.pageSize);
    if (!visible.length) return text('div', 'No matches. Clear the search or sector filter.', 'empty');
    const table = node('table', '', [tableHead(live), node('tbody', '', visible.map(row => rowElement(row, live)))]);
    return node('section', '', [node('div', 'table-scroll', [table]), pager(allRows, pageCount)]);
  }

  function modelNotes() {
    return node('section', '', [
      node('div', 'section-title', [text('h2', 'How the estimate is built'), text('span', 'ROBUST PEER MODEL · NO NAME LOOKUPS')]),
      node('div', 'method', [
        node('div', '', [
          text('div', 'VALUE ENGINE', 'label'),
          text('div', 'TVL × comparable-sector median (mcap / TVL)', 'formula'),
          text('p', 'Token peers are grouped by sector; wrapped, staked, versioned and exchange rows are excluded. Ratios are clipped to 0.25–4× the peer median. Thin groups use a clipped broad-market median; momentum, tenure and chain breadth are bounded adjustments.')
        ]),
        node('div', '', [
          text('div', 'LIMITS', 'label'),
          text('p', 'A scenario estimate, not a future price or token-launch forecast. No token recorded is not proof none exists. Farm steps are research prompts, not evidence of points or an airdrop.'),
          text('p', 'Snapshot source: ' + radar.meta.source, 'sub')
        ])
      ])
    ]);
  }

  function footer() {
    return node('footer', 'foot', [text('span', 'SIGNAL / TOKEN LAUNCH RADAR'), text('span', 'SEALED DATA · ' + radar.meta.as_of + ' · ' + radar.meta.model_version)]);
  }

  function draw() {
    mount.replaceChildren();
    const shell = node('div', 'shell', [heading(), hero(), metricStrip(), toolbar(), board()]);
    if (view.universe === 'pre') shell.appendChild(modelNotes());
    shell.appendChild(footer());
    mount.appendChild(shell);
    mount.setAttribute('aria-busy', 'false');
  }

  draw();
})();
