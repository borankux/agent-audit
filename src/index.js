import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { withSpinner } from './spinner.js';
import { showConsent } from './consent.js';
import { renderReport, stripAnsi } from './reporter.js';
import { computeScore, getLevel } from './scoring.js';
import { detectAll, SCANNERS } from './scanners/registry.js';

const flags = new Set(process.argv.slice(2));
const asJson = flags.has('--json');
const doSave = flags.has('--save') || flags.has('-s');
const skipConsent = flags.has('--accept');

async function main() {
  // Detect all agents
  const agentList = detectAll();
  const detected = agentList.filter(a => a.detected);

  if (!detected.length) {
    console.log(`\n  No coding agents found on this machine.\n`);
    process.exit(1);
  }

  // Consent
  if (!skipConsent && !asJson) {
    const ok = await showConsent(agentList);
    if (!ok) process.exit(0);
  }

  // Scan all detected agents
  const results = [];

  for (const scanner of SCANNERS) {
    const info = scanner.detect();
    if (!info.detected) continue;

    let cfg, ses;
    await withSpinner(`Scanning ${info.name} config...`, async () => {
      cfg = scanner.scanConfig();
    });
    await withSpinner(`Analyzing ${info.name} sessions...`, async () => {
      ses = await scanner.scanSessions();
    });

    const { total, scores, details } = computeScore(cfg, ses);
    results.push({ agent: info, config: cfg, sessions: ses, score: { total, scores, details } });
  }

  // Report
  const output = renderReport(results, asJson);
  console.log(output);

  if (doSave && !asJson) {
    const outPath = join(homedir(), 'agent-audit-report.txt');
    writeFileSync(outPath, stripAnsi(output));
    console.log(`  \x1b[32mSaved to ${outPath}\x1b[0m`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
