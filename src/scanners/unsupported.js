// Unsupported agent detection — detect tools we know about but can't deeply scan
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execSync } from 'child_process';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const isMac = platform() === 'darwin';

function run(cmd) {
  try { return execSync(cmd, { timeout: 3000, encoding: 'utf8' }).trim(); } catch { return ''; }
}

const KNOWN_UNSUPPORTED = [
  {
    id: 'grok',
    name: 'Grok',
    paths: [join(HOME, '.grok')],
    commands: ['grok'],
  },
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    paths: [join(HOME, '.kimi')],
    commands: ['kimi'],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    paths: [join(HOME, '.opencode')],
    commands: ['opencode'],
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    paths: [join(HOME, '.hermes')],
    commands: ['hermes'],
  },
  {
    id: 'amp',
    name: 'Amp',
    paths: [join(HOME, '.amp')],
    commands: ['amp'],
  },
  {
    id: 'devin',
    name: 'Devin',
    paths: [join(HOME, '.devin')],
    commands: [],
  },
  {
    id: 'sweep',
    name: 'Sweep',
    paths: [join(HOME, '.sweep')],
    commands: ['sweep'],
  },
  {
    id: 'tabnine',
    name: 'Tabnine',
    paths: [join(HOME, '.tabnine')],
    commands: ['tabnine'],
  },
  {
    id: 'copilot-cli',
    name: 'GitHub Copilot CLI',
    paths: [],
    commands: ['github-copilot-cli', 'gh-copilot'],
  },
];

export function scanUnsupported() {
  const results = [];

  for (const agent of KNOWN_UNSUPPORTED) {
    let detected = false;
    const evidence = [];

    // Check paths
    for (const p of agent.paths) {
      if (existsSync(p)) {
        detected = true;
        evidence.push(p.replace(HOME, '~'));
      }
    }

    // Check commands
    for (const cmd of agent.commands) {
      if (run(`which ${cmd} 2>/dev/null`)) {
        detected = true;
        evidence.push(`command: ${cmd}`);
      }
    }

    if (detected) {
      results.push(makeEvidence(agent.id, agent.name, 'ai-agent', 'unsupported', {
        activeAgents: makeMetric('activeAgents', `${agent.name} detected`, {
          value: 1,
          status: STATUS.NOT_SUPPORTED,
          confidence: CONFIDENCE.LOW,
          evidence,
        }),
      }));
    }
  }

  return results;
}

export function getKnownUnsupportedList() {
  return KNOWN_UNSUPPORTED.map(a => ({
    id: a.id,
    name: a.name,
    searchPaths: a.paths.map(p => p.replace(HOME, '~')),
    commands: a.commands,
  }));
}
