import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { withSpinner } from './spinner.js';
import { showConsent } from './consent.js';
import { parseArgs, showHelp } from './cli.js';
import { scoreAll } from './core/scoring.js';
import { computeBadges } from './core/badges.js';
import { generateRecommendations } from './core/recommendations.js';
import { redact } from './core/privacy.js';
import { explainPaths } from './core/privacy.js';
import { computePowerScores } from './core/power-score.js';
import { AI_SCANNERS, NEW_AGENT_SCANNERS, detectAllAgents, detectNewAgents } from './scanners/registry.js';
import { scanEnvironment } from './scanners/env-scan.js';
import { scanSecurity } from './scanners/security-scan.js';
import { scanUnsupported, getKnownUnsupportedList } from './scanners/unsupported.js';
import { renderTerminal, stripAnsi } from './renderers/terminal.js';
import { renderJson } from './renderers/json-renderer.js';
import { renderHtml } from './renderers/html.js';
import { renderMarkdown } from './renderers/markdown.js';
import { renderCard } from './renderers/card.js';
import { stripAnsi as stripAnsiFn } from './formatters.js';
import { G, W, B, D, C, Y, R } from './ansi.js';

async function main() {
  const args = parseArgs();

  // Handle special commands
  if (args.command === 'help') { console.log(showHelp()); return; }
  if (args.command === 'version') {
    const pkg = JSON.parse(await import('fs').then(fs => fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
    console.log(`DevAura v${pkg.version}`); return;
  }
  if (args.command === 'explainPaths') { console.log(explainPaths()); return; }
  if (args.command === 'compare') { console.log('Compare mode coming in v0.3'); return; }
  if (args.command === 'team') { console.log('Team mode coming in v0.3'); return; }
  if (args.command === 'leaderboard') { console.log('Leaderboard mode coming in v0.2'); return; }

  // ── Discover mode ─────────────────────────────────
  if (args.command === 'discover') {
    runDiscover();
    return;
  }

  // ── Debug mode ────────────────────────────────────
  if (args.command === 'debug') {
    const target = args.file1 || args.file2;
    if (!target) {
      console.log(`\n  ${R}Usage: devaura debug <agent-id>${W}`);
      console.log(`  Available: ${B}claude-code${W}, ${B}codex${W}, ${B}gemini${W}, ${B}openclaw${W}\n`);
      return;
    }
    await runDebug(target, args);
    return;
  }

  // ── Detect agents ──────────────────────────────────
  const agentList = detectAllAgents();
  const detected = agentList.filter(a => a.detected);

  if (!detected.length && args.mode !== 'security') {
    console.log(`\n  No AI coding agents detected on this machine.`);
    console.log(`  Run ${B}devaura scan --focus env${W} to scan your development environment.\n`);
  }

  // ── Consent ────────────────────────────────────────
  if (!args.flags.has('accept') && args.format === 'terminal' && args.command !== 'card') {
    const ok = await showConsent(agentList);
    if (!ok) process.exit(0);
  }

  // ── Scan options ───────────────────────────────────
  const isPowerUser = args.mode === 'power-user';
  const isFull = args.flags.has('full') || isPowerUser;
  const maxLines = args.maxLines ?? (isFull ? Infinity : 800_000);

  // ── Collect evidence ───────────────────────────────
  const evidences = [];
  const sessionsData = {};
  const scanMeta = { maxLines, scannedAgents: [] };

  // Scan environment
  if (args.mode !== 'security') {
    await withSpinner('Scanning environment...', async () => {
      evidences.push(...scanEnvironment());
    });
  }

  // Scan AI agents (existing)
  for (const scanner of AI_SCANNERS) {
    const info = scanner.detect();
    if (!info.detected) continue;

    let cfg, ses;
    await withSpinner(`Scanning ${info.name} config...`, async () => { cfg = scanner.scanConfig(); });
    await withSpinner(`Analyzing ${info.name} sessions...`, async () => {
      ses = await scanner.scanSessions(30, { maxLines });
    });

    // Convert to evidence model
    const ev = scanner.toEvidence ? scanner.toEvidence(cfg, ses) : null;
    if (ev) evidences.push(ev);

    // Keep raw session data for token stats
    if (ses && (ses.sessionCount > 0 || ses.tokensAll)) {
      sessionsData[info.id] = ses;
    }
    scanMeta.scannedAgents.push({ id: info.id, name: info.name, sessions: ses?.sessionCount || 0, scannedLines: ses?.scannedLines || 0, skipped: ses?.skippedLines || false });
  }

  // Scan new AI agents
  for (const { scan, name } of NEW_AGENT_SCANNERS) {
    const ev = scan();
    if (Object.values(ev.metrics).some(m => m.status !== 'not_detected')) {
      evidences.push(ev);
    }
  }

  // Scan unsupported agents (discover or power-user mode)
  if (isFull || args.mode === 'power-user') {
    const unsupported = scanUnsupported();
    evidences.push(...unsupported);
  }

  // Scan security
  if (args.mode !== 'team') {
    await withSpinner('Checking security...', async () => {
      evidences.push(scanSecurity());
    });
  }

  // ── Power Scores ───────────────────────────────────
  const powerScores = computePowerScores(evidences, sessionsData);

  // ── Score ──────────────────────────────────────────
  const { auraScore, confidence, dimensions, developerType } = scoreAll(evidences, sessionsData, powerScores);
  const badges = computeBadges(dimensions, evidences);
  const recommendations = generateRecommendations(dimensions, evidences);

  const report = {
    auraScore,
    confidence,
    dimensions,
    developerType,
    powerScores,
    badges,
    recommendations,
    evidences,
    sessions: sessionsData,
    scanMeta,
  };

  // ── Apply redaction if needed ──────────────────────
  const shouldRedact = args.flags.has('redact') || args.mode === 'recruiter';
  if (shouldRedact) {
    report.evidences = redact(report.evidences);
    report.sessions = redact(report.sessions);
  }

  // ── Render output ──────────────────────────────────
  let output;
  let ext;

  if (args.command === 'card' || args.format === 'card') {
    output = renderCard(report);
    ext = 'svg';
  } else if (args.format === 'json') {
    output = renderJson(report);
    ext = 'json';
  } else if (args.format === 'html') {
    output = renderHtml(report);
    ext = 'html';
  } else if (args.format === 'markdown') {
    output = renderMarkdown(report);
    ext = 'md';
  } else {
    output = renderTerminal(report);
    ext = 'txt';
  }

  console.log(output);

  // ── Save ───────────────────────────────────────────
  if (args.flags.has('save') || args.format === 'html' || args.format === 'card') {
    const isPlainText = args.format === 'terminal' || args.format === 'markdown';
    const outPath = join(homedir(), `devaura-report.${ext}`);
    writeFileSync(outPath, isPlainText ? stripAnsi(output) : output);
    console.log(`\n  ${G}Saved to ${outPath}${W}`);

    if (args.flags.has('open') && (ext === 'html' || ext === 'svg')) {
      try { execSync(`open "${outPath}"`, { stdio: 'ignore' }); } catch {}
    }
  }
}

async function runDebug(agentId, args) {
  const scanner = AI_SCANNERS.find(s => {
    const info = s.detect();
    return info.id === agentId;
  });

  if (!scanner) {
    console.log(`\n  ${R}Unknown agent: ${agentId}${W}`);
    console.log(`  Available: claude-code, codex, gemini, openclaw\n`);
    return;
  }

  const info = scanner.detect();
  if (!info.detected) {
    console.log(`\n  ${Y}${info.name} is not detected on this machine.${W}\n`);
    return;
  }

  console.log(`\n  ${B}═══ Debug: ${info.name} ═══${W}\n`);

  const cfg = scanner.scanConfig();
  console.log(`  ${C}Config:${W}`);
  console.log(JSON.stringify(cfg, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

  const maxLines = args.maxLines ?? Infinity;
  console.log(`\n  ${C}Scanning sessions (maxLines: ${maxLines === Infinity ? 'unlimited' : maxLines})...${W}`);

  const ses = await scanner.scanSessions(30, { maxLines });

  console.log(`\n  ${C}Session stats:${W}`);
  const debugInfo = {
    sessionCount: ses.sessionCount,
    activeDays: ses.activeDays,
    first: ses.first,
    last: ses.last,
    toolCalls: ses.toolCalls,
    fileEdits: ses.fileEdits,
    commandRuns: ses.commandRuns,
    testCommands: ses.testCommands,
    buildCommands: ses.buildCommands,
    lintCommands: ses.lintCommands || 0,
    typecheckCommands: ses.typecheckCommands || 0,
    scannedLines: ses.scannedLines,
    skippedLines: ses.skippedLines,
    parseErrors: ses.parseErrors || 0,
    tools: [...(ses.tools || [])].sort(),
    skills: [...(ses.skills || [])].sort(),
    agentTypes: [...(ses.agentTypes || [])].sort(),
    mcpServers: [...(ses.mcpServers || [])].sort(),
    models: [...(ses.models || [])].sort(),
  };
  console.log(JSON.stringify(debugInfo, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

  console.log(`\n  ${C}Token breakdown:${W}`);
  const tokens = {
    all: ses.tokensAll,
    '30d': ses.tokens30d,
    '7d': ses.tokens7d,
  };
  console.log(JSON.stringify(tokens, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

  if (ses.skippedLines) {
    console.log(`\n  ${Y}⚠ Session data was truncated (scanned ${ses.scannedLines} lines). Usage may be undercounted.${W}`);
    console.log(`  Run ${B}devaura debug ${agentId} --full${W} for unlimited scan.\n`);
  }

  if (ses.dailyTokens && Object.keys(ses.dailyTokens).length > 0) {
    console.log(`\n  ${C}Daily token activity (last 30d):${W}`);
    const sorted = Object.entries(ses.dailyTokens).sort(([a], [b]) => b.localeCompare(a));
    for (const [date, tokens] of sorted) {
      const bar = '█'.repeat(Math.min(Math.round(tokens / 100000), 40));
      console.log(`  ${D}${date}${W} ${bar} ${B}${(tokens / 1000).toFixed(0)}K${W}`);
    }
  }

  console.log();
}

function runDiscover() {
  console.log(`\n  ${B}═══ DevAura Discover ═══${W}`);
  console.log(`  ${D}Detecting all known development tools...${W}\n`);

  // Known supported
  const agentList = detectAllAgents();
  const newAgents = detectNewAgents();

  const allDetected = [
    ...agentList.map(a => ({ ...a, supported: true })),
    ...newAgents.map(a => ({ ...a, supported: true })),
  ];

  // Check unsupported
  const unsupported = scanUnsupported();

  console.log(`  ${G}Supported & Detected:${W}`);
  for (const a of allDetected.filter(a => a.detected)) {
    console.log(`    ${G}✓${W} ${B}${a.name || a.id}${W} ${D}(supported)${W}`);
  }

  if (unsupported.length) {
    console.log(`\n  ${Y}Detected but unsupported:${W}`);
    for (const u of unsupported) {
      const paths = u.metrics?.activeAgents?.evidence || [];
      console.log(`    ${Y}⚠${W} ${B}${u.source}${W} ${D}(not supported — not included in score)${W}`);
      for (const p of paths) {
        console.log(`       ${D}→ ${p}${W}`);
      }
    }
  }

  // Show all known unsupported
  console.log(`\n  ${C}Known unsupported tools:${W}`);
  const knownList = getKnownUnsupportedList();
  for (const a of knownList) {
    const found = unsupported.some(u => u.id === a.id);
    console.log(`    ${found ? Y : D}${found ? '●' : '○'}${W} ${a.name} ${D}(check: ${[...a.searchPaths, ...a.commands.map(c => `\`${c}\``)].join(', ')})${W}`);
  }

  console.log(`\n  ${D}Run ${B}devaura scan --html --full${W} for a complete report.${W}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
