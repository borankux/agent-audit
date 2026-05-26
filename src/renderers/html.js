// DevAura HTML Report — Developer Identity Card + Intelligence Dashboard
import { fmtTok } from '../formatters.js';

const DIM_META = [
  { id: 'envHealth',      label: 'Env Health',        icon: '🏗', color: '#34d399' },
  { id: 'aiWorkflow',     label: 'AI Workflow',        icon: '🤖', color: '#8b5cf6' },
  { id: 'toolchainDepth', label: 'Toolchain',          icon: '🔧', color: '#22d3ee' },
  { id: 'verification',   label: 'Verification',       icon: '✅', color: '#fbbf24' },
  { id: 'automation',     label: 'Automation',         icon: '⚡', color: '#f97316' },
  { id: 'security',       label: 'Security',           icon: '🔒', color: '#fb7185' },
];

const DEPTH_STYLES = {
  deep:        { color: '#34d399', opacity: 1,    lineOpacity: 0.4, fontWeight: 600, glow: true  },
  config:      { color: '#fbbf24', opacity: 0.8,  lineOpacity: 0.2, fontWeight: 400, glow: false },
  detect:      { color: '#64748b', opacity: 0.5,  lineOpacity: 0.08, fontWeight: 400, glow: false },
  unsupported: { color: '#fb7185', opacity: 0.6,  lineOpacity: 0.15, fontWeight: 400, glow: false },
};

