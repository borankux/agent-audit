import { G, Y, R, C, B, D, W, BOX_H } from '../ansi.js';
import { fmtTok, stripAnsi } from '../formatters.js';

const DIM_BAR = "\x1b[38;5;240m";
const GOLD    = "\x1b[38;5;220m";
const LIME    = "\x1b[38;5;82m";
const SKY     = "\x1b[38;5;117m";
const ORANGE  = "\x1b[38;5;208m";
const AGENT_COLORS = [LIME, SKY, ORANGE, "\x1b[38;5;213m", "\x1b[38;5;183m", "\x1b[38;5;123m", GOLD];

const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visLen(s) { return s.replace(ANSI_RE, '').length; }
function padVis(s, targetLen) { const gap = targetLen - visLen(s); return gap <= 0 ? s : s + ' '.repeat(gap); }

const INNER = 54;
const BOX_W = 58;
const PAD = '  ';

function boxTop(ac) { return `${PAD}${ac}┌${BOX_H.repeat(BOX_W)}┐${W}`; }
function boxMid(ac) { return `${PAD}${ac}├${BOX_H.repeat(BOX_W)}┤${W}`; }
function boxBot(ac) { return `${PAD}${ac}└${BOX_H.repeat(BOX_W)}┘${W}`; }
function boxRow(ac, content) { return `${PAD}${ac}│${W} ${padVis(content, INNER)} ${ac}│${W}`; }

