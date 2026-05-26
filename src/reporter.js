import { G, Y, R, C, B, D, W, M, BOX_H } from './ansi.js';
import { fmtTok, gradeColor, stripAnsi } from './formatters.js';
import { getLevel } from './scoring.js';

// ── Colors ──────────────────────────────────────────────
const DIM_BAR = "\x1b[38;5;240m";
const GOLD    = "\x1b[38;5;220m";
const LIME    = "\x1b[38;5;82m";
const SKY     = "\x1b[38;5;117m";
const ORANGE  = "\x1b[38;5;208m";
const PINK    = "\x1b[38;5;213m";
const PURPLE  = "\x1b[38;5;183m";
const TEAL    = "\x1b[38;5;123m";

const AGENT_COLORS = [LIME, SKY, ORANGE, PINK, PURPLE, TEAL, GOLD];

// ── Width helpers ───────────────────────────────────────
// ANSI escape sequence matcher
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visLen(s) { return s.replace(ANSI_RE, '').length; }

function padVis(s, targetLen, padRight = true) {
  const cur = visLen(s);
  const gap = targetLen - cur;
  if (gap <= 0) return s;
  return padRight ? s + ' '.repeat(gap) : ' '.repeat(gap) + s;
}

function truncVis(s, maxLen) {
  if (visLen(s) <= maxLen) return s;
  const raw = s.replace(ANSI_RE, '');
  return raw.slice(0, maxLen - 1) + '…';
}

export function renderReport(results, asJson = false) {
  if (asJson) return renderJson(results);
  return renderTerminal(results);
}

function renderJson(results) {
  const detected = results.filter(r => r.agent.detected);
  const agents = {};
  for (const r of detected) {
    agents[r.agent.id] = {
      detected: true,
      score: r.score?.total || 0,
      grade: r.score ? getLevel(r.score.total).grade : 'F',
      scores: r.score?.scores || {},
      sessions: r.sessions?.sessionCount || 0,
      activeDays: r.sessions?.activeDays || 0,
      tools: setSize(r.sessions?.tools) || 0,
      tokens: {
        last7d: r.sessions?.tokens7d || { input: 0, output: 0, cache: 0 },
        last30d: r.sessions?.tokens30d || { input: 0, output: 0, cache: 0 },
        all: r.sessions?.tokensAll || { input: 0, output: 0, cache: 0 },
      },
    };
  }

  const { total: aggScore, grade: aggGrade, level: aggLevel } = computeAggregate(detected);

  return JSON.stringify({
    version: '1.0.0',
    score: aggScore,
    grade: aggGrade,
    level: aggLevel,
    agents,
  }, null, 2);
}

// ── Layout constants ────────────────────────────────────
const INNER = 54;   // visible chars inside box borders
const BOX_W = 58;   // ── chars for top/bottom border
const PAD   = '  '; // left margin

function boxTop(accent)    { return `${PAD}${accent}┌${BOX_H.repeat(BOX_W)}┐${W}`; }
function boxMid(accent)    { return `${PAD}${accent}├${BOX_H.repeat(BOX_W)}┤${W}`; }
function boxBot(accent)    { return `${PAD}${accent}└${BOX_H.repeat(BOX_W)}┘${W}`; }
function boxRow(accent, content) {
  const inner = padVis(content, INNER);
  return `${PAD}${accent}│${W} ${inner} ${accent}│${W}`;
}

