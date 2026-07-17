import { describe, expect, it } from 'vitest'
import { ACCEPTED_PRODUCTION_FINDINGS, collectUnreviewedFindings } from './dependency-audit-policy.mjs'

describe('collectUnreviewedFindings', () => {
  it('accepts every finding currently recorded with a reviewed reason', () => {
    const vulnerabilities = Object.fromEntries(
      ACCEPTED_PRODUCTION_FINDINGS.map((entry) => [entry.name, { name: entry.name, severity: entry.severity }]),
    )
    expect(collectUnreviewedFindings(vulnerabilities)).toEqual([])
  })

  it('flags a high severity finding with no accepted entry', () => {
    const vulnerabilities = {
      'left-pad': { name: 'left-pad', severity: 'high' },
    }
    expect(collectUnreviewedFindings(vulnerabilities)).toEqual([{ name: 'left-pad', severity: 'high' }])
  })

  it('flags a finding that escalated past its reviewed severity', () => {
    const vulnerabilities = {
      nanoid: { name: 'nanoid', severity: 'critical' },
    }
    expect(collectUnreviewedFindings(vulnerabilities)).toEqual([{ name: 'nanoid', severity: 'critical' }])
  })

  it('ignores moderate and low severity findings even when unreviewed', () => {
    const vulnerabilities = {
      'some-package': { name: 'some-package', severity: 'moderate' },
      'another-package': { name: 'another-package', severity: 'low' },
    }
    expect(collectUnreviewedFindings(vulnerabilities)).toEqual([])
  })

  it('ignores an empty or missing vulnerability map', () => {
    expect(collectUnreviewedFindings({})).toEqual([])
    expect(collectUnreviewedFindings(undefined)).toEqual([])
  })
})