export function renderTerminal(report) {
  const { auraScore, confidence, dimensions, developerType, powerScores, badges, recommendations, evidences, sessions, scanMeta } = report;
  const gc = gradeColor(auraScore);
  const now = new Date();
  const ts = now.toISOString().substring(0, 16).replace('T', ' ');
  const L = [];

  // Truncation warning
  const hasTruncation = scanMeta?.scannedAgents?.some(a => a.skipped);
  if (hasTruncation) {
    L.push(`  ${R}⚠ Session data truncated — usage may be undercounted. Run with --full${W}`);
    L.push('');
  }

  // ── Header ──────────────────────────────────────────
  L.push('');
  L.push(`  ${B}╔${'═'.repeat(BOX_W)}╗${W}`);
  L.push(`  ${B}║${W}${' '.repeat(BOX_W)}${B}║${W}`);
  const title = `${G}⚡${W}  ${B}DevAura${W} — Developer Profile`;
  L.push(`  ${B}║${W}  ${padVis(title, BOX_W - 2)}${B}║${W}`);
  const sub = `${D}${ts} · local scan · designed for sharing after review${W}`;
  L.push(`  ${B}║${W}      ${padVis(sub, BOX_W - 6)}${B}║${W}`);
  L.push(`  ${B}║${W}${' '.repeat(BOX_W)}${B}║${W}`);
  L.push(`  ${B}╚${'═'.repeat(BOX_W)}╝${W}`);
  L.push('');

  // ── Developer Type + Aura Score ─────────────────────
  const barW = 40;
  const filled = Math.round(auraScore / 100 * barW);
  const bar = gc + '█'.repeat(filled) + DIM_BAR + '░'.repeat(barW - filled) + W;
  const heroLeft = `${B}${gc} ${developerType.type}${W}`;
  L.push(`  ${heroLeft}`);
  L.push(`  ${B}${gc} ${auraScore}${W}${D}/100${W} ${bar} ${D}Confidence: ${confidence}${W}`);
  if (powerScores?.aiPowerScore !== undefined) {
    L.push(`  ${D}AI Power: ${C}${powerScores.aiPowerScore}${W}${D}/100${W}${powerScores.evidenceCoverageScore !== undefined ? `  Evidence: ${C}${powerScores.evidenceCoverageScore}${W}${D}%${W}` : ''}`);
  }
  L.push(`  ${D}Rank: ${developerType.rank}${W}${developerType.primaryAgent ? `${D} · Primary: ${B}${developerType.primaryAgent}${W}` : ''}`);
  L.push('');

  // ── Core Signals ────────────────────────────────────
  L.push(`  ${B}── Core Signals ──────────────────────────────────────${W}`);
  for (const sig of computeSignals(dimensions, evidences)) {
    L.push(`  ${sig}`);
  }
  L.push('');

  // ── Dimension Scores ────────────────────────────────
  L.push(`  ${B}── Capability Scores ────────────────────────────────${W}`);
  const barMax = 30;
  for (const [id, label, icon] of [
    ['envHealth', 'Env Health', '🏗'], ['aiWorkflow', 'AI Workflow', '🤖'],
    ['toolchainDepth', 'Toolchain', '🔧'], ['verification', 'Verification', '✅'],
    ['automation', 'Automation', '⚡'], ['security', 'Security', '🔒'],
  ]) {
    const ds = dimensions[id];
    if (!ds || ds.status !== 'scored') continue;
    const v = ds.score;
    const barLen = Math.round(v / 100 * barMax);
    const barColor = v >= 70 ? G : v >= 40 ? Y : R;
    const filled2 = barColor + '█'.repeat(barLen) + W;
    const empty2 = D + '░'.repeat(barMax - barLen) + W;
    const scoreStr = `${String(v).padStart(3)}/100`;
    L.push(`  ${icon} ${label.padEnd(12)} ${filled2}${empty2} ${B}${scoreStr}${W} ${D}(${ds.confidence})${W}`);
  }
  L.push('');

  // ── Detected Stack ──────────────────────────────────
  L.push(`  ${B}── Detected Stack ───────────────────────────────────${W}`);
  const stack = buildDetectedStack(evidences, sessions);
  for (const line of stack) {
    L.push(`  ${line}`);
  }
  L.push('');

  // ── AI Agent Details ────────────────────────────────
  const aiEvidences = evidences.filter(e => e.category === 'ai-agent');
  const deepAgents = aiEvidences.filter(e => e.depth === 'deep');
  if (deepAgents.length) {
    for (const ev of deepAgents) {
      const accent = AGENT_COLORS[aiEvidences.indexOf(ev) % AGENT_COLORS.length];
      L.push(boxTop(accent));
      const m = ev.metrics;
      const hdr = `${B}${ev.source}${W}  ${D}deep scan${W}`;
      L.push(boxRow(accent, hdr));
      L.push(boxMid(accent));
      if (m.aiSessions?.value) L.push(boxRow(accent, `  Sessions: ${B}${m.aiSessions.value}${W}  Days: ${B}${m.activeDays?.value || 0}${W}  Calls: ${B}${fmtTok(m.toolCalls?.value || 0)}${W}`));
      if (m.tokensUsed?.value) L.push(boxRow(accent, `  Tokens: ${B}${fmtTok(m.tokensUsed.value)}${W}  Tools: ${B}${m.toolsUsed?.value || 0}${W}`));
      if (m.testCommands?.value || m.buildCommands?.value) L.push(boxRow(accent, `  Tests: ${G}${m.testCommands?.value || 0}${W}  Builds: ${C}${m.buildCommands?.value || 0}${W}`));
      L.push(boxBot(accent));
      L.push('');
    }
  }

  // ── Badges ──────────────────────────────────────────
  if (badges.length) {
    L.push(`  ${B}── Badges ────────────────────────────────────────────${W}`);
    const badgeStr = badges.map(b => `${b.icon} ${b.label}`).join(`  ${D}·${W} `);
    L.push(`  ${badgeStr}`);
    L.push('');
  }

  // ── Token Usage (from sessions) ─────────────────────
  if (sessions) {
    const agg7 = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    const agg30 = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    const aggAll = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    for (const s of Object.values(sessions)) {
      if (!s) continue;
      for (const k of ['input', 'output', 'cacheRead', 'cacheCreation']) {
        agg7[k] += s.tokens7d?.[k] || 0;
        agg30[k] += s.tokens30d?.[k] || 0;
        aggAll[k] += s.tokensAll?.[k] || 0;
      }
    }
    const agg7t = agg7.input + agg7.output + agg7.cacheRead + agg7.cacheCreation;
    const agg30t = agg30.input + agg30.output + agg30.cacheRead + agg30.cacheCreation;
    const aggAllt = aggAll.input + aggAll.output + aggAll.cacheRead + aggAll.cacheCreation;
    if (aggAllt > 0) {
      const colW = 10;
      L.push(`  ${B}── Token Usage (incl. cache) ─────────────────────────${W}`);
      L.push(`  ${D}${' '.repeat(10)}${'7d'.padStart(colW)}${'30d'.padStart(colW)}${'All'.padStart(colW)}${W}`);
      for (const [label, k7, k30, ka] of [
        ['Input', agg7.input, agg30.input, aggAll.input],
        ['Output', agg7.output, agg30.output, aggAll.output],
        ['Cache R', agg7.cacheRead, agg30.cacheRead, aggAll.cacheRead],
        ['Cache W', agg7.cacheCreation, agg30.cacheCreation, aggAll.cacheCreation],
      ]) {
        L.push(`  ${D}${label.padEnd(8)}${W}${SKY}${fmtTok(k7).padStart(colW)}${W}${GOLD}${fmtTok(k30).padStart(colW)}${W}${LIME}${fmtTok(ka).padStart(colW)}${W}`);
      }
      L.push(`  ${D}${'─'.repeat(8)}${'─'.repeat(colW)}${'─'.repeat(colW)}${'─'.repeat(colW)}${W}`);
      L.push(`  ${B}Total${' '.repeat(3)}${W}${SKY}${fmtTok(agg7t).padStart(colW)}${W}${GOLD}${fmtTok(agg30t).padStart(colW)}${W}${B}${fmtTok(aggAllt).padStart(colW)}${W}`);
      L.push('');
    }

    // Activity heatmap
    const aggHourly = new Array(24).fill(0);
    for (const s of Object.values(sessions)) { if (s?.hourlyCounts) for (let i = 0; i < 24; i++) aggHourly[i] += s.hourlyCounts[i] || 0; }
    const maxH = Math.max(...aggHourly, 1);
    if (maxH > 1) {
      L.push(`  ${B}── Activity Heatmap ─────────────────────────────────${W}`);
      for (const [start, ampm] of [[0, 'AM'], [12, 'PM']]) {
        let row = '  ';
        for (let h = start; h < start + 12; h++) {
          const pct = aggHourly[h] / maxH;
          let ch, clr;
          if (pct > 0.6) { ch = '██'; clr = LIME; } else if (pct > 0.3) { ch = '▓▓'; clr = SKY; }
          else if (pct > 0.1) { ch = '▒▒'; clr = GOLD; } else { ch = '░░'; clr = DIM_BAR; }
          row += `${clr}${ch}${W}`;
        }
        row += `  ${D}${ampm}${W}`;
        L.push(row);
      }
      const topHours = aggHourly.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(([v]) => v > 0);
      if (topHours.length) L.push(`  ${D}Peak:${W} ${B}${topHours.map(([, h]) => `${String(h).padStart(2, '0')}:00`).join(', ')}${W}`);
      L.push('');
    }
  }

  // ── Recommendations ─────────────────────────────────
  if (recommendations.length) {
    L.push(`  ${B}── Recommendations ────────────────────────────────────${W}`);
    for (const rec of recommendations.slice(0, 5)) {
      L.push(`  ${D}${rec.priority}.${W} ${rec.text}`);
    }
    L.push('');
  }

  // ── Footer ──────────────────────────────────────────
  L.push(`  ${DIM_BAR}${'─'.repeat(58)}${W}`);
  L.push(`  ${D}Designed for sharing after review · Nothing uploaded${W}`);
  L.push('');

  return L.join('\n');
}

