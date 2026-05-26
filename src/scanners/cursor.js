import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
function getCursorPaths() {
  return platform() === 'darwin'
    ? { app: '/Applications/Cursor.app', settings: join(HOME, 'Library/Application Support/Cursor/User/settings.json') }
    : { app: '/usr/bin/cursor', settings: join(HOME, '.config/Cursor/User/settings.json') };
}

export function detect() {
  const paths = getCursorPaths();
  const detected = existsSync(paths.app);
  return { name: 'Cursor', id: 'cursor', detected, dataPaths: detected ? [paths.app] : [], hasFullData: false, weight: 0.2 };
}

export function scanConfig() {
  const r = { hasCustomInstructions: false, customInstructionsSize: 0, mcpServers: [], plugins: [], hooks: [], skills: [], agents: [], envVars: 0 };
  const paths = getCursorPaths();
  if (existsSync(paths.settings)) {
    try { const d = JSON.parse(readFileSync(paths.settings, 'utf8')); r.mcpServers = Object.keys(d['cursor.general.mcpServers'] || d['mcpServers'] || {}).sort(); } catch {}
  }
  return r;
}

export async function scanSessions() {
  return { sessionCount: 0, activeDays: 0, tools: new Set(), skills: new Set(), agentTypes: new Set(), mcpServers: new Set(), toolCalls: 0, first: null, last: null, tokens7d: { input: 0, output: 0, cache: 0 }, tokens30d: { input: 0, output: 0, cache: 0 }, tokensAll: { input: 0, output: 0, cache: 0 }, dailyTokens: {}, hourlyCounts: new Array(24).fill(0), models: new Set(), fileEdits: 0, commandRuns: 0, testCommands: 0, buildCommands: 0 };
}

export function toEvidence(cfg) {
  return makeEvidence('cursor', 'Cursor', 'ai-agent', 'detect', {
    activeAgents: makeMetric('activeAgents', 'Cursor detected', { value: 1, status: STATUS.DETECTED, confidence: CONFIDENCE.LOW }),
    ideDetected: makeMetric('ideDetected', 'Cursor IDE', { value: true, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: cfg.mcpServers.length, status: cfg.mcpServers.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.MEDIUM }),
  });
}
