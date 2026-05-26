import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const CONTINUE_DIR = join(HOME, '.continue');

export function detect() {
  const detected = existsSync(CONTINUE_DIR);
  return {
    name: 'Continue',
    id: 'continue',
    detected,
    dataPaths: detected ? [CONTINUE_DIR] : [],
    hasFullData: false,
    weight: 0.2,
  };
}

export function scanConfig() {
  const r = {
    hasCustomInstructions: false,
    customInstructionsSize: 0,
    mcpServers: [],
    plugins: [],
    hooks: [],
    skills: [],
    agents: [],
    envVars: 0,
  };

  // config.json
  const cfgPath = join(CONTINUE_DIR, 'config.json');
  if (existsSync(cfgPath)) {
    try {
      const d = JSON.parse(readFileSync(cfgPath, 'utf8'));
      r.mcpServers = Object.keys(d.mcpServers || {}).sort();
    } catch {}
  }

  // skills/
  const skillsDir = join(CONTINUE_DIR, 'skills');
  if (existsSync(skillsDir)) {
    try {
      r.skills = readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink())
        .map(d => d.name)
        .sort();
    } catch {}
  }

  return r;
}

export async function scanSessions() {
  return {
    sessionCount: 0,
    activeDays: 0,
    tools: new Set(),
    skills: new Set(),
    agentTypes: new Set(),
    mcpServers: new Set(),
    toolCalls: 0,
    first: null,
    last: null,
    tokens7d: { input: 0, output: 0, cache: 0 },
    tokens30d: { input: 0, output: 0, cache: 0 },
    tokensAll: { input: 0, output: 0, cache: 0 },
    dailyTokens: {},
    hourlyCounts: new Array(24).fill(0),
    models: new Set(),
  };
}
