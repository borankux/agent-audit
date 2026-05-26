import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const GEMINI_DIR = join(HOME, '.gemini');

export function detect() {
  const detected = existsSync(GEMINI_DIR);
  return {
    name: 'Gemini CLI',
    id: 'gemini',
    detected,
    dataPaths: detected ? [GEMINI_DIR] : [],
    hasFullData: false, // config only, no session data found
    weight: 0.5,
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

  // GEMINI.md
  const mdPath = join(GEMINI_DIR, 'GEMINI.md');
  if (existsSync(mdPath)) {
    r.hasCustomInstructions = true;
    r.customInstructionsSize = statSync(mdPath).size;
  }

  // settings.json
  const settingsPath = join(GEMINI_DIR, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const d = JSON.parse(readFileSync(settingsPath, 'utf8'));
      // Auth type is config signal but not MCP
    } catch {}
  }

  // antigravity/mcp_config.json
  const mcpPath = join(GEMINI_DIR, 'antigravity', 'mcp_config.json');
  if (existsSync(mcpPath)) {
    try {
      const d = JSON.parse(readFileSync(mcpPath, 'utf8'));
      r.mcpServers = Object.keys(d.mcpServers || d.servers || {}).sort();
    } catch {}
  }

  // skills/
  const skillsDir = join(GEMINI_DIR, 'skills');
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
