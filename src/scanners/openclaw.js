import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const OC_DIR = join(HOME, '.openclaw');

export function detect() {
  const detected = existsSync(OC_DIR);
  return {
    name: 'OpenClaw',
    id: 'openclaw',
    detected,
    dataPaths: detected ? [OC_DIR] : [],
    hasFullData: false, // config + light session
    weight: 0.5,
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

  // openclaw.json
  const cfgPath = join(OC_DIR, 'openclaw.json');
  if (existsSync(cfgPath)) {
    try {
      const d = JSON.parse(readFileSync(cfgPath, 'utf8'));
      r.envVars = Object.keys(d.env?.vars || {}).length;
      // Count agents from workspace-* directories
    } catch {}
  }

  // mcp.json
  const mcpPath = join(OC_DIR, 'mcp.json');
  if (existsSync(mcpPath)) {
    try {
      const d = JSON.parse(readFileSync(mcpPath, 'utf8'));
      r.mcpServers = Object.keys(d.mcpServers || d.servers || {}).sort();
    } catch {}
  }

  // skills/
  const skillsDir = join(OC_DIR, 'skills');
  if (existsSync(skillsDir)) {
    try {
      r.skills = readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isSymbolicLink())
        .map(d => d.name)
        .sort();
    } catch {}
  }

  // agents/ — workspace-* directories
  const agentsDir = join(OC_DIR, 'agents');
  if (!existsSync(agentsDir)) {
    // Count workspace-* dirs from openclaw root
    try {
      const entries = readdirSync(OC_DIR, { withFileTypes: true });
      r.agents = entries
        .filter(e => e.isDirectory() && e.name.startsWith('workspace-'))
        .map(e => e.name)
        .sort();
    } catch {}
  } else {
    try {
      r.agents = readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    } catch {}
  }

  // IDENTITY.md as custom instructions proxy
  const identityPath = join(OC_DIR, 'workspace-backup-20260317074247', 'IDENTITY.md');
  if (existsSync(identityPath)) {
    r.hasCustomInstructions = true;
    r.customInstructionsSize = statSync(identityPath).size;
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

  // Walk agents/*/sessions/*.jsonl
  const agentsDir = join(OC_DIR, 'agents');
  if (!existsSync(agentsDir)) return r;

  try {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const ad of agentDirs) {
      const sessionsDir = join(agentsDir, ad.name, 'sessions');
      if (!existsSync(sessionsDir)) continue;

      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      r.sessionCount += files.length;

      for (const f of files) {
        try {
          const fp = join(sessionsDir, f);
          const mt = dateStr(new Date(statSync(fp).mtime));
          r.first = r.first ? minDate(r.first, mt) : mt;
          r.last = r.last ? maxDate(r.last, mt) : mt;
          r.activeDays.add(mt);

          const rl = createInterface({ input: createReadStream(fp, 'utf8'), crlfDelay: Infinity });
          for await (const line of rl) {
            if (!line) continue;
            let msg;
            try { msg = JSON.parse(line); } catch { continue; }

            if (msg.type === 'model_change' && msg.model) {
              r.models.add(msg.model);
            }
          }
        } catch {}
      }
    }
  } catch {}

  r.activeDays = r.activeDays.size;
  return r;
}

function dateStr(d) { return d.toISOString().substring(0, 10); }
function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
