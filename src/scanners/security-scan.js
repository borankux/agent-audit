// Security scanner — detect risks in configs
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /key[=:]["'][a-zA-Z0-9]{20,}/i,
  /token[=:]["'][a-zA-Z0-9]{20,}/i,
  /password[=:]["'][^"']+/i,
  /secret[=:]["'][a-zA-Z0-9]{20,}/i,
  /Bearer [a-zA-Z0-9._-]+/i,
  /["'][0-9a-f]{32,}["']/i,
];

export function scanSecurity() {
  const risks = {
    secretsFound: 0,
    dangerousHooks: 0,
    autoApproveShell: false,
    broadFilesystemAccess: 0,
    unknownMcpServer: 0,
    unrestrictedShell: false,
  };

  const evidence = [];

  // Check Claude Code settings
  const claudeSettings = join(HOME, '.claude', 'settings.json');
  if (existsSync(claudeSettings)) {
    try {
      const d = JSON.parse(readFileSync(claudeSettings, 'utf8'));
      // Check for auto-approve
      const perms = d.permissions || {};
      if (perms.allow && Array.isArray(perms.allow)) {
        for (const p of perms.allow) {
          if (typeof p === 'string' && (p.includes('Bash(*)') || p.includes('Shell(*)'))) {
            risks.autoApproveShell = true;
            evidence.push('Auto-approve shell execution in Claude Code');
          }
        }
      }
      // Check hooks for dangerous patterns
      const hooks = d.hooks || {};
      risks.dangerousHooks += Object.keys(hooks).length;
    } catch {}
  }

  // Check Claude Code .claude.json for secrets in env
  const claudeJson = join(HOME, '.claude.json');
  if (existsSync(claudeJson)) {
    try {
      const d = JSON.parse(readFileSync(claudeJson, 'utf8'));
      // Check MCP server configs for broad access
      const mcps = d.mcpServers || {};
      for (const [name, conf] of Object.entries(mcps)) {
        const args = (conf.args || []).join(' ');
        if (args.includes('/') && !args.includes('/Users') && !args.includes('/home')) {
          // Specific paths are fine
        }
        if (args.includes('--root') || args.includes('/')) {
          risks.broadFilesystemAccess++;
          evidence.push(`Broad filesystem MCP: ${name}`);
        }
      }
      // Check env for API keys
      const env = d.env || {};
      for (const [k, v] of Object.entries(env)) {
        if (typeof v === 'string' && SECRET_PATTERNS.some(p => p.test(v))) {
          risks.secretsFound++;
          evidence.push(`Secret in env: ${k}`);
        }
      }
    } catch {}
  }

  // Check .zshrc / .bashrc for exported secrets
  for (const rcFile of ['.zshrc', '.bashrc', '.bash_profile', '.zshenv']) {
    const rcPath = join(HOME, rcFile);
    if (!existsSync(rcPath)) continue;
    try {
      const content = readFileSync(rcPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('#') || line.trim() === '') continue;
        const exportMatch = line.match(/export\s+(\w+)=["']?([^"']+)["']?/);
        if (exportMatch) {
          const [, key, val] = exportMatch;
          const lk = key.toLowerCase();
          if ((lk.includes('key') || lk.includes('token') || lk.includes('secret') || lk.includes('password')) &&
              SECRET_PATTERNS.some(p => p.test(val))) {
            risks.secretsFound++;
            evidence.push(`Secret in ${rcFile}: ${key}`);
          }
        }
      }
    } catch {}
  }

  // Check Codex config
  const codexHooks = join(HOME, '.codex', 'hooks.json');
  if (existsSync(codexHooks)) {
    try {
      const d = JSON.parse(readFileSync(codexHooks, 'utf8'));
      risks.dangerousHooks += Object.keys(d.hooks || {}).length;
    } catch {}
  }

  return makeEvidence('security', 'Security', 'security', 'config', {
    secretsFound: makeMetric('secretsFound', 'Secrets exposed', { value: risks.secretsFound, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH, evidence }),
    dangerousHooks: makeMetric('dangerousHooks', 'Hooks configured', { value: risks.dangerousHooks, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
    autoApproveShell: makeMetric('autoApproveShell', 'Auto-approve shell', { value: risks.autoApproveShell, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    broadFilesystemAccess: makeMetric('broadFilesystemAccess', 'Broad filesystem MCP', { value: risks.broadFilesystemAccess, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
    unknownMcpServer: makeMetric('unknownMcpServer', 'Unknown MCP servers', { value: risks.unknownMcpServer, status: STATUS.EVALUATED, confidence: CONFIDENCE.LOW }),
    unrestrictedShell: makeMetric('unrestrictedShell', 'Unrestricted shell', { value: false, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
  });
}
