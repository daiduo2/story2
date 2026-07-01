// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { adaptDecision } from './server.js'
import type { NarrativeDecision } from './store.js'

describe('server adaptDecision', () => {
  function validDecision(): NarrativeDecision {
    return {
      version: 'narrative-v2',
      routeDecision: { action: 'stay' },
      systemMessage: undefined,
      contentModules: [],
      memoryUpdate: {
        relationshipStage: 'unknown',
        understandingDepth: 0,
        observedPatterns: [],
        notes: '',
      },
    }
  }

  it('maps stay action', () => {
    const result = adaptDecision({ ...validDecision(), routeDecision: { action: 'stay' } })
    expect(result.routeDecision.action).toBe('stay')
  })

  it('maps redirect action', () => {
    const result = adaptDecision({
      ...validDecision(),
      routeDecision: { action: 'redirect', targetPage: 'volume-04' },
    })
    expect(result.routeDecision.action).toBe('redirect')
    expect(result.routeDecision.targetPage).toBe('volume-04')
  })

  it('maps suggest action to inject', () => {
    const result = adaptDecision({
      ...validDecision(),
      routeDecision: { action: 'suggest', targetPage: 'volume-04' },
    })
    expect(result.routeDecision.action).toBe('inject')
  })

  it('rejects invalid action', () => {
    expect(() =>
      adaptDecision({
        ...validDecision(),
        routeDecision: { action: 'fly' as any, targetPage: 'volume-04' },
      })
    ).toThrow('Invalid route action')
  })

  it('maps observational style', () => {
    const result = adaptDecision({
      ...validDecision(),
      systemMessage: { text: '你好', style: 'observational' },
    })
    expect(result.systemMessage?.style).toBe('observational')
  })

  it('maps intimate style to observational', () => {
    const result = adaptDecision({
      ...validDecision(),
      systemMessage: { text: '你好', style: 'intimate' },
    })
    expect(result.systemMessage?.style).toBe('observational')
  })

  it('maps confrontational style', () => {
    const result = adaptDecision({
      ...validDecision(),
      systemMessage: { text: '你好', style: 'confrontational' },
    })
    expect(result.systemMessage?.style).toBe('confrontational')
  })

  it('maps invitational style to whisper', () => {
    const result = adaptDecision({
      ...validDecision(),
      systemMessage: { text: '你好', style: 'invitational' },
    })
    expect(result.systemMessage?.style).toBe('whisper')
  })

  it('rejects invalid style', () => {
    expect(() =>
      adaptDecision({
        ...validDecision(),
        systemMessage: { text: '你好', style: 'angry' as any },
      })
    ).toThrow('Invalid message style')
  })

  it('maps before position', () => {
    const result = adaptDecision({
      ...validDecision(),
      contentModules: [{ moduleId: 'x', targetSelector: '#y', position: 'before' }],
    })
    expect(result.contentModules[0].position).toBe('before')
  })

  it('maps after position', () => {
    const result = adaptDecision({
      ...validDecision(),
      contentModules: [{ moduleId: 'x', targetSelector: '#y', position: 'after' }],
    })
    expect(result.contentModules[0].position).toBe('after')
  })

  it('maps replace position to after', () => {
    const result = adaptDecision({
      ...validDecision(),
      contentModules: [{ moduleId: 'x', targetSelector: '#y', position: 'replace' as any }],
    })
    expect(result.contentModules[0].position).toBe('after')
  })

  it('rejects invalid position', () => {
    expect(() =>
      adaptDecision({
        ...validDecision(),
        contentModules: [{ moduleId: 'x', targetSelector: '#y', position: 'inside' as any }],
      })
    ).toThrow('Invalid module position')
  })
})
