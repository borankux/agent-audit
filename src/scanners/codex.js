import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const CODEX_DIR = join(HOME, '.codex');

export function detect() {
  const detected = existsSync(CODEX_DIR);
  return {
    name: 'Codex CLI',
    id: 'codex',
    detected,
    dataPaths: detected ? [CODEX_DIR] : [],
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

  // AGENTS.md
  const mdPath = join(CODEX_DIR, 'AGENTS.md');
  if (existsSync(mdPath)) {
    r.hasCustomInstructions = true;
    r.customInstructionsSize = statSync(mdPath).size;
  }

  // config.toml — minimal parser
  const tomlPath = join(CODEX_DIR, 'config.toml');
  if (existsSync(tomlPath)) {
    try {
      const txt = readFileSync(tomlPath, 'utf8');
      const parsed = parseToml(txt);
      r.mcpServers = parsed.mcpServers;
      r.plugins = parsed.plugins;
      r.envVars = parsed.envVars;
    } catch {}
  }

  // hooks.json
  const hooksPath = join(CODEX_DIR, 'hooks.json');
  if (existsSync(hooksPath)) {
    try {
      const d = JSON.parse(readFileSync(hooksPath, 'utf8'));
      r.hooks = Object.keys(d.hooks || {}).sort();
    } catch {}
  }

  return r;
}

export async function scanSessions() {
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

  const sessionsDir = join(CODEX_DIR, 'sessions');
  if (!existsSync(sessionsDir)) return r;

  const files = walkJsonl(sessionsDir);
  r.sessionCount = files.length;

  const now = new Date();
  const cutoff30 = dateStr(daysAgo(now, 30));
  const cutoff7 = dateStr(daysAgo(now, 7));

  let scanned = 0;
  const MAX_LINES = 200_000;

  for (const jf of files) {
    try {
      const mt = dateStr(new Date(statSync(jf).mtime));
      r.first = r.first ? minDate(r.first, mt) : mt;
      r.last = r.last ? maxDate(r.last, mt) : mt;

      const rl = createInterface({ input: createReadStream(jf, 'utf8'), crlfDelay: Infinity });

      // Track last token count per session (Codex reports cumulative totals)
      let lastTokenUsage = null;

      for await (const line of rl) {
        if (scanned >= MAX_LINES) break;
        scanned++;
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }

        const type = msg.type;
        const payload = msg.payload || {};
        if (mt >= cutoff30) r.activeDays.add(mt);

        // token_count in event_msg (cumulative — save last value per session)
        if (type === 'event_msg' && payload.type === 'token_count' && payload.info) {
          const usage = payload.info.total_token_usage || payload.info.last_token_usage;
          if (usage && usage.input_tokens !== undefined) {
            lastTokenUsage = {
              input: usage.input_tokens || 0,
              output: usage.output_tokens || 0,
              cache: usage.cached_input_tokens || 0,
            };
          }
        }

        // function_call in response_item
        if (type === 'response_item' && payload.type === 'function_call') {
          r.toolCalls++;
          r.tools.add(payload.name || 'unknown');
        }

        // exec_command_end in event_msg
        if (type === 'event_msg' && payload.type === 'exec_command_end') {
          r.toolCalls++;
          r.tools.add('exec_command');
        }

        // session_meta → model + version
        if (type === 'session_meta') {
          if (payload.cli_version) r.models.add(`codex@${payload.cli_version}`);
        }

        // Hourly distribution
        const ts = msg.ts || msg.timestamp || '';
        if (ts && typeof ts === 'string' && ts.length >= 16) {
          try {
            const h = parseInt(ts.substring(11, 13), 10);
            if (h >= 0 && h < 24) r.hourlyCounts[h]++;
          } catch {}
        } else if (typeof ts === 'number') {
          const d = new Date(ts * 1000);
          r.hourlyCounts[d.getHours()]++;
        }
      }

      // Apply last cumulative token count for this session
      if (lastTokenUsage) {
        r.tokensAll.input += lastTokenUsage.input;
        r.tokensAll.output += lastTokenUsage.output;
        r.tokensAll.cache += lastTokenUsage.cache;
        if (mt >= cutoff30) {
          r.tokens30d.input += lastTokenUsage.input;
          r.tokens30d.output += lastTokenUsage.output;
          r.tokens30d.cache += lastTokenUsage.cache;
        }
        if (mt >= cutoff7) {
          r.tokens7d.input += lastTokenUsage.input;
          r.tokens7d.output += lastTokenUsage.output;
          r.tokens7d.cache += lastTokenUsage.cache;
        }
      }
    } catch {}
  }

  r.activeDays = r.activeDays.size;
  return r;
}

// Minimal TOML parser for config.toml patterns
function parseToml(txt) {
  const result = { mcpServers: [], plugins: [], envVars: 0 };
  let currentSection = '';

  for (const line of txt.split('\n')) {
    const trimmed = line.trim();

    // Section headers
    const secMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (secMatch) {
      currentSection = secMatch[1];
      // [mcp_servers.xxx]
      const mcpMatch = currentSection.match(/^mcp_servers\.(.+)$/);
      if (mcpMatch) result.mcpServers.push(mcpMatch[1]);
      continue;
    }

    // enabled = true under [plugins."xxx@yyy"]
    if (currentSection.startsWith('plugins.') && trimmed === 'enabled = true') {
      const pluginMatch = currentSection.match(/^plugins\."(.+)"$/);
      if (pluginMatch) result.plugins.push(pluginMatch[1]);
      continue;
    }

    // Count env vars under [shell_environment_policy.set]
    if (currentSection === 'shell_environment_policy.set') {
      if (/^[A-Z_]+\s*=/.test(trimmed)) result.envVars++;
    }
  }

  result.mcpServers.sort();
  result.plugins.sort();
  return result;
}

function walkJsonl(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...walkJsonl(full));
      } else if (e.name.endsWith('.jsonl')) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

function daysAgo(now, n) { const d = new Date(now); d.setDate(d.getDate() - n); return d; }
function dateStr(d) { return d.toISOString().substring(0, 10); }
function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