function gradeColor(score) {
  if (score >= 80) return G;
  if (score >= 55) return Y;
  return R;
}

function computeSignals(dimensions, evidences) {
  const signals = [];
  const aiEvs = evidences.filter(e => e.category === 'ai-agent');
  const deepAi = aiEvs.filter(e => e.depth === 'deep');
  if (deepAi.length >= 2) signals.push(`${G}✓${W} Multi-agent workflow detected`);
  if (deepAi.length >= 1) signals.push(`${G}✓${W} Active AI coding usage`);

  const runtimes = evidences.filter(e => e.category === 'runtime');
  if (runtimes.length >= 3) signals.push(`${G}✓${W} Fullstack language stack`);
  if (runtimes.length >= 1) signals.push(`${G}✓${W} Development environment configured`);

  const shellEv = evidences.find(e => e.category === 'shell');
  if (shellEv?.metrics?.shellPlugins?.value >= 5) signals.push(`${G}✓${W} Heavy terminal usage`);

  const mcpCount = evidences.reduce((s, e) => s + (e.metrics?.mcpServers?.value || 0), 0);
  if (mcpCount >= 3) signals.push(`${G}✓${W} MCP / skills ecosystem`);

  if (dimensions.verification?.status === 'scored' && dimensions.verification.score < 30)
    signals.push(`${Y}⚠${W} Low test/build verification evidence`);
  if (dimensions.security?.status === 'scored' && dimensions.security.score < 50)
    signals.push(`${Y}⚠${W} Security hygiene needs attention`);

  return signals;
}

function buildDetectedStack(evidences, sessions) {
  const lines = [];
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const runtimes = evidences.filter(e => e.category === 'runtime' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const infras = evidences.filter(e => e.category === 'infra' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  const shells = evidences.filter(e => e.category === 'shell');
  const ides = evidences.filter(e => e.category === 'ide' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));

  if (aiAgents.length) lines.push(`  ${C}AI Agents${W}     ${B}${aiAgents.map(e => e.source).join(', ')}${W}`);
  if (ides.length) lines.push(`  ${C}IDEs${W}         ${B}${ides.flatMap(e => e.metrics?.ideDetected?.evidence || []).join(', ')}${W}`);
  if (runtimes.length) lines.push(`  ${C}Runtime${W}      ${B}${runtimes.map(e => `${e.source}${e.metrics?.langVersions?.evidence?.[0] ? ' ' + e.metrics.langVersions.evidence[0] : ''}`).join(', ')}${W}`);
  if (infras.length) lines.push(`  ${C}Infra${W}        ${B}${infras.map(e => e.source).join(', ')}${W}`);
  if (shells.length) {
    const sh = shells[0];
    const plugins = sh.metrics?.shellPlugins?.evidence || [];
    if (plugins.length) lines.push(`  ${C}Shell${W}        ${B}${plugins.slice(0, 6).join(', ')}${W}`);
  }
  return lines;
}

export { stripAnsi };
