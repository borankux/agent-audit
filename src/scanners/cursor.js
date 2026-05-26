import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

const HOME = homedir();

function getCursorPaths() {
  if (platform() === 'darwin') {
    return {
      app: '/Applications/Cursor.app',
      settings: join(HOME, 'Library/Application Support/Cursor/User/settings.json'),
    };
  }
  return {
    app: '/usr/bin/cursor',
    settings: join(HOME, '.config/Cursor/User/settings.json'),
  };
}

export function detect() {
  const paths = getCursorPaths();
  const detected = existsSync(paths.app);
  return {
    name: 'Cursor',
    id: 'cursor',
    detected,
    dataPaths: detected ? [paths.app] : [],
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

  const paths = getCursorPaths();
  if (existsSync(paths.settings)) {
    try {
      const d = JSON.parse(readFileSync(paths.settings, 'utf8'));
      // Cursor-specific MCP servers
      const mcps = d['cursor.general.mcpServers'] || d['mcpServers'] || {};
      r.mcpServers = Object.keys(mcps).sort();
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