export function renderHtml(report) {
  const { auraScore, confidence, dimensions, developerType, powerScores, badges, recommendations, evidences, sessions, scanMeta } = report;
  const ps = powerScores || {};
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const runtimes = evidences.filter(e => e.category === 'runtime' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const infras = evidences.filter(e => e.category === 'infra' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const shells = evidences.filter(e => e.category === 'shell');
  const ides = evidences.filter(e => e.category === 'ide' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const unsupported = evidences.filter(e => e.depth === 'unsupported');

  // Token aggregation — include cache tokens
  let totalTokens = 0, totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreation = 0;
  const tokenByAgent = {};
  const tokenDetailsByAgent = {};
  if (sessions) {
    for (const [name, s] of Object.entries(sessions)) {
      if (!s?.tokensAll) continue;
      const inp = s.tokensAll.input || 0;
      const out = s.tokensAll.output || 0;
      const cr = s.tokensAll.cacheRead || s.tokensAll.cache || 0;
      const cc = s.tokensAll.cacheCreation || 0;
      const t = inp + out + cr + cc;
      if (t > 0) {
        totalTokens += t; totalInput += inp; totalOutput += out; totalCacheRead += cr; totalCacheCreation += cc;
        tokenByAgent[name] = t;
        tokenDetailsByAgent[name] = { input: inp, output: out, cacheRead: cr, cacheCreation: cc, totalBilled: s.tokensAll.totalBilled || t };
      }
    }
  }

  // Main weapon / secondary / weakness
  const deepAgents = aiAgents.filter(a => a.depth === 'deep');
  const mainWeapon = deepAgents.length ? deepAgents[0].source : aiAgents.length ? aiAgents[0].source : 'None';
  const secondaryWeapon = deepAgents.length >= 2 ? deepAgents[1].source : aiAgents.length >= 2 ? aiAgents[1].source : null;
  const weakness = findWeakness(dimensions);
  const specialSkill = badges.length ? badges[0].label : 'None';

  // Truncation warning
  const hasTruncation = scanMeta?.scannedAgents?.some(a => a.skipped);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevAura Report</title>
<style>${CSS()}</style>
</head>
<body>
<div class="page-bg"></div>
<div class="container">

  ${hasTruncation ? `<div class="warning-banner">⚠ Usage may be undercounted — session data was truncated. Run with <code>--full</code> for complete scan.</div>` : ''}

  <!-- ═══ HERO: Developer Identity Card ═══ -->
  <section class="hero-card">
    <div class="hero-top">
      <span class="devo-badge">DevAura</span>
      <span class="hero-privacy">Local-first · Nothing uploaded</span>
    </div>
    <div class="hero-body">
      <div class="hero-left">
        <div class="hero-subtitle">Developer Intelligence Profile</div>
        <h1 class="hero-type">${esc(developerType.type)}</h1>
        <div class="hero-meta">
          <span class="rank-pill">${esc(developerType.rank)}</span>
          <span class="hero-conf">Confidence: ${esc(confidence)}</span>
        </div>
        <div class="hero-scores">
          <div class="score-pill aura"><span class="sp-val">${auraScore}</span><span class="sp-label">Aura Score</span></div>
          ${ps.aiPowerScore !== undefined ? `<div class="score-pill power"><span class="sp-val">${ps.aiPowerScore}</span><span class="sp-label">AI Power</span></div>` : ''}
          ${ps.primaryAgentPowerScore?.score ? `<div class="score-pill agent"><span class="sp-val">${ps.primaryAgentPowerScore.score}</span><span class="sp-label">${esc(ps.primaryAgentPowerScore.agent || 'Agent')} Power</span></div>` : ''}
        </div>
        <div class="hero-weapons">
          <div class="weapon"><span class="weapon-label">Main Weapon</span><span class="weapon-val">${esc(mainWeapon)}</span></div>
          ${secondaryWeapon ? `<div class="weapon"><span class="weapon-label">Secondary</span><span class="weapon-val">${esc(secondaryWeapon)}</span></div>` : ''}
          <div class="weapon"><span class="weapon-label">Special Skill</span><span class="weapon-val">${esc(specialSkill)}</span></div>
          ${weakness ? `<div class="weapon weapon-weak"><span class="weapon-label">Weakness</span><span class="weapon-val">${esc(weakness)}</span></div>` : ''}
        </div>
      </div>
      <div class="hero-right">
        ${auraRing(auraScore, dimensions)}
      </div>
    </div>
    ${badges.length ? `<div class="hero-badges">${badges.slice(0, 5).map(b => `<span class="hbadge" style="border-color:${b.rarity.color}">${b.icon} ${esc(b.label)}</span>`).join('')}</div>` : ''}
  </section>

  <!-- ═══ CAPABILITY MATRIX: Radar Chart ═══ -->
  <section class="section-grid">
    <div class="card card-radar">
      <div class="card-header"><span class="card-dot" style="background:#8b5cf6"></span>Capability Matrix</div>
      ${radarChart(dimensions)}
    </div>
    <div class="card card-dims">
      <div class="card-header"><span class="card-dot" style="background:#22d3ee"></span>Dimension Scores</div>
      <div class="dim-list">
        ${DIM_META.map(d => {
          const ds = dimensions[d.id];
          if (!ds || ds.status !== 'scored') return '';
          const v = ds.score;
          return `<div class="dim-row">
            <span class="dim-icon">${d.icon}</span>
            <span class="dim-label">${d.label}</span>
            <div class="dim-bar-bg"><div class="dim-bar-fill" style="width:${v}%;background:${d.color}"></div></div>
            <span class="dim-score" style="color:${d.color}">${v}</span>
            <span class="dim-conf">${ds.confidence}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>

  <!-- ═══ AGENT CONSTELLATION ═══ -->
  <section class="card">
    <div class="card-header"><span class="card-dot" style="background:#8b5cf6"></span>AI Agent Constellation</div>
    ${agentConstellation(aiAgents)}
    ${unsupported.length ? `<div class="unsupported-list">
      <div class="card-header" style="margin-top:16px"><span class="card-dot" style="background:#fb7185"></span>Detected but Unsupported</div>
      ${unsupported.map(a => `<div class="unsupported-item"><span class="ui-name">${esc(a.source)}</span><span class="ui-badge">Not included in score</span></div>`).join('')}
    </div>` : ''}
  </section>

  <!-- ═══ POWER USER EVIDENCE ═══ -->
  ${renderPowerUserEvidence(sessions, evidences)}

  <!-- ═══ TOOLCHAIN MAP ═══ -->
  <section class="section-grid">
    <div class="card">
      <div class="card-header"><span class="card-dot" style="background:#34d399"></span>Technology Stack</div>
      <div class="stack-groups">
        ${stackGroup('Languages', runtimes.map(e => {
          const ver = e.metrics?.langVersions?.evidence?.[0] || '';
          return `${e.source}${ver ? ' ' + ver : ''}`;
        }))}
        ${stackGroup('Editors', ides.flatMap(e => e.metrics?.ideDetected?.evidence || []))}
        ${stackGroup('AI Layer', aiAgents.map(a => a.source))}
        ${stackGroup('Infra', infras.map(e => e.source))}
        ${stackGroup('Shell', shells.flatMap(e => e.metrics?.shellPlugins?.evidence || []).slice(0, 6))}
      </div>
    </div>
    ${totalTokens > 0 ? tokenBreakdownCard(tokenDetailsByAgent, totalTokens, totalInput, totalOutput, totalCacheRead, totalCacheCreation) : ''}
  </section>

  <!-- ═══ BADGE WALL ═══ -->
  ${badges.length ? `<section class="card">
    <div class="card-header"><span class="card-dot" style="background:#fbbf24"></span>Badge Wall</div>
    <div class="badge-grid">
      ${badges.map(b => `<div class="game-badge" style="border-color:${b.rarity.color};box-shadow:${b.rarity.glow}">
        <span class="gb-icon">${b.icon}</span>
        <span class="gb-label">${esc(b.label)}</span>
        <span class="gb-rarity" style="color:${b.rarity.color}">${b.rarity.label}</span>
      </div>`).join('')}
    </div>
  </section>` : ''}

  <!-- ═══ RECOMMENDATIONS ═══ -->
  ${recommendations.length ? `<section class="card">
    <div class="card-header"><span class="card-dot" style="background:#fb7185"></span>Recommendations</div>
    <ul class="recs">${recommendations.slice(0, 5).map(r => `<li><span class="rec-num">${r.priority}</span>${esc(r.text)}</li>`).join('')}</ul>
  </section>` : ''}

  <footer>DevAura Report · Review before sharing · Local-first</footer>
</div>
</body>
</html>`;
  return html;
}

// ── Power User Evidence Section ──────────────────
function renderPowerUserEvidence(sessions, evidences) {
  if (!sessions || !Object.keys(sessions).length) return '';

  // Aggregate all session data
  const agg = { sessions: 0, activeDays: 0, first: null, last: null, fileEdits: 0, commandRuns: 0, testCommands: 0, buildCommands: 0, lintCommands: 0, typecheckCommands: 0, toolCalls: 0, tools: new Set(), skills: new Set(), agentTypes: new Set(), mcpServers: new Set(), models: new Set() };
  const tok = { '7d': { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }, '30d': { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }, all: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, totalBilled: 0, totalContext: 0 } };
  const hourlyAgg = new Array(24).fill(0);
  const dailyAgg = {};

  for (const s of Object.values(sessions)) {
    if (!s) continue;
    agg.sessions += s.sessionCount || 0;
    agg.activeDays += s.activeDays || 0;
    agg.fileEdits += s.fileEdits || 0;
    agg.commandRuns += s.commandRuns || 0;
    agg.testCommands += s.testCommands || 0;
    agg.buildCommands += s.buildCommands || 0;
    agg.lintCommands += s.lintCommands || 0;
    agg.typecheckCommands += s.typecheckCommands || 0;
    agg.toolCalls += s.toolCalls || 0;
    if (s.first && (!agg.first || s.first < agg.first)) agg.first = s.first;
    if (s.last && (!agg.last || s.last > agg.last)) agg.last = s.last;
    for (const t of (s.tools || [])) agg.tools.add(t);
    for (const sk of (s.skills || [])) agg.skills.add(sk);
    for (const at of (s.agentTypes || [])) agg.agentTypes.add(at);
    for (const m of (s.mcpServers || [])) agg.mcpServers.add(m);
    for (const m of (s.models || [])) agg.models.add(m);

    for (const p of ['7d', '30d', 'all']) {
      const sk = p === '7d' ? s.tokens7d : p === '30d' ? s.tokens30d : s.tokensAll;
      if (!sk) continue;
      tok[p].input += sk.input || 0;
      tok[p].output += sk.output || 0;
      tok[p].cacheRead += sk.cacheRead || sk.cache || 0;
      tok[p].cacheCreation += sk.cacheCreation || 0;
    }
    tok.all.totalBilled += s.tokensAll?.totalBilled || 0;
    tok.all.totalContext += s.tokensAll?.totalContext || 0;

    if (s.hourlyCounts) for (let i = 0; i < 24; i++) hourlyAgg[i] += s.hourlyCounts[i] || 0;
    if (s.dailyTokens) for (const [d, v] of Object.entries(s.dailyTokens)) dailyAgg[d] = (dailyAgg[d] || 0) + v;
  }

  const totalAll = tok.all.input + tok.all.output + tok.all.cacheRead + tok.all.cacheCreation;

  // Hourly heatmap
  const maxH = Math.max(...hourlyAgg, 1);
  const heatmapSvg = renderHeatmap(hourlyAgg, maxH);

  // Daily chart (last 30 days)
  const dailyChart = renderDailyChart(dailyAgg);

  return `<section class="card">
    <div class="card-header"><span class="card-dot" style="background:#8b5cf6"></span>Power User Evidence</div>
    <div class="evidence-grid">
      <div class="ev-item"><span class="ev-label">Sessions</span><span class="ev-val">${fmtTok(agg.sessions)}</span></div>
      <div class="ev-item"><span class="ev-label">Active Days</span><span class="ev-val">${agg.activeDays}</span></div>
      <div class="ev-item"><span class="ev-label">First Active</span><span class="ev-val">${agg.first || '—'}</span></div>
      <div class="ev-item"><span class="ev-label">Last Active</span><span class="ev-val">${agg.last || '—'}</span></div>
      <div class="ev-item"><span class="ev-label">Tool Calls</span><span class="ev-val">${fmtTok(agg.toolCalls)}</span></div>
      <div class="ev-item"><span class="ev-label">Unique Tools</span><span class="ev-val">${agg.tools.size}</span></div>
      <div class="ev-item"><span class="ev-label">File Edits</span><span class="ev-val">${fmtTok(agg.fileEdits)}</span></div>
      <div class="ev-item"><span class="ev-label">Command Runs</span><span class="ev-val">${fmtTok(agg.commandRuns)}</span></div>
      <div class="ev-item"><span class="ev-label">Test Commands</span><span class="ev-val">${agg.testCommands}</span></div>
      <div class="ev-item"><span class="ev-label">Build Commands</span><span class="ev-val">${agg.buildCommands}</span></div>
      <div class="ev-item"><span class="ev-label">Lint Commands</span><span class="ev-val">${agg.lintCommands}</span></div>
      <div class="ev-item"><span class="ev-label">Typecheck</span><span class="ev-val">${agg.typecheckCommands}</span></div>
      <div class="ev-item"><span class="ev-label">Skills Invoked</span><span class="ev-val">${agg.skills.size}</span></div>
      <div class="ev-item"><span class="ev-label">Agent Types</span><span class="ev-val">${agg.agentTypes.size}</span></div>
      <div class="ev-item"><span class="ev-label">MCP Servers</span><span class="ev-val">${agg.mcpServers.size}</span></div>
      <div class="ev-item"><span class="ev-label">Models Used</span><span class="ev-val">${agg.models.size}</span></div>
    </div>

    <div class="token-periods">
      <div class="tp-header"><span class="tp-period">Period</span><span class="tp-col">Input</span><span class="tp-col">Output</span><span class="tp-col">Cache Read</span><span class="tp-col">Cache Write</span><span class="tp-col">Total</span></div>
      <div class="tp-row"><span class="tp-period">7d</span><span class="tp-col">${fmtTok(tok['7d'].input)}</span><span class="tp-col">${fmtTok(tok['7d'].output)}</span><span class="tp-col">${fmtTok(tok['7d'].cacheRead)}</span><span class="tp-col">${fmtTok(tok['7d'].cacheCreation)}</span><span class="tp-col tp-total">${fmtTok(tok['7d'].input + tok['7d'].output + tok['7d'].cacheRead + tok['7d'].cacheCreation)}</span></div>
      <div class="tp-row"><span class="tp-period">30d</span><span class="tp-col">${fmtTok(tok['30d'].input)}</span><span class="tp-col">${fmtTok(tok['30d'].output)}</span><span class="tp-col">${fmtTok(tok['30d'].cacheRead)}</span><span class="tp-col">${fmtTok(tok['30d'].cacheCreation)}</span><span class="tp-col tp-total">${fmtTok(tok['30d'].input + tok['30d'].output + tok['30d'].cacheRead + tok['30d'].cacheCreation)}</span></div>
      <div class="tp-row tp-all"><span class="tp-period">All</span><span class="tp-col">${fmtTok(tok.all.input)}</span><span class="tp-col">${fmtTok(tok.all.output)}</span><span class="tp-col">${fmtTok(tok.all.cacheRead)}</span><span class="tp-col">${fmtTok(tok.all.cacheCreation)}</span><span class="tp-col tp-total">${fmtTok(totalAll)}</span></div>
      ${tok.all.totalBilled ? `<div class="tp-row"><span class="tp-period">Billed</span><span class="tp-col" colspan="4"></span><span class="tp-col tp-total">${fmtTok(tok.all.totalBilled)}</span></div>` : ''}
      ${tok.all.totalContext ? `<div class="tp-row"><span class="tp-period">Context</span><span class="tp-col" colspan="4"></span><span class="tp-col tp-total">${fmtTok(tok.all.totalContext)}</span></div>` : ''}
    </div>

    ${heatmapSvg}

    ${dailyChart}

    ${agg.models.size ? `<div class="models-section"><span class="ev-label">Models:</span> ${[...agg.models].map(m => `<span class="stack-chip">${esc(m)}</span>`).join('')}</div>` : ''}
  </section>`;
}

function renderHeatmap(hourlyAgg, maxH) {
  if (maxH <= 1) return '';
  const rows = [];
  for (const [start, label] of [[0, 'AM'], [12, 'PM']]) {
    let cells = '';
    for (let h = start; h < start + 12; h++) {
      const pct = hourlyAgg[h] / maxH;
      let fill, color;
      if (pct > 0.6) { fill = '#34d399'; color = 'rgba(52,211,153,.7)'; }
      else if (pct > 0.3) { fill = '#22d3ee'; color = 'rgba(34,211,238,.5)'; }
      else if (pct > 0.1) { fill = '#fbbf24'; color = 'rgba(251,191,36,.4)'; }
      else if (pct > 0) { fill = '#334155'; color = 'rgba(51,65,85,.5)'; }
      else { fill = 'rgba(255,255,255,.04)'; color = 'transparent'; }
      cells += `<rect x="${(h - start) * 22}" y="0" width="20" height="16" rx="2" fill="${fill}" opacity="0.85"><title>${String(h).padStart(2,'0')}:00 — ${hourlyAgg[h]} calls</title></rect>`;
    }
    rows.push(`<g transform="translate(0,${rows.length * 22})">${cells}<text x="268" y="12" fill="#64748b" font-size="10" font-family="system-ui,sans-serif">${label}</text></g>`);
  }
  return `<div class="heatmap-section"><div class="card-header" style="margin-bottom:8px"><span class="card-dot" style="background:#34d399"></span>Hourly Activity</div><svg viewBox="0 0 300 50" class="heatmap-svg">${rows.join('')}</svg></div>`;
}

function renderDailyChart(dailyAgg) {
  const entries = Object.entries(dailyAgg).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length < 3) return '';
  const last30 = entries.slice(-30);
  const maxVal = Math.max(...last30.map(([, v]) => v), 1);
  const barW = 280 / last30.length;

  const bars = last30.map(([date, val], i) => {
    const h = Math.max(Math.round(val / maxVal * 80), 1);
    return `<rect x="${i * barW}" y="${80 - h}" width="${Math.max(barW - 1, 1)}" height="${h}" fill="#8b5cf6" opacity="0.7" rx="1"><title>${date}: ${fmtTok(val)} tokens</title></rect>`;
  }).join('');

  const labels = last30.filter((_, i) => i % 7 === 0 || i === last30.length - 1).map(([date], i) => {
    const idx = i === 0 ? 0 : last30.length - 1;
    return `<text x="${idx * barW}" y="96" fill="#475569" font-size="8" font-family="system-ui,sans-serif">${date.substring(5)}</text>`;
  }).join('');

  return `<div class="heatmap-section"><div class="card-header" style="margin-bottom:8px"><span class="card-dot" style="background:#a78bfa"></span>Daily Token Usage</div><svg viewBox="0 0 280 100" class="heatmap-svg">${bars}${labels}</svg></div>`;
}

// ── Token Breakdown Card ─────────────────────────
function tokenBreakdownCard(details, total, totalInput, totalOutput, totalCacheRead, totalCacheCreation) {
  return `<div class="card">
    <div class="card-header"><span class="card-dot" style="background:#f97316"></span>Token Breakdown</div>
    <div class="token-chart">
      <div class="token-total"><span class="token-big">${fmtTok(total)}</span><span class="token-label">Total tokens (incl. cache)</span></div>
      <div class="token-legend">
        <span class="tl-input">■ Input: ${fmtTok(totalInput)}</span>
        <span class="tl-output">■ Output: ${fmtTok(totalOutput)}</span>
        <span class="tl-cache">■ Cache Read: ${fmtTok(totalCacheRead)}</span>
        <span class="tl-cache-w">■ Cache Write: ${fmtTok(totalCacheCreation)}</span>
      </div>
      ${Object.entries(details).map(([name, d]) => {
        const pct = Math.round(d.totalBilled / total * 100);
        return `<div class="token-agent">
          <div class="ta-name">${esc(name)}</div>
          <div class="ta-bar-bg"><div class="ta-bar-fill" style="width:${pct}%"></div></div>
          <div class="ta-detail">
            <span>In: ${fmtTok(d.input)}</span>
            <span>Out: ${fmtTok(d.output)}</span>
            <span>CR: ${fmtTok(d.cacheRead)}</span>
            ${d.cacheCreation ? `<span>CW: ${fmtTok(d.cacheCreation)}</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── SVG: Aura Ring ──────────────────────────────
function auraRing(score, dimensions) {
  const R = 90, r = 68, cx = 120, cy = 120;
  const circ = 2 * Math.PI * R;
  const gap = 4;
  const segLen = (circ - gap * 6) / 6;

  const arcs = DIM_META.map((d, i) => {
    const ds = dimensions[d.id];
    const v = ds?.status === 'scored' ? ds.score : 0;
    const offset = i * (segLen + gap);
    const fill = segLen * v / 100;
    return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${d.color}" stroke-width="10"
      stroke-dasharray="${fill} ${circ - fill}" stroke-dashoffset="${-offset}"
      stroke-linecap="round" opacity="0.85" transform="rotate(-90 ${cx} ${cy})"/>`;
  }).join('');

  return `<svg viewBox="0 0 240 240" class="aura-ring">
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(148,163,184,.1)" stroke-width="10"/>
    <g filter="url(#glow)">${arcs}</g>
    <text x="${cx}" y="${cy - 16}" text-anchor="middle" fill="#f1f5f9" font-size="48" font-weight="800" font-family="system-ui,sans-serif">${score}</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="#64748b" font-size="13" font-family="system-ui,sans-serif">/ 100</text>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="#8b5cf6" font-size="11" font-weight="600" font-family="system-ui,sans-serif">AURA SCORE</text>
  </svg>`;
}

// ── SVG: Radar Chart ────────────────────────────
function radarChart(dimensions) {
  const cx = 160, cy = 160, maxR = 120;
  const n = 6;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const rings = [20, 40, 60, 80, 100].map(pct => {
    const r = maxR * pct / 100;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = startAngle + i * angleStep;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="1"/>`;
  }).join('');

  const axes = Array.from({ length: n }, (_, i) => {
    const a = startAngle + i * angleStep;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + maxR * Math.cos(a)}" y2="${cy + maxR * Math.sin(a)}" stroke="rgba(148,163,184,.06)" stroke-width="1"/>`;
  }).join('');

  const dataPts = DIM_META.map((d, i) => {
    const ds = dimensions[d.id];
    const v = ds?.status === 'scored' ? ds.score : 0;
    const r = maxR * v / 100;
    const a = startAngle + i * angleStep;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const labels = DIM_META.map((d, i) => {
    const a = startAngle + i * angleStep;
    const lr = maxR + 28;
    const x = cx + lr * Math.cos(a);
    const y = cy + lr * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    const dy = Math.sin(a) > 0.3 ? 4 : Math.sin(a) < -0.3 ? -4 : 0;
    const ds = dimensions[d.id];
    const v = ds?.status === 'scored' ? ds.score : 0;
    return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" fill="${d.color}" font-size="11" font-weight="600" font-family="system-ui,sans-serif">${d.icon} ${v}</text>`;
  }).join('');

  return `<svg viewBox="0 0 320 320" class="radar-chart">
    <defs>
      <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:.25"/>
        <stop offset="100%" style="stop-color:#22d3ee;stop-opacity:.15"/>
      </linearGradient>
      <filter id="radarGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${rings}${axes}
    <polygon points="${dataPts}" fill="url(#radarFill)" stroke="#8b5cf6" stroke-width="2" filter="url(#radarGlow)"/>
    ${DIM_META.map((d, i) => {
      const ds = dimensions[d.id];
      const v = ds?.status === 'scored' ? ds.score : 0;
      const r = maxR * v / 100;
      const a = startAngle + i * angleStep;
      return `<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="4" fill="${d.color}" stroke="#050711" stroke-width="2"/>`;
    }).join('')}
    ${labels}
  </svg>`;
}

// ── SVG: Agent Constellation ────────────────────
function agentConstellation(agents) {
  if (!agents.length) return '<div class="empty">No AI agents detected</div>';

  const cx = 250, cy = 160, orbitR = 110;
  const n = agents.length;

  const nodes = agents.map((a, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const x = cx + orbitR * Math.cos(angle);
    const y = cy + orbitR * Math.sin(angle);
    const style = DEPTH_STYLES[a.depth] || DEPTH_STYLES.detect;

    const glowFilter = style.glow ? 'filter="url(#agentGlow)"' : '';
    const depthLabel = a.depth === 'unsupported' ? 'unsupported' : a.depth;

    return `
      <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${style.color}" stroke-width="1" opacity="${style.lineOpacity}"/>
      <circle cx="${x}" cy="${y}" r="6" fill="${style.color}" opacity="${style.opacity}" ${glowFilter}/>
      <text x="${x}" y="${y + 22}" text-anchor="middle" fill="${style.color}" font-size="11" font-weight="${style.fontWeight}" font-family="system-ui,sans-serif" opacity="${style.opacity}">${esc(a.source)}</text>
      <text x="${x}" y="${y + 34}" text-anchor="middle" fill="#475569" font-size="9" font-family="system-ui,sans-serif">${depthLabel}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 500 320" class="constellation">
    <defs>
      <filter id="agentGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${orbitR}" fill="none" stroke="rgba(148,163,184,.06)" stroke-width="1" stroke-dasharray="4 4"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="#8b5cf6" opacity=".9" filter="url(#agentGlow)"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="white" font-size="8" font-weight="700" font-family="system-ui,sans-serif">CORE</text>
    ${nodes}
  </svg>`;
}

// ── Helpers ─────────────────────────────────────
function stackGroup(label, items) {
  if (!items.length) return '';
  return `<div class="stack-group"><div class="stack-label">${esc(label)}</div><div class="stack-items">${items.map(i => `<span class="stack-chip">${esc(i)}</span>`).join('')}</div></div>`;
}

function findWeakness(dimensions) {
  let weakest = null, lowest = 100;
  const labels = { envHealth: 'Env Health', aiWorkflow: 'AI Workflow', toolchainDepth: 'Toolchain', verification: 'Verification', automation: 'Automation', security: 'Security' };
  for (const [id, ds] of Object.entries(dimensions)) {
    if (ds.status === 'scored' && ds.score < lowest) { lowest = ds.score; weakest = labels[id] || id; }
  }
  return lowest < 50 ? weakest : null;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── CSS ─────────────────────────────────────────
function CSS() {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;min-height:100vh;background:#050711;overflow-x:hidden}
.page-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 600px 400px at 15% 8%,rgba(139,92,246,.18),transparent),
    radial-gradient(ellipse 500px 350px at 85% 15%,rgba(34,211,238,.12),transparent),
    radial-gradient(ellipse 700px 500px at 50% 95%,rgba(59,130,246,.08),transparent),
    #050711}
.page-bg::after{content:'';position:absolute;inset:0;
  background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
  background-size:48px 48px}
.container{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:40px 24px}

/* ── Warning Banner ── */
.warning-banner{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 16px;margin-bottom:16px;color:#fbbf24;font-size:13px}
.warning-banner code{background:rgba(251,191,36,.15);padding:2px 6px;border-radius:4px;font-family:'SF Mono',monospace;font-size:12px}

/* ── Hero Card ── */
.hero-card{background:linear-gradient(145deg,rgba(22,27,54,.85),rgba(10,14,32,.92));
  border:1px solid rgba(148,163,184,.16);border-radius:20px;padding:32px 40px;margin-bottom:24px;
  box-shadow:0 24px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06)}
.hero-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.devo-badge{display:inline-block;padding:5px 18px;border-radius:20px;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:12px;font-weight:700;letter-spacing:.5px}
.hero-privacy{font-size:11px;color:#475569;letter-spacing:.3px}
.hero-body{display:flex;gap:40px;align-items:center}
.hero-left{flex:1}
.hero-subtitle{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.hero-type{font-size:32px;font-weight:800;color:#f1f5f9;margin-bottom:12px;
  background:linear-gradient(135deg,#f1f5f9,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-meta{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.rank-pill{display:inline-block;padding:3px 12px;border-radius:12px;background:rgba(139,92,246,.2);color:#a78bfa;font-size:12px;font-weight:600}
.hero-conf{font-size:12px;color:#64748b}
.hero-scores{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.score-pill{display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:10px;min-width:72px}
.score-pill.aura{background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3)}
.score-pill.power{background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.25)}
.score-pill.agent{background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.25)}
.sp-val{font-size:22px;font-weight:800;color:#e2e8f0}
.sp-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.hero-weapons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.weapon{display:flex;flex-direction:column;gap:2px;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.05)}
.weapon-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.weapon-val{font-size:13px;font-weight:600;color:#e2e8f0}
.weapon-weak .weapon-val{color:#fb7185}
.hero-right{flex-shrink:0}
.aura-ring{width:240px;height:240px}
.hero-badges{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap}
.hbadge{padding:4px 12px;border-radius:16px;font-size:12px;border:1px solid;background:rgba(255,255,255,.03)}

/* ── Section Grid ── */
.section-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}

/* ── Card ── */
.card{background:linear-gradient(145deg,rgba(22,27,54,.82),rgba(10,14,32,.92));
  border:1px solid rgba(148,163,184,.16);border-radius:16px;padding:28px;margin-bottom:24px;
  box-shadow:0 16px 64px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)}
.card-header{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#94a3b8;margin-bottom:20px;text-transform:uppercase;letter-spacing:.5px}
.card-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.card-radar{display:flex;flex-direction:column;align-items:center}
.radar-chart{width:100%;max-width:340px;height:auto}

/* ── Dimension list ── */
.card-dims{display:flex;flex-direction:column;justify-content:center}
.dim-list{display:flex;flex-direction:column;gap:14px}
.dim-row{display:flex;align-items:center;gap:10px}
.dim-icon{font-size:14px;width:20px;text-align:center}
.dim-label{font-size:12px;color:#94a3b8;width:80px;flex-shrink:0}
.dim-bar-bg{flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.dim-bar-fill{height:100%;border-radius:3px;transition:width .6s ease}
.dim-score{font-size:14px;font-weight:700;width:32px;text-align:right}
.dim-conf{font-size:10px;color:#475569;width:48px;text-align:right}

/* ── Constellation ── */
.constellation{width:100%;max-width:500px;height:auto;margin:0 auto;display:block}
.unsupported-list{margin-top:12px}
.unsupported-item{display:flex;align-items:center;gap:10px;padding:6px 12px;background:rgba(255,255,255,.02);border-radius:6px;margin-bottom:4px}
.ui-name{font-size:13px;color:#fb7185;font-weight:500}
.ui-badge{font-size:10px;color:#475569;background:rgba(251,113,133,.1);padding:2px 8px;border-radius:4px}

/* ── Power User Evidence ── */
.evidence-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:20px}
.ev-item{display:flex;flex-direction:column;gap:2px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.05)}
.ev-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px}
.ev-val{font-size:15px;font-weight:700;color:#e2e8f0}

/* ── Token periods table ── */
.token-periods{margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.06)}
.tp-header,.tp-row{display:grid;grid-template-columns:60px repeat(5,1fr);padding:8px 12px;font-size:12px;align-items:center}
.tp-header{background:rgba(255,255,255,.05);color:#94a3b8;font-weight:600}
.tp-row{border-top:1px solid rgba(255,255,255,.03);color:#cbd5e1}
.tp-row.tp-all{background:rgba(139,92,246,.08);font-weight:600}
.tp-period{color:#64748b;font-weight:500}
.tp-col{color:#cbd5e1}
.tp-total{font-weight:700;color:#a78bfa}

/* ── Heatmap & Charts ── */
.heatmap-section{margin-top:16px}
.heatmap-svg{width:100%;max-width:300px;height:auto}
.models-section{margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* ── Stack groups ── */
.stack-groups{display:flex;flex-direction:column;gap:16px}
.stack-group{display:flex;align-items:center;gap:12px}
.stack-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0}
.stack-items{display:flex;flex-wrap:wrap;gap:6px}
.stack-chip{padding:4px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;font-size:12px;color:#cbd5e1}

/* ── Token breakdown ── */
.token-chart{display:flex;flex-direction:column;gap:12px}
.token-total{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.token-big{font-size:28px;font-weight:800;color:#a78bfa}
.token-label{font-size:12px;color:#64748b}
.token-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.tl-input{color:#8b5cf6;font-size:11px}.tl-output{color:#34d399;font-size:11px}
.tl-cache{color:#22d3ee;font-size:11px}.tl-cache-w{color:#fbbf24;font-size:11px}
.token-agent{margin-bottom:8px}
.ta-name{font-size:12px;color:#94a3b8;font-weight:500;margin-bottom:4px}
.ta-bar-bg{height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden;margin-bottom:4px}
.ta-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#8b5cf6,#6366f1);transition:width .5s}
.ta-detail{display:flex;gap:10px;font-size:10px;color:#64748b}

/* ── Badge wall ── */
.badge-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.game-badge{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 12px;
  background:rgba(255,255,255,.02);border:1px solid;border-radius:12px;text-align:center;transition:transform .15s}
.game-badge:hover{transform:translateY(-2px)}
.gb-icon{font-size:24px}
.gb-label{font-size:13px;font-weight:600;color:#e2e8f0}
.gb-rarity{font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}

/* ── Recommendations ── */
.recs{list-style:none;display:flex;flex-direction:column;gap:10px}
.recs li{display:flex;align-items:flex-start;gap:10px;color:#94a3b8;font-size:13px;padding:8px 12px;background:rgba(255,255,255,.02);border-radius:8px}
.rec-num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:rgba(139,92,246,.2);color:#a78bfa;font-size:11px;font-weight:700;flex-shrink:0}

/* ── Empty ── */
.empty{color:#475569;font-style:italic;font-size:13px;padding:20px 0}

/* ── Footer ── */
footer{text-align:center;padding:40px 0 20px;color:#334155;font-size:12px;letter-spacing:.3px}

/* ── Responsive ── */
@media(max-width:768px){
  .hero-body{flex-direction:column;text-align:center}
  .hero-right{order:-1}
  .hero-weapons{grid-template-columns:1fr}
  .hero-scores{justify-content:center}
  .section-grid{grid-template-columns:1fr}
  .badge-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
  .evidence-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
  .container{padding:20px 16px}
  .tp-header,.tp-row{grid-template-columns:50px repeat(5,1fr);font-size:10px}
}
`;
}
