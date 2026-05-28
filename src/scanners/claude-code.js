import { readFileSync, readdirSync, statSync, existsSync, createReadStream, openSync, closeSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const CLAUDE_JSON = join(HOME, '.claude.json');

export function detect() {
  const detected = existsSync(CLAUDE_DIR);
  return {
    name: 'Claude Code',
    id: 'claude-code',
    detected,
    dataPaths: detected ? [CLAUDE_DIR, CLAUDE_JSON] : [],
    hasFullData: detected,
    weight: 1.0,
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

  const mdPath = join(CLAUDE_DIR, 'CLAUDE.md');
  if (existsSync(mdPath)) {
    r.hasCustomInstructions = true;
    r.customInstructionsSize = statSync(mdPath).size;
  }

  if (existsSync(CLAUDE_JSON)) {
    try {
      const d = JSON.parse(readFileSync(CLAUDE_JSON, 'utf8'));
      let mcps = Object.keys(d.mcpServers || {});
      const projects = d.projects || {};
      for (const pc of Object.values(projects)) {
        mcps.push(...Object.keys(pc.mcpServers || {}));
      }
      r.mcpServers = [...new Set(mcps)].sort();
    } catch {}
  }

  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const d = JSON.parse(readFileSync(settingsPath, 'utf8'));
      const ep = d.enabledPlugins || {};
      r.plugins = Object.entries(ep).filter(([, v]) => v).map(([k]) => k).sort();
      r.hooks = Object.keys(d.hooks || {}).sort();
      r.envVars = Object.keys(d.env || {}).length;
    } catch {}
  }

  const skillsDir = join(CLAUDE_DIR, 'skills');
  if (existsSync(skillsDir)) {
    try {
      r.skills = readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name).sort();
    } catch {}
  }

  const agentsDir = join(CLAUDE_DIR, 'agents');
  if (existsSync(agentsDir)) {
    try {
      r.agents = readdirSync(agentsDir)
        .filter(f => f.endsWith('.md') || f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort();
    } catch {}
  }

  return r;
}

export async function scanSessions(days = 30, opts = {}) {
  const r = {
    sessionCount: 0,
    activeDays: new Set(),
    tools: new Set(),
    skills: new Set(),
    agentTypes: new Set(),
    mcpServers: new Set(),
    toolCalls: 0,
    first: null,
    last: null,
    tokens7d: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    tokens30d: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    tokensAll: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, totalBilled: 0, totalContext: 0 },
    dailyTokens: {},
    hourlyCounts: new Array(24).fill(0),
    models: new Set(),
    fileEdits: 0,
    commandRuns: 0,
    testCommands: 0,
    buildCommands: 0,
    lintCommands: 0,
    typecheckCommands: 0,
    scannedLines: 0,
    skippedLines: false,
    parseErrors: 0,
  };

  const pdir = join(CLAUDE_DIR, 'projects');
  if (!existsSync(pdir)) return r;

  const now = new Date();
  const cutoff30 = dateStr(daysAgo(now, 30));
  const cutoff7 = dateStr(daysAgo(now, 7));

  const files = walkJsonl(pdir);
  r.sessionCount = files.length;

  let scanned = 0;
  const MAX_LINES = opts.maxLines ?? 800_000;

  const VERIFY_COMMANDS = /test|spec|jest|mocha|pytest|vitest|cargo test|go test|npm test|pnpm test/;
  const BUILD_COMMANDS = /build|compile|make|cargo build|go build|npm run build|pnpm build/;
  const LINT_COMMANDS = /lint|eslint|prettier|flake8|black|cargo clippy|golangci-lint/;
  const TYPECHECK_COMMANDS = /tsc|typecheck|pyright|mypy|cargo check/;

  for (const jf of files) {
    if (scanned >= MAX_LINES) { r.skippedLines = true; break; }
    let fd;
    try {
      fd = openSync(jf, 'r');
    } catch { continue; }

    try {
      const mt = dateStr(new Date(statSync(jf).mtime));
      r.first = r.first ? minDate(r.first, mt) : mt;
      r.last = r.last ? maxDate(r.last, mt) : mt;

      const stream = createReadStream(jf, { fd, encoding: 'utf8', autoClose: false });
      stream.on('error', () => {});
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (scanned >= MAX_LINES) { r.skippedLines = true; break; }
        scanned++;
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { r.parseErrors++; continue; }

        if (msg.type !== 'assistant') continue;
        const message = msg.message || {};
        const content = message.content;
        if (!Array.isArray(content)) continue;

        if (mt >= cutoff30) r.activeDays.add(mt);

        const usage = message.usage || {};
        if (usage && typeof usage === 'object') {
          const inp = usage.input_tokens || 0;
          const out = usage.output_tokens || 0;
          const cacheRead = usage.cache_read_input_tokens || 0;
          const cacheCreation = usage.cache_creation_input_tokens || 0;

          r.tokensAll.input += inp;
          r.tokensAll.output += out;
          r.tokensAll.cacheRead += cacheRead;
          r.tokensAll.cacheCreation += cacheCreation;
          r.tokensAll.totalBilled += inp + out + cacheRead + cacheCreation;
          r.tokensAll.totalContext += inp + cacheRead;

          if (mt >= cutoff30) {
            r.tokens30d.input += inp; r.tokens30d.output += out;
            r.tokens30d.cacheRead += cacheRead; r.tokens30d.cacheCreation += cacheCreation;
          }
          if (mt >= cutoff7) {
            r.tokens7d.input += inp; r.tokens7d.output += out;
            r.tokens7d.cacheRead += cacheRead; r.tokens7d.cacheCreation += cacheCreation;
          }

          if (mt) {
            r.dailyTokens[mt] = (r.dailyTokens[mt] || 0) + inp + out + cacheRead;
          }
        }

        const ts = msg.timestamp || '';
        if (ts.length >= 16) {
          const h = parseInt(ts.substring(11, 13), 10);
          if (h >= 0 && h < 24) r.hourlyCounts[h]++;
        }

        const model = message.model || '';
        if (model) r.models.add(model);

        for (const blk of content) {
          if (!blk || blk.type !== 'tool_use') continue;
          const n = blk.name || '';
          const inp2 = blk.input || {};
          r.tools.add(n);
          r.toolCalls++;

          if (n === 'Edit' || n === 'Write') r.fileEdits++;
          if (n === 'Bash') {
            r.commandRuns++;
            const cmd = inp2.command || '';
            if (VERIFY_COMMANDS.test(cmd)) r.testCommands++;
            if (BUILD_COMMANDS.test(cmd)) r.buildCommands++;
            if (LINT_COMMANDS.test(cmd)) r.lintCommands++;
            if (TYPECHECK_COMMANDS.test(cmd)) r.typecheckCommands++;
          }

          if (n === 'Skill') {
            const sk = inp2.skill || '';
            if (sk) r.skills.add(sk);
          } else if (n === 'Task' || n === 'Agent') {
            const at = inp2.subagent_type || inp2.agent_type || 'general';
            r.agentTypes.add(at);
          } else if (n.startsWith('mcp__')) {
            const parts = n.split('__');
            if (parts.length >= 2) r.mcpServers.add(parts[1]);
          }
        }
      }
    } catch {} finally {
      try { closeSync(fd); } catch {}
    }
  }

  r.scannedLines = scanned;
  r.activeDays = r.activeDays.size;
  return r;
}

