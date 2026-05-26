import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

const HOME = homedir();

function getVSCodePaths() {
  if (platform() === 'darwin') {
    return {
      app: '/Applications/Visual Studio Code.app',
      extensions: join(HOME, '.vscode/extensions'),
    };
  }
  return {
    app: '/usr/bin/code',
    extensions: join(HOME, '.vscode/extensions'),
  };
}

export function detect() {
  const paths = getVSCodePaths();
  const hasApp = existsSync(paths.app);
  let hasCopilot = false;
  let copilotVersion = '';

  if (existsSync(paths.extensions)) {
    try {
      const exts = readdirSync(paths.extensions);
      const copilot = exts.find(e => e.toLowerCase().includes('copilot'));
      if (copilot) {
        hasCopilot = true;
        const match = copilot.match(/copilot-chat-(\d+\.\d+\.\d+)/);
        if (match) copilotVersion = match[1];
      }
    } catch {}
  }

  const detected = hasApp && hasCopilot;
  return {
    name: 'VS Code + Copilot',
    id: 'vscode-copilot',
    detected,
    dataPaths: detected ? [paths.app] : [],
    hasFullData: false,
    weight: 0.2,
  };
}

export function scanConfig() {
  return {
    hasCustomInstructions: false,
    customInstructionsSize: 0,
    mcpServers: [],
    plugins: [],
    hooks: [],
    skills: [],
    agents: [],
    envVars: 0,
  };
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
