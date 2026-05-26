// 6-dimension scoring engine
import { STATUS, CONFIDENCE, isEvaluated, makeMetric } from './evidence.js';

// Dimension definitions
export const DIMENSIONS = [
  { id: 'envHealth',      label: 'Environment Health',       icon: '🏗', weight: 15 },
  { id: 'aiWorkflow',     label: 'AI Workflow Maturity',     icon: '🤖', weight: 25 },
  { id: 'toolchainDepth', label: 'Toolchain Depth',          icon: '🔧', weight: 20 },
  { id: 'verification',   label: 'Engineering Verification',  icon: '✅', weight: 20 },
  { id: 'automation',     label: 'Automation Depth',         icon: '⚡', weight: 10 },
  { id: 'security',       label: 'Security Hygiene',         icon: '🔒', weight: 10 },
];

export function scoreAll(evidences) {
  const dimScores = {};
  for (const dim of DIMENSIONS) {
    dimScores[dim.id] = scoreDimension(dim.id, evidences);
  }

  // Weighted average of applicable dimensions
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of DIMENSIONS) {
    const ds = dimScores[dim.id];
    if (ds.status === 'scored') {
      totalWeight += dim.weight;
      weightedSum += ds.score * dim.weight;
    }
  }

  const auraScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const confidence = computeOverallConfidence(dimScores);

  return {
    auraScore,
    confidence,
    dimensions: dimScores,
    developerType: classifyDeveloper(dimScores, evidences),
  };
}

function scoreDimension(dimId, evidences) {
  const findings = [];
  let score = 0;
  let maxScore = 0;
  let evidenceCount = 0;

  for (const ev of evidences) {
    const metrics = ev.metrics || {};
    for (const [key, m] of Object.entries(metrics)) {
      if (!isEvaluated(m)) continue;
      const dim = metricDimension(key);
      if (dim !== dimId) continue;

      evidenceCount++;
      const { pts, max, note } = scoreMetric(key, m.value);
      score += pts;
      maxScore += max;
      if (note) findings.push({ metric: key, value: m.value, pts, max, note });
    }
  }

  // Normalize to 0-100
  const normalized = maxScore > 0 ? Math.round(score / maxScore * 100) : 0;

  return {
    score: normalized,
    status: evidenceCount > 0 ? 'scored' : 'not_enough_evidence',
    confidence: evidenceCount >= 5 ? 'high' : evidenceCount >= 2 ? 'medium' : evidenceCount > 0 ? 'low' : 'unknown',
    findings,
    evidenceCount,
  };
}

function metricDimension(key) {
  // Environment Health metrics
  if (['nodeDetected', 'pythonDetected', 'goDetected', 'rustDetected', 'javaDetected',
       'gitDetected', 'dockerDetected', 'shellProfileDetected', 'pkgManagerDetected',
       'runtimeCount', 'langVersions'].includes(key)) return 'envHealth';

  // AI Workflow Maturity metrics
  if (['activeAgents', 'aiSessions', 'activeDays', 'toolCalls', 'fileEdits',
       'commandRuns', 'multiStepSessions', 'recentActivity', 'multiAgent',
       'tokensUsed', 'skillsInvoked', 'agentTypes', 'mcpServersUsed'].includes(key)) return 'aiWorkflow';

  // Toolchain Depth metrics
  if (['ideDetected', 'terminalDetected', 'mcpServers', 'customRules',
       'skillsCount', 'hooksCount', 'projectConfigs', 'globalConfigs',
       'toolsUsed', 'customSkills', 'customAgents'].includes(key)) return 'toolchainDepth';

  // Engineering Verification metrics
  if (['testCommands', 'buildCommands', 'lintCommands', 'typecheckCommands',
       'failedThenFixed', 'verifiedSessionsRatio', 'editThenVerify'].includes(key)) return 'verification';

  // Automation Depth metrics
  if (['scriptsCount', 'makefileDetected', 'packageScripts', 'githubActions',
       'preCommitHooks', 'agentHooks', 'automationConfigs', 'hooksConfigured'].includes(key)) return 'automation';

  // Security Hygiene metrics
  if (['secretsFound', 'dangerousHooks', 'autoApproveShell', 'broadFilesystemAccess',
       'unknownMcpServer', 'configPermissionRisk', 'unrestrictedShell'].includes(key)) return 'security';

  return 'envHealth'; // default
}

