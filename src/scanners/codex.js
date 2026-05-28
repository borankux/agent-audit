import { readFileSync, readdirSync, statSync, existsSync, createReadStream, openSync, closeSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const CODEX_DIR = join(HOME, '.codex');

export function detect() {
  const detected = existsSync(CODEX_DIR);
  return { name: 'Codex CLI', id: 'codex', detected, dataPaths: detected ? [CODEX_DIR] : [], hasFullData: detected, weight: 1.0 };
}

export function scanConfig() {
  const r = { hasCustomInstructions: false, customInstructionsSize: 0, mcpServers: [], plugins: [], hooks: [], skills: [], agents: [], envVars: 0 };
  const mdPath = join(CODEX_DIR, 'AGENTS.md');
  if (existsSync(mdPath)) { r.hasCustomInstructions = true; r.customInstructionsSize = statSync(mdPath).size; }
  const tomlPath = join(CODEX_DIR, 'config.toml');
  if (existsSync(tomlPath)) {
    try { const parsed = parseToml(readFileSync(tomlPath, 'utf8')); r.mcpServers = parsed.mcpServers; r.plugins = parsed.plugins; r.envVars = parsed.envVars; } catch {}
  }
  const hooksPath = join(CODEX_DIR, 'hooks.json');
  if (existsSync(hooksPath)) {
    try { const d = JSON.parse(readFileSync(hooksPath, 'utf8')); r.hooks = Object.keys(d.hooks || {}).sort(); } catch {}
  }
  return r;
}

export async function scanSessions() {
  const r = {
    sessionCount: 0, activeDays: new Set(), tools: new Set(), skills: new Set(), agentTypes: new Set(),
    mcpServers: new Set(), toolCalls: 0, first: null, last: null,
    tokens7d: { input: 0, output: 0, cache: 0 }, tokens30d: { input: 0, output: 0, cache: 0 },
    tokensAll: { input: 0, output: 0, cache: 0 }, dailyTokens: {}, hourlyCounts: new Array(24).fill(0), models: new Set(),
    fileEdits: 0, commandRuns: 0, testCommands: 0, buildCommands: 0,
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
  const VERIFY_CMD = /test|spec|jest|mocha|pytest|cargo test|go test/;
  const BUILD_CMD = /build|compile|make|cargo build|go build/;

  for (const jf of files) {
    if (scanned >= MAX_LINES) break;
    let fd;
    try { fd = openSync(jf, 'r'); } catch { continue; }
    try {
      const mt = dateStr(new Date(statSync(jf).mtime));
      r.first = r.first ? minDate(r.first, mt) : mt; r.last = r.last ? maxDate(r.last, mt) : mt;
      const stream = createReadStream(jf, { fd, encoding: 'utf8', autoClose: false });
      stream.on('error', () => {});
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      let lastTokenUsage = null;
      for await (const line of rl) {
        if (scanned >= MAX_LINES) break; scanned++;
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        const type = msg.type; const payload = msg.payload || {};
        if (mt >= cutoff30) r.activeDays.add(mt);
        if (type === 'event_msg' && payload.type === 'token_count' && payload.info) {
          const usage = payload.info.total_token_usage || payload.info.last_token_usage;
          if (usage && usage.input_tokens !== undefined) lastTokenUsage = { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cache: usage.cached_input_tokens || 0 };
        }
        if (type === 'response_item' && payload.type === 'function_call') { r.toolCalls++; r.tools.add(payload.name || 'unknown'); }
        if (type === 'event_msg' && payload.type === 'exec_command_end') { r.toolCalls++; r.tools.add('exec_command'); r.commandRuns++; if (VERIFY_CMD.test(payload.command || '')) r.testCommands++; if (BUILD_CMD.test(payload.command || '')) r.buildCommands++; }
        if (type === 'session_meta' && payload.cli_version) r.models.add(`codex@${payload.cli_version}`);
        const ts = msg.ts || msg.timestamp || '';
        if (ts && typeof ts === 'string' && ts.length >= 16) { try { const h = parseInt(ts.substring(11, 13), 10); if (h >= 0 && h < 24) r.hourlyCounts[h]++; } catch {} }
      }
      if (lastTokenUsage) {
        r.tokensAll.input += lastTokenUsage.input; r.tokensAll.output += lastTokenUsage.output; r.tokensAll.cache += lastTokenUsage.cache;
        if (mt >= cutoff30) { r.tokens30d.input += lastTokenUsage.input; r.tokens30d.output += lastTokenUsage.output; r.tokens30d.cache += lastTokenUsage.cache; }
        if (mt >= cutoff7) { r.tokens7d.input += lastTokenUsage.input; r.tokens7d.output += lastTokenUsage.output; r.tokens7d.cache += lastTokenUsage.cache; }
      }
    } catch {} finally {
      try { closeSync(fd); } catch {}
    }
  }
  r.activeDays = r.activeDays.size;
  return r;
}

export function toEvidence(cfg, ses) {
  const detected = !!ses && ses.sessionCount > 0;
  return makeEvidence('codex', 'Codex CLI', 'ai-agent', detected ? 'deep' : 'config', {
    activeAgents: makeMetric('activeAgents', 'Active agent', { value: detected ? 1 : 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    aiSessions: makeMetric('aiSessions', 'Sessions', { value: ses?.sessionCount || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    activeDays: makeMetric('activeDays', 'Active days', { value: ses?.activeDays || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    toolCalls: makeMetric('toolCalls', 'Tool calls', { value: ses?.toolCalls || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    commandRuns: makeMetric('commandRuns', 'Commands run', { value: ses?.commandRuns || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    tokensUsed: makeMetric('tokensUsed', 'Tokens used', { value: (ses?.tokensAll?.input || 0) + (ses?.tokensAll?.output || 0), status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    toolsUsed: makeMetric('toolsUsed', 'Unique tools', { value: ses?.tools?.size || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    customRules: makeMetric('customRules', 'Custom instructions', { value: cfg.hasCustomInstructions, status: cfg.hasCustomInstructions ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: cfg.mcpServers.length, status: cfg.mcpServers.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    hooksConfigured: makeMetric('hooksConfigured', 'Hooks', { value: cfg.hooks.length, status: cfg.hooks.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    testCommands: makeMetric('testCommands', 'Test commands', { value: ses?.testCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    buildCommands: makeMetric('buildCommands', 'Build commands', { value: ses?.buildCommands || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
    recentActivity: makeMetric('recentActivity', 'Recent activity', { value: (ses?.tokens7d?.input || 0) + (ses?.tokens7d?.output || 0) > 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH }),
  });
}

function parseToml(txt) {
  const result = { mcpServers: [], plugins: [], envVars: 0 };
  let currentSection = '';
  for (const line of txt.split('\n')) {
    const trimmed = line.trim();
    const secMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (secMatch) {
      currentSection = secMatch[1];
      const mcpMatch = currentSection.match(/^mcp_servers\.(.+)$/);
      if (mcpMatch) result.mcpServers.push(mcpMatch[1]);
      continue;
    }
    if (currentSection.startsWith('plugins.') && trimmed === 'enabled = true') {
      const pluginMatch = currentSection.match(/^plugins\."(.+)"$/);
      if (pluginMatch) result.plugins.push(pluginMatch[1]);
      continue;
    }
    if (currentSection === 'shell_environment_policy.set' && /^[A-Z_]+\s*=/.test(trimmed)) result.envVars++;
  }
  result.mcpServers.sort(); result.plugins.sort();
  return result;
}
function walkJsonl(dir) { const results = []; try { const entries = readdirSync(dir, { withFileTypes: true }); for (const e of entries) { const full = join(dir, e.name); if (e.isDirectory()) results.push(...walkJsonl(full)); else if (e.name.endsWith('.jsonl')) results.push(full); } } catch {} return results; }
function daysAgo(now, n) { const d = new Date(now); d.setDate(d.getDate() - n); return d; }
function dateStr(d) { return d.toISOString().substring(0, 10); }
function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
