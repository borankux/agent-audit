// Scanner registry — all scanners registered here
import * as claudeCode from './claude-code.js';
import * as codex from './codex.js';
import * as gemini from './gemini.js';
import * as openclaw from './openclaw.js';
import * as cursor from './cursor.js';
import * as vscodeCopilot from './vscode-copilot.js';
import * as cont from './continue.js';
import { scanAider, scanGoose, scanCline, scanRooCode, scanQwenCode, scanWindsurf } from './new-agents.js';
import { scanEnvironment } from './env-scan.js';
import { scanSecurity } from './security-scan.js';

// AI agent scanners (with detect/scanConfig/scanSessions interface)
const AI_SCANNERS = [
  claudeCode, codex, gemini, openclaw, cursor, vscodeCopilot, cont,
];

// New agent scanners (return Evidence directly)
const NEW_AGENT_SCANNERS = [
  { id: 'aider', name: 'Aider', scan: scanAider },
  { id: 'goose', name: 'Goose', scan: scanGoose },
  { id: 'cline', name: 'Cline', scan: scanCline },
  { id: 'roo-code', name: 'Roo Code', scan: scanRooCode },
  { id: 'qwen-code', name: 'Qwen Code', scan: scanQwenCode },
  { id: 'windsurf', name: 'Windsurf', scan: scanWindsurf },
];

export { AI_SCANNERS, NEW_AGENT_SCANNERS };

export function detectAllAgents() {
  return AI_SCANNERS.map(s => s.detect());
}

export function detectNewAgents() {
  return NEW_AGENT_SCANNERS.map(s => {
    const evidence = s.scan();
    return {
      id: s.id,
      name: s.name,
      detected: evidence.depth !== 'detect' || Object.values(evidence.metrics).some(m => m.status !== 'not_detected'),
      evidence,
    };
  });
}
