// Markdown renderer
export function renderMarkdown(report) {
  const { auraScore, confidence, dimensions, developerType, badges, recommendations, evidences } = report;
  const lines = [];

  lines.push('# DevAura Report\n');
  lines.push(`**Developer Type:** ${developerType.type}  `);
  lines.push(`**Aura Score:** ${auraScore}/100  `);
  lines.push(`**Confidence:** ${confidence}  `);
  lines.push(`**Rank:** ${developerType.rank}\n`);

  lines.push('## Capability Scores\n');
  for (const [id, label, icon] of [
    ['envHealth', 'Environment Health', '🏗'], ['aiWorkflow', 'AI Workflow Maturity', '🤖'],
    ['toolchainDepth', 'Toolchain Depth', '🔧'], ['verification', 'Engineering Verification', '✅'],
    ['automation', 'Automation Depth', '⚡'], ['security', 'Security Hygiene', '🔒'],
  ]) {
    const ds = dimensions[id];
    if (!ds || ds.status !== 'scored') continue;
    const bar = '█'.repeat(Math.round(ds.score / 10)) + '░'.repeat(10 - Math.round(ds.score / 10));
    lines.push(`- ${icon} ${label}: **${ds.score}/100** \`${bar}\` (${ds.confidence})`);
  }
  lines.push('');

  lines.push('## Detected Stack\n');
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const runtimes = evidences.filter(e => e.category === 'runtime' && Object.values(e.metrics).some(m => m.status !== 'not_detected' && m.value));
  if (aiAgents.length) lines.push(`- **AI Agents:** ${aiAgents.map(e => e.source).join(', ')}`);
  if (runtimes.length) lines.push(`- **Runtimes:** ${runtimes.map(e => e.source).join(', ')}`);
  lines.push('');

  if (badges.length) {
    lines.push('## Badges\n');
    lines.push(badges.map(b => `- ${b.icon} ${b.label}`).join('\n'));
    lines.push('');
  }

  if (recommendations.length) {
    lines.push('## Recommendations\n');
    lines.push(recommendations.slice(0, 5).map(r => `${r.priority}. ${r.text}`).join('\n'));
    lines.push('');
  }

  lines.push('---\n');
  lines.push('*DevAura Report · Designed for sharing after review · Nothing uploaded*');

  return lines.join('\n');
}