function renderTerminal(results) {
  const detected = results.filter(r => r.agent.detected);
  const scored = detected.filter(r => r.score);
  const { total: aggTotal, grade: aggGrade, level: aggLevel, bonus } = computeAggregate(detected);

  const gc = gradeColor(aggGrade);
  const now = new Date();
  const ts = now.toISOString().substring(0, 16).replace('T', ' ');

  const L = [];

  // ── Header ──────────────────────────────────────────
  L.push('');
  L.push(`  ${B}╔${'═'.repeat(BOX_W)}╗${W}`);
  L.push(`  ${B}║${W}${' '.repeat(BOX_W)}${B}║${W}`);
  const title = `${G}⚡${W}  ${B}Coding Agent Proficiency Audit${W}`;
  L.push(`  ${B}║${W}  ${padVis(title, BOX_W - 2)}${B}║${W}`);
  const sub = `${D}${ts} · local scan · nothing uploaded${W}`;
  L.push(`  ${B}║${W}      ${padVis(sub, BOX_W - 6)}${B}║${W}`);
  L.push(`  ${B}║${W}${' '.repeat(BOX_W)}${B}║${W}`);
  L.push(`  ${B}╚${'═'.repeat(BOX_W)}╝${W}`);
  L.push('');

  // ── Aggregate Score Hero ────────────────────────────
  const barW = 40;
  const filled = Math.round(aggTotal / 100 * barW);
  const bar = gc + '█'.repeat(filled) + DIM_BAR + '░'.repeat(barW - filled) + W;

  const heroLeft = `${B}${gc} ${aggGrade} ${String(aggTotal).padStart(3)}/100${W}`;
  const heroRight = `${B}${aggLevel}${W}`;
  const heroMid = visLen(bar);
  const heroTotal = visLen(heroLeft) + 1 + heroMid + 1 + visLen(heroRight);
  L.push(`  ${heroLeft} ${bar} ${heroRight}`);

  // Bonus line
  const bonusParts = [];
  if (scored.length >= 1) {
    const best = scored.reduce((a, b) => a.score.total > b.score.total ? a : b);
    bonusParts.push(`base: ${best.agent.name} ${best.score.total}`);
  }
  if (bonus.breadth > 0) bonusParts.push(`breadth +${bonus.breadth}`);
  if (bonus.ecosystem > 0) bonusParts.push(`ecosystem +${bonus.ecosystem}`);
  if (bonus.crossTool > 0) bonusParts.push(`cross-tool +${bonus.crossTool}`);
  if (bonusParts.length) {
    L.push(`  ${D}${bonusParts.join('  ·  ')}${W}`);
  }
  L.push('');

  // ── Per-Agent Score Cards ───────────────────────────
  const visible = scored.filter(r => r.score.total >= 15);
  for (let idx = 0; idx < visible.length; idx++) {
    const r = visible[idx];
    const s = r.score;
    const { grade: ag, level: al } = getLevel(s.total);
    const agc = gradeColor(ag);
    const accent = AGENT_COLORS[idx % AGENT_COLORS.length];

    L.push(boxTop(accent));

    // Header row: "Claude Code   A   89/100   Advanced User"
    const hdr = `${B}${r.agent.name}${W}  ${agc}${B}${ag}${W}  ${B}${String(s.total).padStart(3)}/100${W}  ${D}${al}${W}`;
    L.push(boxRow(accent, hdr));
    L.push(boxMid(accent));

    // Score bars: icon + label + bar + score
    const barMax = 30;
    for (const [label, key, icon] of [
      ['Config', 'config', '⚙'],
      ['Volume', 'volume', '📊'],
      ['Diversity', 'diversity', '🎯'],
      ['Workflow', 'sophistication', '⚡'],
    ]) {
      const v = s.scores[key];
      const barLen = Math.round(v / 25 * barMax);
      const barColor = v >= 20 ? G : v >= 12 ? Y : v >= 5 ? ORANGE : R;
      const filled2 = barColor + '█'.repeat(barLen) + W;
      const empty2 = D + '░'.repeat(barMax - barLen) + W;
      const scoreStr = `${String(v).padStart(2)}/25`;
      const row = `${icon} ${label.padEnd(10)} ${filled2}${empty2} ${B}${scoreStr}${W}`;
      L.push(boxRow(accent, row));
    }

    // Stats row
    const ses = r.sessions || {};
    const stats = [];
    if (ses.sessionCount) stats.push(`${ses.sessionCount} ses`);
    if (ses.activeDays) stats.push(`${ses.activeDays}d`);
    if (ses.toolCalls) stats.push(`${fmtTok(ses.toolCalls)} calls`);
    if (setSize(ses.tools)) stats.push(`${setSize(ses.tools)} tools`);
    if (stats.length) {
      L.push(boxRow(accent, `${D}${stats.join(' · ')}${W}`));
    }

    L.push(boxBot(accent));
    L.push('');
  }

  // Low-score or detection-only agents
  const hidden = detected.filter(r => !visible.includes(r));
  if (hidden.length) {
    const names = hidden.map(r => `${D}${r.agent.name}${W}`).join(` ${D}·${W} `);
    L.push(`  ${D}Also detected: ${names}${W}`);
    L.push('');
  }

  // ── Token Usage ─────────────────────────────────────
  const agg7 = { input: 0, output: 0, cache: 0 };
  const agg30 = { input: 0, output: 0, cache: 0 };
  const aggAll = { input: 0, output: 0, cache: 0 };
  let totalActiveDays = 0;
  const aggHourly = new Array(24).fill(0);

  for (const r of detected) {
    const t = r.sessions;
    if (!t) continue;
    for (const k of ['input', 'output', 'cache']) {
      agg7[k] += t.tokens7d?.[k] || 0;
      agg30[k] += t.tokens30d?.[k] || 0;
      aggAll[k] += t.tokensAll?.[k] || 0;
    }
    totalActiveDays = Math.max(totalActiveDays, t.activeDays || 0);
    if (t.hourlyCounts) for (let i = 0; i < 24; i++) aggHourly[i] += t.hourlyCounts[i] || 0;
  }

  const agg7t = agg7.input + agg7.output;
  const agg30t = agg30.input + agg30.output;
  const aggAllt = aggAll.input + aggAll.output;
  const ad = Math.max(totalActiveDays, 1);

  const colW = 10;
  L.push(`  ${B}── Token Usage ──────────────────────────────────────${W}`);
  const hdr7 = '7d', hdr30 = '30d', hdrAll = 'All';
  L.push(`  ${D}${' '.repeat(10)}${hdr7.padStart(colW)}${hdr30.padStart(colW)}${hdrAll.padStart(colW)}${W}`);
  for (const [label, k7, k30, ka] of [
    ['Input', agg7.input, agg30.input, aggAll.input],
    ['Output', agg7.output, agg30.output, aggAll.output],
    ['Cache', agg7.cache, agg30.cache, aggAll.cache],
  ]) {
    const row = `${D}${label.padEnd(8)}${W}${SKY}${fmtTok(k7).padStart(colW)}${W}${GOLD}${fmtTok(k30).padStart(colW)}${W}${LIME}${fmtTok(ka).padStart(colW)}${W}`;
    L.push(`  ${row}`);
  }
  L.push(`  ${D}${'─'.repeat(8)}${'─'.repeat(colW)}${'─'.repeat(colW)}${'─'.repeat(colW)}${W}`);
  L.push(`  ${B}Total${' '.repeat(3)}${W}${SKY}${fmtTok(agg7t).padStart(colW)}${W}${GOLD}${fmtTok(agg30t).padStart(colW)}${W}${B}${fmtTok(aggAllt).padStart(colW)}${W}`);
  L.push(`  ${D}         ${fmtTok(agg30t / ad).padStart(colW)}/day avg${W}`);
  L.push('');

  // ── Usage Heatmap ───────────────────────────────────
  const maxH = Math.max(...aggHourly, 1);
  L.push(`  ${B}── Activity Heatmap ─────────────────────────────────${W}`);

  for (const [start, ampm] of [[0, 'AM'], [12, 'PM']]) {
    let row = '  ';
    for (let h = start; h < start + 12; h++) {
      const pct = aggHourly[h] / maxH;
      let ch, clr;
      if (pct > 0.6) { ch = '██'; clr = LIME; }
      else if (pct > 0.3) { ch = '▓▓'; clr = SKY; }
      else if (pct > 0.1) { ch = '▒▒'; clr = GOLD; }
      else { ch = '░░'; clr = DIM_BAR; }
      row += `${clr}${ch}${W}`;
    }
    row += `  ${D}${ampm}${W}`;
    L.push(row);
  }

  const topHours = aggHourly.map((v, i) => [v, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .filter(([v]) => v > 0);
  if (topHours.length) {
    L.push(`  ${D}Peak:${W} ${B}${topHours.map(([, h]) => `${String(h).padStart(2, '0')}:00`).join(', ')}${W}`);
  }
  L.push('');

  // ── Details ─────────────────────────────────────────
  L.push(`  ${B}── Details ────────────────────────────────────────────${W}`);

  const allTools = new Set();
  const allModels = new Set();
  for (const r of detected) {
    const s = r.sessions;
    if (!s) continue;
    if (s.tools instanceof Set) for (const t of s.tools) allTools.add(t);
    if (s.models instanceof Set) for (const m of s.models) allModels.add(m);
  }

  const totalSessions = detected.reduce((s, r) => s + (r.sessions?.sessionCount || 0), 0);
  const totalCalls = detected.reduce((s, r) => s + (r.sessions?.toolCalls || 0), 0);

  L.push(`  ${C}Agents${W}        ${B}${detected.length}${W} detected, ${visible.length} with data`);
  L.push(`  ${C}Sessions${W}      ${B}${totalSessions.toLocaleString()}${W} total`);
  L.push(`  ${C}Tool calls${W}    ${B}${totalCalls.toLocaleString()}${W}`);
  L.push(`  ${C}Unique tools${W}  ${B}${allTools.size}${W}`);
  if (allModels.size) {
    const models = [...allModels].sort().slice(0, 4).join(', ');
    L.push(`  ${C}Models${W}        ${B}${models}${W}`);
  }
  L.push('');

  // ── Footer ──────────────────────────────────────────
  L.push(`  ${DIM_BAR}${'─'.repeat(58)}${W}`);
  L.push(`  ${D}🔒 No data uploaded · Safe to share with recruiters${W}`);
  L.push('');

  return L.join('\n');
}

// ── Aggregate Scoring ─────────────────────────────────
function computeAggregate(detected) {
  const scored = detected.filter(r => r.score);
  if (!scored.length) return { total: 0, grade: 'F', level: 'Not a user', bonus: {} };

  const bonus = { breadth: 0, ecosystem: 0, crossTool: 0 };

  const best = scored.reduce((a, b) => a.score.total > b.score.total ? a : b);
  let total = best.score.total;

  const activeAgents = scored.filter(r => r.score.total >= 20).length;
  if (activeAgents >= 2) bonus.breadth = 3;
  if (activeAgents >= 3) bonus.breadth = 5;
  if (activeAgents >= 4) bonus.breadth = 7;

  let hasSkills = 0, hasMcp = 0, hasHooks = 0;
  for (const r of scored) {
    if (r.config?.skills?.length >= 3) hasSkills++;
    if (r.config?.mcpServers?.length >= 1) hasMcp++;
    if (r.config?.hooks?.length >= 1) hasHooks++;
  }
  if (hasSkills >= 2 && hasMcp >= 2) bonus.ecosystem = 3;
  if (hasSkills >= 2 && hasMcp >= 2 && hasHooks >= 1) bonus.ecosystem = 5;

  let totalTokens = 0;
  for (const r of detected) {
    const t = r.sessions?.tokensAll;
    if (t) totalTokens += (t.input || 0) + (t.output || 0);
  }
  if (totalTokens > 10_000_000) bonus.crossTool = 2;
  if (totalTokens > 50_000_000) bonus.crossTool = 4;
  if (totalTokens > 200_000_000) bonus.crossTool = 5;

  total = Math.min(total + bonus.breadth + bonus.ecosystem + bonus.crossTool, 100);
  const { grade, level } = getLevel(total);
  return { total, grade, level, bonus };
}

function setSize(v) {
  if (v instanceof Set) return v.size;
  if (Array.isArray(v)) return v.length;
  return v || 0;
}

export { stripAnsi };
