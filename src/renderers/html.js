// HTML Bento-style dashboard renderer
import { fmtTok } from '../formatters.js';

export function renderHtml(report) {
  const { auraScore, confidence, dimensions, developerType, badges, recommendations, evidences, sessions } = report;
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const runtimes = evidences.filter(e => e.category === 'runtime' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));

  // Token aggregation
  let totalTokens = 0;
  if (sessions) {
    for (const s of Object.values(sessions)) {
      if (s?.tokensAll) totalTokens += (s.tokensAll.input || 0) + (s.tokensAll.output || 0);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevAura Report</title>
<style>
${CSS()}
</style>
</head>
<body>
<div class="container">
  <header class="hero">
    <div class="hero-badge">DevAura</div>
    <h1 class="hero-type">${esc(developerType.type)}</h1>
    <div class="hero-score">
      <span class="score-num">${auraScore}</span><span class="score-max">/100</span>
    </div>
    <div class="score-bar-bg"><div class="score-bar-fill" style="width:${auraScore}%"></div></div>
    <div class="hero-meta">Confidence: ${esc(confidence)} · Rank: ${esc(developerType.rank)}</div>
  </header>

  <div class="bento">
    <div class="card span-2">
      <h3>🏗 Environment Health</h3>
      ${dimBar('envHealth', dimensions)}
      <div class="stack-list">${stackItems(evidences, 'runtime')}</div>
    </div>
    <div class="card span-2">
      <h3>🤖 AI Workflow Maturity</h3>
      ${dimBar('aiWorkflow', dimensions)}
      <div class="agent-list">${aiAgentItems(aiAgents)}</div>
    </div>
    <div class="card">
      <h3>🔧 Toolchain Depth</h3>
      ${dimBar('toolchainDepth', dimensions)}
    </div>
    <div class="card">
      <h3>✅ Engineering Verification</h3>
      ${dimBar('verification', dimensions)}
    </div>
    <div class="card">
      <h3>⚡ Automation Depth</h3>
      ${dimBar('automation', dimensions)}
    </div>
    <div class="card">
      <h3>🔒 Security Hygiene</h3>
      ${dimBar('security', dimensions)}
    </div>
  </div>

  ${badges.length ? `
  <div class="card">
    <h3>Badges</h3>
    <div class="badges">${badges.map(b => `<span class="badge">${esc(b.icon)} ${esc(b.label)}</span>`).join('')}</div>
  </div>` : ''}

  ${recommendations.length ? `
  <div class="card">
    <h3>Recommendations</h3>
    <ul class="recs">${recommendations.slice(0, 5).map(r => `<li><strong>${r.priority}.</strong> ${esc(r.text)}</li>`).join('')}</ul>
  </div>` : ''}

  ${totalTokens > 0 ? `
  <div class="card">
    <h3>Token Usage</h3>
    <div class="token-stats">
      <div class="token-stat"><span class="token-val">${fmtTok(totalTokens)}</span><span class="token-label">Total tokens</span></div>
      ${sessions ? Object.entries(sessions).map(([name, s]) => s?.tokensAll ? `<div class="token-stat"><span class="token-val">${fmtTok((s.tokensAll.input || 0) + (s.tokensAll.output || 0))}</span><span class="token-label">${esc(name)}</span></div>` : '').join('') : ''}
    </div>
  </div>` : ''}

  <footer>
    <p>DevAura Report · Designed for sharing after review · Nothing uploaded</p>
  </footer>
</div>
</body>
</html>`;
  return html;
}

function dimBar(id, dimensions) {
  const ds = dimensions[id];
  if (!ds || ds.status !== 'scored') return `<div class="dim-empty">Not enough evidence</div>`;
  const v = ds.score;
  const color = v >= 70 ? '#4ade80' : v >= 40 ? '#facc15' : '#f87171';
  return `
    <div class="dim-score">
      <span class="dim-num" style="color:${color}">${v}</span><span class="dim-max">/100</span>
      <span class="dim-conf">(${ds.confidence})</span>
    </div>
    <div class="dim-bar"><div class="dim-fill" style="width:${v}%;background:${color}"></div></div>`;
}

function stackItems(evidences, category) {
  const items = evidences.filter(e => e.category === category && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  if (!items.length) return '<span class="stack-empty">None detected</span>';
  return items.map(e => {
    const ver = e.metrics?.langVersions?.evidence?.[0] || '';
    return `<span class="stack-item">${esc(e.source)}${ver ? ` <small>${esc(ver)}</small>` : ''}</span>`;
  }).join('');
}

function aiAgentItems(agents) {
  if (!agents.length) return '<span class="stack-empty">None detected</span>';
  return agents.map(a => `<span class="agent-item ${a.depth}">${esc(a.source)}<small>${a.depth}</small></span>`).join('');
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function CSS() {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f13; color: #e2e8f0; min-height: 100vh; }
.container { max-width: 840px; margin: 0 auto; padding: 40px 20px; }
.hero { text-align: center; padding: 48px 24px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
.hero-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
.hero-type { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #f1f5f9; }
.hero-score { margin-bottom: 16px; }
.score-num { font-size: 64px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.score-max { font-size: 24px; color: #64748b; }
.score-bar-bg { width: 200px; height: 6px; background: #1e293b; border-radius: 3px; margin: 0 auto 12px; }
.score-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #6366f1, #a78bfa); transition: width 0.5s; }
.hero-meta { color: #64748b; font-size: 14px; }
.bento { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.card { background: #1a1a2e; border-radius: 12px; padding: 24px; border: 1px solid rgba(255,255,255,0.06); }
.card.span-2 { grid-column: span 2; }
.card h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: #94a3b8; }
.dim-score { margin-bottom: 8px; }
.dim-num { font-size: 28px; font-weight: 700; }
.dim-max { font-size: 14px; color: #64748b; }
.dim-conf { font-size: 12px; color: #64748b; margin-left: 8px; }
.dim-bar { height: 4px; background: #1e293b; border-radius: 2px; margin-bottom: 12px; }
.dim-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
.dim-empty { color: #475569; font-style: italic; font-size: 14px; }
.stack-list, .agent-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.stack-item, .agent-item { display: inline-block; padding: 4px 10px; background: #1e293b; border-radius: 6px; font-size: 13px; }
.stack-item small { color: #6366f1; margin-left: 4px; }
.agent-item small { color: #64748b; margin-left: 4px; }
.agent-item.deep { border-left: 2px solid #4ade80; }
.agent-item.config { border-left: 2px solid #facc15; }
.agent-item.detect { border-left: 2px solid #64748b; }
.stack-empty { color: #475569; font-size: 13px; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; }
.badge { display: inline-block; padding: 6px 14px; background: linear-gradient(135deg, #1e1b4b, #312e81); border-radius: 20px; font-size: 13px; border: 1px solid rgba(99,102,241,0.3); }
.recs { list-style: none; }
.recs li { padding: 6px 0; color: #94a3b8; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.recs li:last-child { border-bottom: none; }
.recs strong { color: #6366f1; }
.token-stats { display: flex; gap: 20px; flex-wrap: wrap; }
.token-stat { text-align: center; }
.token-val { display: block; font-size: 24px; font-weight: 700; color: #a78bfa; }
.token-label { font-size: 12px; color: #64748b; }
footer { text-align: center; padding: 32px 0 16px; color: #475569; font-size: 13px; }
@media (max-width: 640px) { .bento { grid-template-columns: 1fr; } .card.span-2 { grid-column: span 1; } }
`;
}
