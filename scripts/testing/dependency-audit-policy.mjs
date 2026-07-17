const EXCALIDRAW_MERMAID_REASON = 'Reachable only through @excalidraw/excalidraw -> @excalidraw/mermaid-to-excalidraw, which loads solely on the optional ?engine=excalidraw route (see e2e/review-board/canvas-engine-route-isolation.spec.ts). The default React Flow route never imports this chain, and the review canvas never invokes Excalidraw\'s mermaid-import feature. Revisit when Excalidraw ships a release without the vulnerable chain.'

export const ACCEPTED_PRODUCTION_FINDINGS = [
  { name: '@excalidraw/excalidraw', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: '@excalidraw/mermaid-to-excalidraw', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: '@mermaid-js/parser', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: 'langium', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: 'chevrotain', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: '@chevrotain/cst-dts-gen', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: '@chevrotain/gast', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  { name: 'nanoid', severity: 'moderate', reason: EXCALIDRAW_MERMAID_REASON },
  {
    name: 'lodash-es',
    severity: 'high',
    reason: `${EXCALIDRAW_MERMAID_REASON} The code-injection surface is lodash's _.template, invoked internally by the mermaid parser toolchain, not by any code this project calls.`,
  },
]

const BLOCKING_SEVERITIES = new Set(['high', 'critical'])

export function collectUnreviewedFindings(auditVulnerabilities, acceptedFindings = ACCEPTED_PRODUCTION_FINDINGS) {
  const accepted = new Map(acceptedFindings.map((entry) => [entry.name, entry]))
  return Object.values(auditVulnerabilities ?? {})
    .filter((finding) => BLOCKING_SEVERITIES.has(finding.severity))
    .filter((finding) => accepted.get(finding.name)?.severity !== finding.severity)
    .map((finding) => ({ name: finding.name, severity: finding.severity }))
}
