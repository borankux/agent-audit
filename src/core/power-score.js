// AI Power Score — independent of auraScore, measures AI tool usage intensity

export function computePowerScores(evidences, sessions) {
  const aiPowerScore = computeAIPowerScore(evidences, sessions);
  const primaryAgentPowerScore = computePrimaryAgentScore(evidences, sessions);
  const evidenceCoverageScore = computeEvidenceCoverage(evidences);

  return { aiPowerScore, primaryAgentPowerScore, evidenceCoverageScore };
}

function computeAIPowerScore(evidences, sessions) {
  let score = 0;
  let maxScore = 0;

  // Aggregate token data from sessions
  let totalTokens = 0;
  let totalInput = 0, totalOutput = 0, totalCache = 0;
  let totalSessions = 0, totalActiveDays = 0;
  let totalToolCalls = 0, totalFileEdits = 0, totalCommandRuns = 0;
  let totalSkills = 0, totalAgentTypes = 0, totalMcpUsed = 0;
  let tokens7d = 0, tokens30d = 0;

  if (sessions) {
    for (const s of Object.values(sessions)) {
      if (!s) continue;
      const inp = s.tokensAll?.input || 0;
      const out = s.tokensAll?.output || 0;
      const cache = s.tokensAll?.cache || 0;
      totalInput += inp;
      totalOutput += out;
      totalCache += cache;
      totalTokens += inp + out + cache;
      totalSessions += s.sessionCount || 0;
      totalActiveDays += s.activeDays || 0;
      totalToolCalls += s.toolCalls || 0;
      totalFileEdits += s.fileEdits || 0;
      totalCommandRuns += s.commandRuns || 0;
      totalSkills += s.skills?.size || 0;
      totalAgentTypes += s.agentTypes?.size || 0;
      totalMcpUsed += s.mcpServers?.size || 0;
      tokens7d += (s.tokens7d?.input || 0) + (s.tokens7d?.output || 0) + (s.tokens7d?.cache || 0);
      tokens30d += (s.tokens30d?.input || 0) + (s.tokens30d?.output || 0) + (s.tokens30d?.cache || 0);
    }
  }

  // Also check evidence metrics for agents without sessions
  for (const ev of evidences) {
    if (ev.category !== 'ai-agent') continue;
    const m = ev.metrics || {};
    if (!sessions || !sessions[ev.id]) {
      totalToolCalls += m.toolCalls?.value || 0;
      totalSessions += m.aiSessions?.value || 0;
      totalActiveDays += m.activeDays?.value || 0;
    }
  }

  // Total tokens (0-25)
  maxScore += 25;
  if (totalTokens >= 500_000_000) score += 25;
  else if (totalTokens >= 100_000_000) score += 20;
  else if (totalTokens >= 50_000_000) score += 16;
  else if (totalTokens >= 10_000_000) score += 12;
  else if (totalTokens >= 1_000_000) score += 8;
  else if (totalTokens >= 100_000) score += 4;
  else if (totalTokens > 0) score += 1;

  // Sessions (0-15)
  maxScore += 15;
  if (totalSessions >= 500) score += 15;
  else if (totalSessions >= 200) score += 12;
  else if (totalSessions >= 50) score += 8;
  else if (totalSessions >= 10) score += 4;
  else if (totalSessions > 0) score += 1;

  // Active days (0-15)
  maxScore += 15;
  if (totalActiveDays >= 60) score += 15;
  else if (totalActiveDays >= 30) score += 12;
  else if (totalActiveDays >= 15) score += 8;
  else if (totalActiveDays >= 5) score += 4;
  else if (totalActiveDays > 0) score += 1;

  // Tool calls (0-15)
  maxScore += 15;
  if (totalToolCalls >= 5000) score += 15;
  else if (totalToolCalls >= 1000) score += 12;
  else if (totalToolCalls >= 200) score += 8;
  else if (totalToolCalls >= 30) score += 4;
  else if (totalToolCalls > 0) score += 1;

  // File edits (0-10)
  maxScore += 10;
  if (totalFileEdits >= 1000) score += 10;
  else if (totalFileEdits >= 200) score += 7;
  else if (totalFileEdits >= 50) score += 4;
  else if (totalFileEdits > 0) score += 1;

  // Skills + agents + MCP (0-10)
  const ecosystem = totalSkills + totalAgentTypes + totalMcpUsed;
  maxScore += 10;
  if (ecosystem >= 15) score += 10;
  else if (ecosystem >= 8) score += 7;
  else if (ecosystem >= 3) score += 4;
  else if (ecosystem > 0) score += 1;

  // Recency (0-10) — active in last 7 days
  maxScore += 10;
  if (tokens7d >= 10_000_000) score += 10;
  else if (tokens7d >= 1_000_000) score += 7;
  else if (tokens7d >= 100_000) score += 4;
  else if (tokens7d > 0) score += 1;

  return maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
}

