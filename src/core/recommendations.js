// Recommendation engine

export function generateRecommendations(dimScores, evidences) {
  const recs = [];
  const ai = dimScores.aiWorkflow?.score || 0;
  const ver = dimScores.verification?.score || 0;
  const auto = dimScores.automation?.score || 0;
  const sec = dimScores.security?.score || 0;
  const tc = dimScores.toolchainDepth?.score || 0;

  if (ver < 40) recs.push({
    priority: 1,
    text: 'Add test/build verification to your AI workflow.',
    detail: 'Running tests after code changes shows engineering discipline.',
    dimension: 'verification',
  });

  if (sec < 50) recs.push({
    priority: 2,
    text: 'Review security hygiene in your agent configurations.',
    detail: 'Check for broad auto-approve permissions and API key exposure.',
    dimension: 'security',
  });

  if (tc < 40) recs.push({
    priority: 3,
    text: 'Expand your toolchain with MCP servers or custom skills.',
    detail: 'Custom tools and skills significantly improve AI agent effectiveness.',
    dimension: 'toolchain',
  });

  if (auto < 40) recs.push({
    priority: 4,
    text: 'Add automation hooks or CI pipelines.',
    detail: 'Automated checks catch issues before they reach production.',
    dimension: 'automation',
  });

  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && e.depth !== 'detect');
  if (aiAgents.length < 2 && ai >= 30) recs.push({
    priority: 5,
    text: 'Try multiple AI coding agents for different tasks.',
    detail: 'Each agent has unique strengths — multi-agent workflows are more powerful.',
    dimension: 'aiWorkflow',
  });

  const mcpCount = evidences.reduce((s, e) => s + (e.metrics?.mcpServers?.value || 0), 0);
  if (mcpCount === 0) recs.push({
    priority: 6,
    text: 'Add MCP servers to connect your agents with external tools.',
    detail: 'MCP servers give AI agents access to databases, APIs, and services.',
    dimension: 'toolchain',
  });

  return recs.sort((a, b) => a.priority - b.priority);
}
