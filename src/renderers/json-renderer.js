// JSON renderer
export function renderJson(report) {
  const { auraScore, confidence, dimensions, developerType, powerScores, badges, recommendations, evidences, sessions } = report;

  const output = {
    version: '0.2.0',
    product: 'DevAura',
    auraScore,
    confidence,
    aiPowerScore: powerScores?.aiPowerScore,
    primaryAgentPowerScore: powerScores?.primaryAgentPowerScore,
    evidenceCoverageScore: powerScores?.evidenceCoverageScore,
    developerType: developerType.type,
    primaryAgent: developerType.primaryAgent,
    rank: developerType.rank,
    dimensions: {},
    badges: badges.map(b => ({ id: b.id, label: b.label, rarity: b.rarity?.label })),
    recommendations: recommendations.map(r => ({ priority: r.priority, text: r.text, dimension: r.dimension })),
    detectedStack: buildStack(evidences),
    evidenceCoverage: buildCoverage(evidences),
    sessions: buildSessionSummary(sessions),
  };

  for (const [id, ds] of Object.entries(dimensions)) {
    if (ds.status === 'scored') {
      output.dimensions[id] = {
        score: ds.score,
        confidence: ds.confidence,
        evidenceCount: ds.evidenceCount,
      };
    }
  }

  return JSON.stringify(output, null, 2);
}

function buildStack(evidences) {
  const stack = {};
  for (const ev of evidences) {
    const detected = Object.values(ev.metrics).some(m => m.status !== 'not_detected' && m.value);
    if (!detected) continue;
    const cat = ev.category;
    if (!stack[cat]) stack[cat] = [];
    stack[cat].push({
      source: ev.source,
      depth: ev.depth,
      details: Object.entries(ev.metrics)
        .filter(([, m]) => m.status !== 'not_detected' && m.evidence?.length)
        .flatMap(([, m]) => m.evidence),
    });
  }
  return stack;
}

function buildCoverage(evidences) {
  return evidences.map(ev => ({
    source: ev.source,
    category: ev.category,
    depth: ev.depth,
    confidence: ev.confidence,
    metricCount: Object.values(ev.metrics).filter(m => m.status !== 'not_detected').length,
  }));
}

function buildSessionSummary(sessions) {
  if (!sessions) return undefined;
  const result = {};
  for (const [name, s] of Object.entries(sessions)) {
    if (!s) continue;
    result[name] = {
      sessionCount: s.sessionCount,
      activeDays: s.activeDays,
      first: s.first,
      last: s.last,
      toolCalls: s.toolCalls,
      fileEdits: s.fileEdits,
      commandRuns: s.commandRuns,
      tokensAll: {
        input: s.tokensAll?.input || 0,
        output: s.tokensAll?.output || 0,
        cacheRead: s.tokensAll?.cacheRead || s.tokensAll?.cache || 0,
        cacheCreation: s.tokensAll?.cacheCreation || 0,
        totalBilled: s.tokensAll?.totalBilled || 0,
        totalContext: s.tokensAll?.totalContext || 0,
      },
      scannedLines: s.scannedLines,
      skippedLines: s.skippedLines,
    };
  }
  return result;
}