function scoreMetric(key, value) {
  const s = (v, mx) => ({ pts: v, max: mx, note: null });
  const sn = (v, mx, note) => ({ pts: v, max: mx, note });

  // Environment Health
  if (key === 'nodeDetected')    return value ? s(1, 1) : s(0, 1);
  if (key === 'pythonDetected')  return value ? s(1, 1) : s(0, 1);
  if (key === 'goDetected')      return value ? s(1, 1) : s(0, 1);
  if (key === 'rustDetected')    return value ? s(1, 1) : s(0, 1);
  if (key === 'javaDetected')    return value ? s(1, 1) : s(0, 1);
  if (key === 'gitDetected')     return value ? s(1, 1) : s(0, 1);
  if (key === 'dockerDetected')  return value ? s(1, 1) : s(0, 1);
  if (key === 'shellProfileDetected') return value ? s(1, 1) : s(0, 1);
  if (key === 'pkgManagerDetected')   return value ? s(1, 1) : s(0, 1);
  if (key === 'runtimeCount')   return sn(Math.min(value, 5), 5, `${value} runtimes`);
  if (key === 'langVersions')   return s(Math.min(value, 4), 4);

  // AI Workflow Maturity
  if (key === 'activeAgents')    return sn(Math.min(value, 3), 3, `${value} agents`);
  if (key === 'aiSessions') {
    if (value >= 200) return sn(10, 10, `${value} sessions`);
    if (value >= 50)  return sn(7, 10);
    if (value >= 10)  return sn(4, 10);
    return sn(Math.min(value, 2), 10);
  }
  if (key === 'activeDays') {
    if (value >= 30) return sn(10, 10, `${value} days`);
    if (value >= 15) return sn(7, 10);
    if (value >= 5)  return sn(4, 10);
    return sn(Math.min(value, 2), 10);
  }
  if (key === 'toolCalls') {
    if (value >= 1000) return sn(8, 8);
    if (value >= 200)  return sn(5, 8);
    if (value >= 30)   return sn(2, 8);
    return s(0, 8);
  }
  if (key === 'fileEdits') {
    if (value >= 500) return sn(6, 6);
    if (value >= 100) return sn(3, 6);
    return sn(Math.min(value, 1), 6);
  }
  if (key === 'commandRuns') {
    if (value >= 200) return sn(5, 5);
    if (value >= 50)  return sn(3, 5);
    return sn(Math.min(value, 1), 5);
  }
  if (key === 'multiStepSessions') return value ? sn(Math.min(value, 5), 5) : s(0, 5);
  if (key === 'recentActivity') return value ? s(3, 3) : s(0, 3);
  if (key === 'multiAgent') return value >= 3 ? sn(5, 5) : value >= 2 ? sn(3, 5) : sn(Math.min(value, 1), 5);
  if (key === 'tokensUsed') {
    if (value >= 50_000_000) return sn(5, 5);
    if (value >= 10_000_000) return sn(3, 5);
    if (value >= 1_000_000)  return sn(1, 5);
    return s(0, 5);
  }
  if (key === 'skillsInvoked') return sn(Math.min(value, 4), 4);
  if (key === 'agentTypes')    return sn(Math.min(value, 4), 4);
  if (key === 'mcpServersUsed') return sn(Math.min(value, 5), 5);

  // Toolchain Depth
  if (key === 'ideDetected')       return value ? s(2, 2) : s(0, 2);
  if (key === 'terminalDetected')  return value ? s(1, 1) : s(0, 1);
  if (key === 'mcpServers')       return sn(Math.min(value, 5), 5, `${value} MCP servers`);
  if (key === 'customRules')      return value ? s(3, 3) : s(0, 3);
  if (key === 'skillsCount')      return sn(Math.min(value, 5), 5);
  if (key === 'hooksCount')       return sn(Math.min(value, 3), 3);
  if (key === 'projectConfigs')   return sn(Math.min(value, 3), 3);
  if (key === 'globalConfigs')    return value ? s(2, 2) : s(0, 2);
  if (key === 'toolsUsed')        return sn(Math.min(value, 8), 8, `${value} tools`);
  if (key === 'customSkills')     return sn(Math.min(value, 5), 5);
  if (key === 'customAgents')     return sn(Math.min(value, 5), 5);

  // Engineering Verification
  if (key === 'testCommands')      return value >= 10 ? sn(5, 5) : value >= 3 ? sn(3, 5) : sn(Math.min(value, 1), 5);
  if (key === 'buildCommands')     return value >= 5 ? sn(4, 4) : sn(Math.min(value, 2), 4);
  if (key === 'lintCommands')      return value ? sn(Math.min(value, 3), 3) : s(0, 3);
  if (key === 'typecheckCommands') return value ? sn(Math.min(value, 3), 3) : s(0, 3);
  if (key === 'failedThenFixed')   return value >= 5 ? sn(5, 5) : sn(Math.min(value, 3), 5);
  if (key === 'verifiedSessionsRatio') {
    if (value >= 0.5) return sn(5, 5);
    if (value >= 0.2) return sn(3, 5);
    return sn(Math.round(value * 5), 5);
  }
  if (key === 'editThenVerify') {
    if (value >= 0.3) return sn(5, 5);
    if (value >= 0.1) return sn(3, 5);
    return sn(Math.round(value * 5), 5);
  }

  // Automation Depth
  if (key === 'scriptsCount')      return sn(Math.min(value, 3), 3);
  if (key === 'makefileDetected')  return value ? s(2, 2) : s(0, 2);
  if (key === 'packageScripts')    return value >= 5 ? sn(3, 3) : sn(Math.min(value, 1), 3);
  if (key === 'githubActions')     return value ? sn(Math.min(value, 3), 3) : s(0, 3);
  if (key === 'preCommitHooks')    return value ? s(2, 2) : s(0, 2);
  if (key === 'agentHooks')        return value ? s(3, 3) : s(0, 3);
  if (key === 'automationConfigs') return sn(Math.min(value, 3), 3);
  if (key === 'hooksConfigured')   return sn(Math.min(value, 3), 3);

  // Security Hygiene (inverted — fewer risks = higher score)
  if (key === 'secretsFound')       return sn(Math.max(0, 5 - value), 5);
  if (key === 'dangerousHooks')     return sn(Math.max(0, 3 - value), 3);
  if (key === 'autoApproveShell')   return value ? s(0, 3) : s(3, 3);
  if (key === 'broadFilesystemAccess') return value > 2 ? s(0, 3) : s(3, 3);
  if (key === 'unknownMcpServer')   return value > 2 ? s(0, 2) : s(2, 2);
  if (key === 'configPermissionRisk') return value ? s(0, 2) : s(2, 2);
  if (key === 'unrestrictedShell')  return value ? s(0, 3) : s(3, 3);

  return s(0, 0);
}

