import { readFileSync, readdirSync, statSync, existsSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { homedir } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const OC_DIR = join(HOME, '.openclaw');

export function detect() {
  const detected = existsSync(OC_DIR);
  return { name: 'OpenClaw', id: 'openclaw', detected, dataPaths: detected ? [OC_DIR] : [], hasFullData: false, weight: 0.5 };
}

export function scanConfig() {
  const r = { hasCustomInstructions: false, customInstructionsSize: 0, mcpServers: [], plugins: [], hooks: [], skills: [], agents: [], envVars: 0 };
  const mcpPath = join(OC_DIR, 'mcp.json');
  if (existsSync(mcpPath)) { try { const d = JSON.parse(readFileSync(mcpPath, 'utf8')); r.mcpServers = Object.keys(d.mcpServers || d.servers || {}).sort(); } catch {} }
  const skillsDir = join(OC_DIR, 'skills');
  if (existsSync(skillsDir)) { try { r.skills = readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory() || d.isSymbolicLink()).map(d => d.name).sort(); } catch {} }
  const agentsDir = join(OC_DIR, 'agents');
  if (existsSync(agentsDir)) { try { r.agents = readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort(); } catch {} }
  const cfgPath = join(OC_DIR, 'openclaw.json');
  if (existsSync(cfgPath)) { try { const d = JSON.parse(readFileSync(cfgPath, 'utf8')); r.envVars = Object.keys(d.env?.vars || {}).length; } catch {} }
  return r;
}

export async function scanSessions() {
  const r = { sessionCount: 0, activeDays: new Set(), tools: new Set(), models: new Set(), toolCalls: 0, first: null, last: null, hourlyCounts: new Array(24).fill(0) };
  const agentsDir = join(OC_DIR, 'agents');
  if (!existsSync(agentsDir)) return r;
  try {
    for (const ad of readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const sessionsDir = join(agentsDir, ad.name, 'sessions');
      if (!existsSync(sessionsDir)) continue;
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      r.sessionCount += files.length;
      for (const f of files) {
        try {
          const fp = join(sessionsDir, f);
          const mt = dateStr(new Date(statSync(fp).mtime));
          r.first = r.first ? minDate(r.first, mt) : mt; r.last = r.last ? maxDate(r.last, mt) : mt;
          r.activeDays.add(mt);
          const rl = createInterface({ input: createReadStream(fp, 'utf8'), crlfDelay: Infinity });
          for await (const line of rl) { if (!line) continue; try { const msg = JSON.parse(line); if (msg.type === 'model_change' && msg.model) r.models.add(msg.model); } catch {} }
        } catch {}
      }
    }
  } catch {}
  r.activeDays = r.activeDays.size;
  return r;
}

export function toEvidence(cfg, ses) {
  const detected = !!ses && ses.sessionCount > 0;
  return makeEvidence('openclaw', 'OpenClaw', 'ai-agent', detected ? 'config' : 'config', {
    activeAgents: makeMetric('activeAgents', 'Active agent', { value: 1, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
    aiSessions: makeMetric('aiSessions', 'Sessions', { value: ses?.sessionCount || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
    activeDays: makeMetric('activeDays', 'Active days', { value: ses?.activeDays || 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.MEDIUM }),
    mcpServers: makeMetric('mcpServers', 'MCP servers', { value: cfg.mcpServers.length, status: cfg.mcpServers.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    customSkills: makeMetric('customSkills', 'Skills', { value: cfg.skills.length, status: cfg.skills.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    customAgents: makeMetric('customAgents', 'Agents', { value: cfg.agents.length, status: cfg.agents.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

function dateStr(d) { return d.toISOString().substring(0, 10); }
function minDate(a, b) { return a < b ? a : b; }
function maxDate(a, b) { return a > b ? a : b; }
