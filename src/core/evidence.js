// Evidence model — scanners collect evidence, scoring engine evaluates it

export const STATUS = {
  NOT_DETECTED: 'not_detected',
  NOT_SUPPORTED: 'not_supported',
  NOT_APPLICABLE: 'not_applicable',
  MISSING_EVIDENCE: 'missing_evidence',
  DETECTED: 'detected',
  CONFIG_ONLY: 'config_only',
  EVALUATED: 'evaluated',
  RISK_FOUND: 'risk_found',
};

export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
};

export function makeMetric(id, label, opts = {}) {
  return {
    id,
    label,
    value: opts.value ?? null,
    status: opts.status ?? STATUS.NOT_DETECTED,
    confidence: opts.confidence ?? CONFIDENCE.UNKNOWN,
    unit: opts.unit ?? '',
    evidence: opts.evidence ?? [],
    applies: opts.applies !== false,
    supported: opts.supported !== false,
  };
}

export function makeEvidence(id, source, category, depth, metrics = {}) {
  return {
    id,
    source,
    category,   // 'ai-agent' | 'runtime' | 'infra' | 'ide' | 'shell' | 'security'
    depth,      // 'deep' | 'config' | 'detect'
    confidence: depthToConfidence(depth),
    metrics,
  };
}

function depthToConfidence(depth) {
  if (depth === 'deep') return CONFIDENCE.HIGH;
  if (depth === 'config') return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

export function isEvaluated(m) {
  return m.status === STATUS.EVALUATED || m.status === STATUS.RISK_FOUND;
}

export function shouldDisplay(m) {
  return m.status !== STATUS.NOT_DETECTED &&
         m.status !== STATUS.NOT_APPLICABLE &&
         m.applies !== false;
}
