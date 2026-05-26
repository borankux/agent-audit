import * as claudeCode from './claude-code.js';
import * as codex from './codex.js';
import * as gemini from './gemini.js';
import * as openclaw from './openclaw.js';
import * as cursor from './cursor.js';
import * as vscodeCopilot from './vscode-copilot.js';
import * as cont from './continue.js';

const SCANNERS = [
  claudeCode,
  codex,
  gemini,
  openclaw,
  cursor,
  vscodeCopilot,
  cont,
];

export function detectAll() {
  return SCANNERS.map(s => s.detect());
}

export function getScanner(id) {
  return SCANNERS.find(s => {
    const info = s.detect();
    return info.id === id;
  });
}

export { SCANNERS };
