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
import { AI_SCANNERS, NEW_AGENT_SCANNERS, detectAllAgents, detectNewAgents } from './scanners/registry.js';
import { scanEnvironment } from './scanners/env-scan.js';
import { scanSecurity } from './scanners/security-scan.js';
import { renderTerminal, stripAnsi } from './renderers/terminal.js';
import { renderJson } from './renderers/json-renderer.js';
import { renderHtml } from './renderers/html.js';
import { renderMarkdown } from './renderers/markdown.js';
import { renderCard } from './renderers/card.js';
import { stripAnsi as stripAnsiFn } from './formatters.js';
import { G, W, B, D, C } from './ansi.js';

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

  // ── Detect agents ──────────────────────────────────
  const agentList = detectAllAgents();
  const detected = agentList.filter(a => a.detected);

  if (!detected.length && args.mode !== 'security') {
    console.log(`\n  No AI coding agents detected on this machine.`);
    console.log(`  Run ${B}devaura scan --focus env${W} to scan your development environment.\n`);
    // Continue with env scan anyway
  }

  // ── Consent ────────────────────────────────────────
  if (!args.flags.has('accept') && args.format === 'terminal' && args.command !== 'card') {
    const ok = await showConsent(agentList);
    if (!ok) process.exit(0);
  }

  // ── Collect evidence ───────────────────────────────
  const evidences = [];
  const sessionsData = {};

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
    await withSpinner(`Analyzing ${info.name} sessions...`, async () => { ses = await scanner.scanSessions(); });

    // Convert to evidence model
    const ev = scanner.toEvidence ? scanner.toEvidence(cfg, ses) : null;
    if (ev) evidences.push(ev);

    // Keep raw session data for token stats
    if (ses && (ses.sessionCount > 0 || ses.tokensAll)) {
      sessionsData[info.id] = ses;
    }
  }

  // Scan new AI agents
  for (const { scan, name } of NEW_AGENT_SCANNERS) {
    const ev = scan();
    if (Object.values(ev.metrics).some(m => m.status !== 'not_detected')) {
      evidences.push(ev);
    }
  }

  // Scan security
  if (args.mode !== 'team') {
    await withSpinner('Checking security...', async () => {
      evidences.push(scanSecurity());
    });
  }

  // ── Score ──────────────────────────────────────────
  const { auraScore, confidence, dimensions, developerType } = scoreAll(evidences);
  const badges = computeBadges(dimensions, evidences);
  const recommendations = generateRecommendations(dimensions, evidences);

  const report = {
    auraScore,
    confidence,
    dimensions,
    developerType,
    badges,
    recommendations,
    evidences,
    sessions: sessionsData,
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

main().catch(e => { console.error(e); process.exit(1); });