// Convert to evidence model
export function toEvidence(cfg, ses) {
  const detected = !!ses && ses.sessionCount > 0;
  return makeEvidence('claude-code', 'Claude Code', 'ai-agent', detected ? 'deep' : 'config', {
    activeAgents: makeMetric('activeAgents', 'Active agent', { value: detected ? 1 : 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    aiSessions: makeMetric('aiSessions', 'Sessions', { value: ses?.sessionCount || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    activeDays: makeMetric('activeDays', 'Active days', { value: ses?.activeDays || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    toolCalls: makeMetric('toolCalls', 'Tool calls', { value: ses?.toolCalls || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    fileEdits: makeMetric('fileEdits', 'File edits', { value: ses?.fileEdits || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    commandRuns: makeMetric('commandRuns', 'Commands run', { value: ses?.commandRuns || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    tokensUsed: makeMetric('tokensUsed', 'Tokens used', { value: (ses?.tokensAll?.input || 0) + (ses?.tokensAll?.output || 0) + (ses?.tokensAll?.cacheRead || 0) + (ses?.tokensAll?.cacheCreation || 0), status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    toolsUsed: makeMetric('toolsUsed', 'Unique tools', { value: ses?.tools?.size || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    skillsInvoked: makeMetric('skillsInvoked', 'Skills invoked', { value: ses?.skills?.size || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    agentTypes: makeMetric('agentTypes', 'Agent types', { value: ses?.agentTypes?.size || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    mcpServersUsed: makeMetric('mcpServersUsed', 'MCP servers used', { value: ses?.mcpServers?.size || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    customRules: makeMetric('customRules', 'Custom instructions', { value: cfg.hasCustomInstructions, status: cfg.hasCustomInstructions ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: cfg.mcpServers.length, status: cfg.mcpServers.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    customSkills: makeMetric('customSkills', 'Custom skills', { value: cfg.skills.length, status: cfg.skills.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    customAgents: makeMetric('customAgents', 'Custom agents', { value: cfg.agents.length, status: cfg.agents.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    hooksConfigured: makeMetric('hooksConfigured', 'Hooks', { value: cfg.hooks.length, status: cfg.hooks.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    testCommands: makeMetric('testCommands', 'Test commands', { value: ses?.testCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    buildCommands: makeMetric('buildCommands', 'Build commands', { value: ses?.buildCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    lintCommands: makeMetric('lintCommands', 'Lint commands', { value: ses?.lintCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    typecheckCommands: makeMetric('typecheckCommands', 'Typecheck commands', { value: ses?.typecheckCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    recentActivity: makeMetric('recentActivity', 'Recent activity', { value: (ses?.tokens7d?.input || 0) + (ses?.tokens7d?.output || 0) > 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
  });
}

// helpers
function walkJsonl(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) results.push(...walkJsonl(full));
      else if (e.name.endsWith('.jsonl') && !e.name.startsWith('agent-')) results.push(full);
    }
  } catch {}
  return results;
}
function daysAgo(now, n) { const d = new Date(now); d.setDate(d.getDate() - n); return d; }
function dateStr(d) { return d.toISOString().substring(0, 10); }
function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
