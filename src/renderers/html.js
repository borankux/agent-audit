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

export function renderHtml(report) {
  const { auraScore, confidence, dimensions, developerType, badges, recommendations, evidences, sessions } = report;
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const runtimes = evidences.filter(e => e.category === 'runtime' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const infras = evidences.filter(e => e.category === 'infra' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const shells = evidences.filter(e => e.category === 'shell');
  const ides = evidences.filter(e => e.category === 'ide' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));

  // Token aggregation
  let totalTokens = 0;
  const tokenByAgent = {};
  if (sessions) {
    for (const [name, s] of Object.entries(sessions)) {
      if (s?.tokensAll) {
        const t = (s.tokensAll.input || 0) + (s.tokensAll.output || 0);
        if (t > 0) { totalTokens += t; tokenByAgent[name] = t; }
      }
    }
  }

  // Main weapon / secondary / weakness
  const mainWeapon = aiAgents.length ? aiAgents[0].source : 'None';
  const secondaryWeapon = aiAgents.length >= 2 ? aiAgents[1].source : null;
  const weakness = findWeakness(dimensions);
  const specialSkill = badges.length ? badges[0].label : 'None';

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
  </section>

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
    ${totalTokens > 0 ? `<div class="card">
      <div class="card-header"><span class="card-dot" style="background:#f97316"></span>Token Usage</div>
      <div class="token-chart">
        <div class="token-total"><span class="token-big">${fmtTok(totalTokens)}</span><span class="token-label">Total tokens</span></div>
        ${Object.entries(tokenByAgent).map(([name, val]) => {
          const pct = Math.round(val / totalTokens * 100);
          return `<div class="token-row">
            <span class="token-name">${esc(name)}</span>
            <div class="token-bar-bg"><div class="token-bar-fill" style="width:${pct}%"></div></div>
            <span class="token-val">${fmtTok(val)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
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

  // Grid rings
  const rings = [20, 40, 60, 80, 100].map(pct => {
    const r = maxR * pct / 100;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = startAngle + i * angleStep;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="1"/>`;
  }).join('');

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const a = startAngle + i * angleStep;
    return `<line x1="${cx}" y1="${cy}" x2="${cx + maxR * Math.cos(a)}" y2="${cy + maxR * Math.sin(a)}" stroke="rgba(148,163,184,.06)" stroke-width="1"/>`;
  }).join('');

  // Data polygon
  const dataPts = DIM_META.map((d, i) => {
    const ds = dimensions[d.id];
    const v = ds?.status === 'scored' ? ds.score : 0;
    const r = maxR * v / 100;
    const a = startAngle + i * angleStep;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  // Labels
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
    const isDeep = a.depth === 'deep';
    const isConfig = a.depth === 'config';

    const nodeColor = isDeep ? '#34d399' : isConfig ? '#fbbf24' : '#475569';
    const glowFilter = isDeep ? 'filter="url(#agentGlow)"' : '';
    const opacity = isDeep ? 1 : isConfig ? 0.8 : 0.5;
    const lineOpacity = isDeep ? 0.4 : isConfig ? 0.2 : 0.08;

    return `
      <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${nodeColor}" stroke-width="1" opacity="${lineOpacity}"/>
      <circle cx="${x}" cy="${y}" r="6" fill="${nodeColor}" opacity="${opacity}" ${glowFilter}/>
      <text x="${x}" y="${y + 22}" text-anchor="middle" fill="${nodeColor}" font-size="11" font-weight="${isDeep ? 600 : 400}" font-family="system-ui,sans-serif" opacity="${opacity}">${esc(a.source)}</text>
      <text x="${x}" y="${y + 34}" text-anchor="middle" fill="#475569" font-size="9" font-family="system-ui,sans-serif">${a.depth}</text>
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
.hero-meta{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.rank-pill{display:inline-block;padding:3px 12px;border-radius:12px;background:rgba(139,92,246,.2);color:#a78bfa;font-size:12px;font-weight:600}
.hero-conf{font-size:12px;color:#64748b}
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

/* ── Stack groups ── */
.stack-groups{display:flex;flex-direction:column;gap:16px}
.stack-group{display:flex;align-items:center;gap:12px}
.stack-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0}
.stack-items{display:flex;flex-wrap:wrap;gap:6px}
.stack-chip{padding:4px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;font-size:12px;color:#cbd5e1}

/* ── Token chart ── */
.token-chart{display:flex;flex-direction:column;gap:12px}
.token-total{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
.token-big{font-size:28px;font-weight:800;color:#a78bfa}
.token-label{font-size:12px;color:#64748b}
.token-row{display:flex;align-items:center;gap:10px}
.token-name{font-size:12px;color:#94a3b8;width:100px;flex-shrink:0}
.token-bar-bg{flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
.token-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#8b5cf6,#6366f1);transition:width .5s}
.token-val{font-size:12px;font-weight:600;color:#a78bfa;width:60px;text-align:right}

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
  .section-grid{grid-template-columns:1fr}
  .badge-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
  .container{padding:20px 16px}
}
`;
}