function computeOverallConfidence(dimScores) {
  const scored = Object.values(dimScores).filter(d => d.status === 'scored');
  if (scored.length === 0) return 'unknown';
  const highCount = scored.filter(d => d.confidence === 'high').length;
  if (highCount >= 4) return 'high';
  if (highCount >= 2) return 'medium';
  return 'low';
}

function classifyDeveloper(dimScores, evidences) {
  const ai = dimScores.aiWorkflow?.score || 0;
  const env = dimScores.envHealth?.score || 0;
  const tc = dimScores.toolchainDepth?.score || 0;
  const ver = dimScores.verification?.score || 0;
  const auto = dimScores.automation?.score || 0;

  // Detect categories
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && e.depth !== 'detect');
  const runtimes = evidences.filter(e => e.category === 'runtime');

  const hasMultiAgent = aiAgents.length >= 3;
  const hasFullstack = runtimes.length >= 3;
  const isAIHeavy = ai >= 70;
  const isTerminalHeavy = tc >= 60;

  if (isAIHeavy && hasMultiAgent && hasFullstack) return { type: 'AI-Native Fullstack Builder', rank: getRank(ai) };
  if (isAIHeavy && hasMultiAgent) return { type: 'Multi-Agent Orchestrator', rank: getRank(ai) };
  if (isAIHeavy && isTerminalHeavy) return { type: 'AI-Powered Terminal Hacker', rank: getRank(ai) };
  if (isAIHeavy) return { type: 'AI-Assisted Developer', rank: getRank(ai) };
  if (hasFullstack && env >= 60) return { type: 'Fullstack Engineer', rank: getRank(env) };
  if (auto >= 70) return { type: 'Automation Architect', rank: getRank(auto) };
  if (ver >= 70) return { type: 'Quality-Focused Engineer', rank: getRank(ver) };
  if (isTerminalHeavy) return { type: 'Toolchain Power User', rank: getRank(tc) };
  return { type: 'Developer', rank: getRank(env) };
}

function getRank(score) {
  if (score >= 90) return 'Expert';
  if (score >= 75) return 'Advanced';
  if (score >= 55) return 'Intermediate';
  if (score >= 30) return 'Developing';
  return 'Beginner';
}
