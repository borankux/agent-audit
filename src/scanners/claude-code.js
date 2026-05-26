import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';

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
        .map(d => d.name)
        .sort();
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

export async function scanSessions(days = 30) {
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
    tokens7d: { input: 0, output: 0, cache: 0 },
    tokens30d: { input: 0, output: 0, cache: 0 },
    tokensAll: { input: 0, output: 0, cache: 0 },
    dailyTokens: {},
    hourlyCounts: new Array(24).fill(0),
    models: new Set(),
  };

  const pdir = join(CLAUDE_DIR, 'projects');
  if (!existsSync(pdir)) return r;

  const now = new Date();
  const cutoff30 = dateStr(daysAgo(now, 30));
  const cutoff7 = dateStr(daysAgo(now, 7));

  const files = walkJsonl(pdir);
  r.sessionCount = files.length;

  let scanned = 0;
  const MAX_LINES = 800_000;

  for (const jf of files) {
    try {
      const mt = dateStr(new Date(statSync(jf).mtime));
      r.first = r.first ? minDate(r.first, mt) : mt;
      r.last = r.last ? maxDate(r.last, mt) : mt;

      const rl = createInterface({ input: createReadStream(jf, 'utf8'), crlfDelay: Infinity });
      for await (const line of rl) {
        if (scanned >= MAX_LINES) break;
        scanned++;
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        if (msg.type !== 'assistant') continue;
        const message = msg.message || {};
        const content = message.content;
        if (!Array.isArray(content)) continue;

        if (mt >= cutoff30) r.activeDays.add(mt);

        const usage = message.usage || {};
        if (usage && typeof usage === 'object') {
          const inp = usage.input_tokens || 0;
          const out = usage.output_tokens || 0;
          const cache = usage.cache_read_input_tokens || 0;
          r.tokensAll.input += inp;
          r.tokensAll.output += out;
          r.tokensAll.cache += cache;
          if (mt >= cutoff30) {
            r.tokens30d.input += inp;
            r.tokens30d.output += out;
            r.tokens30d.cache += cache;
          }
          if (mt >= cutoff7) {
            r.tokens7d.input += inp;
            r.tokens7d.output += out;
            r.tokens7d.cache += cache;
          }
          if (!r.dailyTokens[mt]) r.dailyTokens[mt] = { input: 0, output: 0, cache: 0 };
          r.dailyTokens[mt].input += inp;
          r.dailyTokens[mt].output += out;
          r.dailyTokens[mt].cache += cache;
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
          const inp = blk.input || {};
          r.tools.add(n);
          r.toolCalls++;
          if (n === 'Skill') {
            const sk = inp.skill || '';
            if (sk) r.skills.add(sk);
          } else if (n === 'Task' || n === 'Agent') {
            const at = inp.subagent_type || inp.agent_type || 'general';
            r.agentTypes.add(at);
          } else if (n.startsWith('mcp__')) {
            const parts = n.split('__');
            if (parts.length >= 2) r.mcpServers.add(parts[1]);
          }
        }
      }
    } catch {}
  }

  r.activeDays = r.activeDays.size;
  return r;
}

// helpers

function walkJsonl(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...walkJsonl(full));
      } else if (e.name.endsWith('.jsonl') && !e.name.startsWith('agent-')) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

function daysAgo(now, n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  return d.toISOString().substring(0, 10);
}

function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
