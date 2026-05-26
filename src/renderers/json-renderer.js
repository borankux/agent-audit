// JSON renderer
export function renderJson(report) {
  const { auraScore, confidence, dimensions, developerType, badges, recommendations, evidences } = report;

  const output = {
    version: '0.1.0',
    product: 'DevAura',
    auraScore,
    confidence,
    developerType: developerType.type,
    rank: developerType.rank,
    dimensions: {},
    badges: badges.map(b => ({ id: b.id, label: b.label })),
    recommendations: recommendations.map(r => ({ priority: r.priority, text: r.text, dimension: r.dimension })),
    detectedStack: buildStack(evidences),
    evidenceCoverage: buildCoverage(evidences),
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
