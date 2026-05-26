import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const GEMINI_DIR = join(HOME, '.gemini');

export function detect() {
  const detected = existsSync(GEMINI_DIR);
  return { name: 'Gemini CLI', id: 'gemini', detected, dataPaths: detected ? [GEMINI_DIR] : [], hasFullData: false, weight: 0.5 };
}

export function scanConfig() {
  const r = { hasCustomInstructions: false, customInstructionsSize: 0, mcpServers: [], plugins: [], hooks: [], skills: [], agents: [], envVars: 0 };
  const mdPath = join(GEMINI_DIR, 'GEMINI.md');
  if (existsSync(mdPath)) { r.hasCustomInstructions = true; r.customInstructionsSize = statSync(mdPath).size; }
  const mcpPath = join(GEMINI_DIR, 'antigravity', 'mcp_config.json');
  if (existsSync(mcpPath)) { try { const d = JSON.parse(readFileSync(mcpPath, 'utf8')); r.mcpServers = Object.keys(d.mcpServers || d.servers || {}).sort(); } catch {} }
  const skillsDir = join(GEMINI_DIR, 'skills');
  if (existsSync(skillsDir)) { try { r.skills = readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory() || d.isSymbolicLink()).map(d => d.name).sort(); } catch {} }
  return r;
}

export async function scanSessions() {
  return { sessionCount: 0, activeDays: 0, tools: new Set(), skills: new Set(), agentTypes: new Set(), mcpServers: new Set(), toolCalls: 0, first: null, last: null, tokens7d: { input: 0, output: 0, cache: 0 }, tokens30d: { input: 0, output: 0, cache: 0 }, tokensAll: { input: 0, output: 0, cache: 0 }, dailyTokens: {}, hourlyCounts: new Array(24).fill(0), models: new Set(), fileEdits: 0, commandRuns: 0, testCommands: 0, buildCommands: 0 };
}

export function toEvidence(cfg) {
  return makeEvidence('gemini', 'Gemini CLI', 'ai-agent', 'config', {
    activeAgents: makeMetric('activeAgents', 'Active agent', { value: 1, status: STATUS.DETECTED, confidence: CONFIDENCE.MEDIUM }),
    customRules: makeMetric('customRules', 'Custom instructions', { value: cfg.hasCustomInstructions, status: cfg.hasCustomInstructions ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: cfg.mcpServers.length, status: cfg.mcpServers.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    customSkills: makeMetric('customSkills', 'Skills', { value: cfg.skills.length, status: cfg.skills.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}
