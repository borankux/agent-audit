// New AI agent scanners — detect-only for agents without readable session data
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const isMac = platform() === 'darwin';

// ── Aider ────────────────────────────────
export function scanAider() {
  const aiderDir = join(HOME, '.aider');
  const detected = existsSync(aiderDir);
  const configFiles = [];
  if (existsSync(join(aiderDir, 'aider.conf.yml'))) configFiles.push('aider.conf.yml');

  return makeEvidence('aider', 'Aider', 'ai-agent', detected ? 'config' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Aider detected', { value: detected ? 1 : 0, status: detected ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: configFiles }),
    customRules: makeMetric('customRules', 'Config files', { value: configFiles.length > 0, status: configFiles.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.MEDIUM }),
  });
}

// ── Goose ────────────────────────────────
export function scanGoose() {
  const gooseDir = join(HOME, '.config', 'goose');
  const detected = existsSync(gooseDir);
  return makeEvidence('goose', 'Goose', 'ai-agent', detected ? 'config' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Goose detected', { value: detected ? 1 : 0, status: detected ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

// ── Cline ────────────────────────────────
export function scanCline() {
  // Cline is a VS Code extension
  const extDir = join(HOME, '.vscode', 'extensions');
  let detected = false;
  let version = '';
  if (existsSync(extDir)) {
    try {
      const exts = readdirSync(extDir);
      const cline = exts.find(e => e.toLowerCase().includes('cline'));
      if (cline) {
        detected = true;
        const match = cline.match(/cline-(\d+\.\d+\.\d+)/);
        if (match) version = match[1];
      }
    } catch {}
  }
  return makeEvidence('cline', 'Cline', 'ai-agent', detected ? 'detect' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Cline detected', { value: detected ? 1 : 0, status: detected ? STATUS.DETECTED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.LOW }),
  });
}

// ── Roo Code ─────────────────────────────
export function scanRooCode() {
  // Roo Code is a VS Code extension (formerly Roo Cline)
  const extDir = join(HOME, '.vscode', 'extensions');
  let detected = false;
  if (existsSync(extDir)) {
    try {
      const exts = readdirSync(extDir);
      detected = exts.some(e => e.toLowerCase().includes('roo-cline') || e.toLowerCase().includes('roocode'));
    } catch {}
  }
  // Also check for .roo directory
  const rooDir = join(HOME, '.roo');
  if (existsSync(rooDir)) detected = true;

  return makeEvidence('roo-code', 'Roo Code', 'ai-agent', detected ? 'detect' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Roo Code detected', { value: detected ? 1 : 0, status: detected ? STATUS.DETECTED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.LOW }),
  });
}

// ── Qwen Code ────────────────────────────
export function scanQwenCode() {
  const qwenDir = join(HOME, '.qwen-code');
  const detected = existsSync(qwenDir);
  return makeEvidence('qwen-code', 'Qwen Code', 'ai-agent', detected ? 'config' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Qwen Code detected', { value: detected ? 1 : 0, status: detected ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

// ── Windsurf ─────────────────────────────
export function scanWindsurf() {
  const app = isMac ? '/Applications/Windsurf.app' : '/usr/bin/windsurf';
  const detected = existsSync(app);
  const dataDir = isMac ? join(HOME, 'Library', 'Application Support', 'Windsurf') : join(HOME, '.config', 'Windsurf');

  let hasMCP = false;
  if (existsSync(join(dataDir, 'User', 'settings.json'))) {
    try {
      const d = JSON.parse(readFileSync(join(dataDir, 'User', 'settings.json'), 'utf8'));
      if (d['windsurf.mcpServers'] || d['mcpServers']) hasMCP = true;
    } catch {}
  }

  return makeEvidence('windsurf', 'Windsurf', 'ai-agent', detected ? 'config' : 'detect', {
    activeAgents: makeMetric('activeAgents', 'Windsurf detected', { value: detected ? 1 : 0, status: detected ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: hasMCP ? 1 : 0, status: hasMCP ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.MEDIUM }),
    ideDetected: makeMetric('ideDetected', 'Windsurf IDE', { value: detected, status: detected ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}