function computePrimaryAgentScore(evidences, sessions) {
  // Find the agent with most tokens
  let primary = null;
  let maxTokens = 0;

  if (sessions) {
    for (const [name, s] of Object.entries(sessions)) {
      if (!s) continue;
      const t = (s.tokensAll?.input || 0) + (s.tokensAll?.output || 0) + (s.tokensAll?.cache || 0);
      if (t > maxTokens) { maxTokens = t; primary = name; }
    }
  }

  if (!primary) {
    // Fall back to evidence-based
    const aiAgents = evidences.filter(e => e.category === 'ai-agent' && e.depth !== 'detect');
    for (const ev of aiAgents) {
      const m = ev.metrics || {};
      const t = m.tokensUsed?.value || 0;
      if (t > maxTokens) { maxTokens = t; primary = ev.id; }
    }
  }

  if (!primary) return { agent: null, score: 0 };

  const ses = sessions?.[primary];
  let score = 0;
  let maxScore = 0;

  const tokens = ses ? (ses.tokensAll?.input || 0) + (ses.tokensAll?.output || 0) + (ses.tokensAll?.cache || 0) : maxTokens;
  const sessions_count = ses?.sessionCount || 0;
  const days = ses?.activeDays || 0;
  const tools = ses?.tools?.size || 0;

  // Tokens (0-40)
  maxScore += 40;
  if (tokens >= 200_000_000) score += 40;
  else if (tokens >= 50_000_000) score += 32;
  else if (tokens >= 10_000_000) score += 24;
  else if (tokens >= 1_000_000) score += 16;
  else if (tokens >= 100_000) score += 8;
  else if (tokens > 0) score += 2;

  // Sessions (0-30)
  maxScore += 30;
  if (sessions_count >= 200) score += 30;
  else if (sessions_count >= 50) score += 22;
  else if (sessions_count >= 10) score += 14;
  else if (sessions_count > 0) score += 4;

  // Active days (0-15)
  maxScore += 15;
  if (days >= 30) score += 15;
  else if (days >= 15) score += 10;
  else if (days >= 5) score += 5;
  else if (days > 0) score += 1;

  // Unique tools (0-15)
  maxScore += 15;
  if (tools >= 20) score += 15;
  else if (tools >= 10) score += 10;
  else if (tools >= 5) score += 5;
  else if (tools > 0) score += 1;

  return {
    agent: primary,
    score: maxScore > 0 ? Math.round(score / maxScore * 100) : 0,
  };
}

function computeEvidenceCoverage(evidences) {
  const totalMetrics = evidences.reduce((sum, ev) => sum + Object.keys(ev.metrics || {}).length, 0);
  const evaluatedMetrics = evidences.reduce((sum, ev) => {
    return sum + Object.values(ev.metrics || {}).filter(m =>
      m.status === 'evaluated' || m.status === 'risk_found' || m.status === 'config_only' || m.status === 'detected'
    ).length;
  }, 0);

  if (totalMetrics === 0) return 0;
  return Math.round(evaluatedMetrics / totalMetrics * 100);
}

// Check if any single agent qualifies as "heavy use"
export function isHeavyUser(evidences, sessions) {
  if (sessions) {
    for (const s of Object.values(sessions)) {
      if (!s) continue;
      const tokens = (s.tokensAll?.input || 0) + (s.tokensAll?.output || 0) + (s.tokensAll?.cache || 0);
      if (tokens >= 10_000_000) return true;
      if ((s.sessionCount || 0) >= 50) return true;
      if ((s.toolCalls || 0) >= 500) return true;
      if ((s.activeDays || 0) >= 15) return true;
    }
  }
  // Check evidence metrics
  const aiAgents = evidences.filter(e => e.category === 'ai-agent');
  for (const ev of aiAgents) {
    const m = ev.metrics || {};
    if ((m.tokensUsed?.value || 0) >= 10_000_000) return true;
    if ((m.aiSessions?.value || 0) >= 50) return true;
    if ((m.toolCalls?.value || 0) >= 500) return true;
    if ((m.activeDays?.value || 0) >= 15) return true;
  }
  return false;
}
