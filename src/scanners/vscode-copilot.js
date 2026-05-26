import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();

export function detect() {
  const extDir = join(HOME, '.vscode/extensions');
  const hasApp = platform() === 'darwin' ? existsSync('/Applications/Visual Studio Code.app') : existsSync('/usr/bin/code');
  let hasCopilot = false;
  if (existsSync(extDir)) {
    try { hasCopilot = readdirSync(extDir).some(e => e.toLowerCase().includes('copilot')); } catch {}
  }
  const detected = hasApp && hasCopilot;
  return { name: 'VS Code + Copilot', id: 'vscode-copilot', detected, dataPaths: detected ? [] : [], hasFullData: false, weight: 0.2 };
}

export function scanConfig() {
  return { hasCustomInstructions: false, customInstructionsSize: 0, mcpServers: [], plugins: [], hooks: [], skills: [], agents: [], envVars: 0 };
}

export async function scanSessions() {
  return { sessionCount: 0, activeDays: 0, tools: new Set(), skills: new Set(), agentTypes: new Set(), mcpServers: new Set(), toolCalls: 0, first: null, last: null, tokens7d: { input: 0, output: 0, cache: 0 }, tokens30d: { input: 0, output: 0, cache: 0 }, tokensAll: { input: 0, output: 0, cache: 0 }, dailyTokens: {}, hourlyCounts: new Array(24).fill(0), models: new Set(), fileEdits: 0, commandRuns: 0, testCommands: 0, buildCommands: 0 };
}

export function toEvidence() {
  return makeEvidence('vscode-copilot', 'VS Code + Copilot', 'ai-agent', 'detect', {
    activeAgents: makeMetric('activeAgents', 'Copilot detected', { value: 1, status: STATUS.DETECTED, confidence: CONFIDENCE.LOW }),
    ideDetected: makeMetric('ideDetected', 'VS Code', { value: true, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
  });
}
