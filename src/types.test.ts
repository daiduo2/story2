import { describe, it, expect } from 'vitest'
import {
  isPlayerSignature,
  isPageVisit,
  isSearchRecord,
  isRuleViolation,
  isNarrativeDecision,
  isRouteDecision,
  isSystemMessage,
  isContentModuleRef,
  isMemoryUpdate,
  isGameEvent,
} from './types'

describe('types - type guards', () => {
  describe('isPageVisit', () => {
    it('returns true for valid PageVisit', () => {
      const visit = {
        url: 'https://example.com/volume-01',
        title: '卷一',
        firstVisit: 1717584000000,
        lastVisit: 1717584100000,
        visitCount: 1,
        dwellTime: 100,
        maxScrollDepth: 0.5,
      }
      expect(isPageVisit(visit)).toBe(true)
    })

    it('returns false for missing required fields', () => {
      expect(isPageVisit({ url: 'x' })).toBe(false)
      expect(isPageVisit(null)).toBe(false)
      expect(isPageVisit('string')).toBe(false)
    })

    it('returns false for wrong field types', () => {
      expect(isPageVisit({ ...validPageVisit(), url: 123 })).toBe(false)
      expect(isPageVisit({ ...validPageVisit(), visitCount: '1' })).toBe(false)
    })
  })

  describe('isSearchRecord', () => {
    it('returns true for valid SearchRecord', () => {
      expect(isSearchRecord({ query: '内科', timestamp: 1717584000000, pageUrl: '/pages/volume-02' })).toBe(true)
    })

    it('returns false for invalid SearchRecord', () => {
      expect(isSearchRecord({ query: '内科' })).toBe(false)
      expect(isSearchRecord(null)).toBe(false)
    })
  })

  describe('isRuleViolation', () => {
    it('returns true for valid RuleViolation', () => {
      expect(isRuleViolation({ ruleId: 'rule_1', detail: '访问了卷零', timestamp: 1717584000000, pageUrl: '/pages/volume-00' })).toBe(true)
    })

    it('returns false for invalid RuleViolation', () => {
      expect(isRuleViolation({ ruleId: 'rule_1' })).toBe(false)
      expect(isRuleViolation(null)).toBe(false)
    })
  })

  describe('isPlayerSignature', () => {
    it('returns true for valid PlayerSignature', () => {
      const sig = validPlayerSignature()
      expect(isPlayerSignature(sig)).toBe(true)
    })

    it('returns false for missing required fields', () => {
      expect(isPlayerSignature({})).toBe(false)
      expect(isPlayerSignature(null)).toBe(false)
    })

    it('returns false for invalid nested arrays', () => {
      const sig = { ...validPlayerSignature(), pagesVisited: ['not a PageVisit'] }
      expect(isPlayerSignature(sig)).toBe(false)
    })
  })

  describe('isRouteDecision', () => {
    it('returns true for "stay" action', () => {
      expect(isRouteDecision({ action: 'stay' })).toBe(true)
    })

    it('returns true for "redirect" action with target', () => {
      expect(isRouteDecision({ action: 'redirect', targetPage: 'volume-04' })).toBe(true)
    })

    it('returns true for "inject" action', () => {
      expect(isRouteDecision({ action: 'inject', targetPage: 'volume-04-awakened' })).toBe(true)
    })

    it('returns false for invalid action', () => {
      expect(isRouteDecision({ action: 'invalid' })).toBe(false)
      expect(isRouteDecision({ action: 'redirect' })).toBe(false) // missing targetPage
    })
  })

  describe('isSystemMessage', () => {
    it('returns true for valid SystemMessage', () => {
      expect(isSystemMessage({ text: '系统记录了。', style: 'observational' })).toBe(true)
    })

    it('returns false for invalid style', () => {
      expect(isSystemMessage({ text: 'hi', style: 'unknown' })).toBe(false)
    })
  })

  describe('isContentModuleRef', () => {
    it('returns true for valid ContentModuleRef', () => {
      expect(isContentModuleRef({ moduleId: 'test', targetSelector: 'main', position: 'after' })).toBe(true)
    })

    it('returns false for invalid position', () => {
      expect(isContentModuleRef({ moduleId: 'test', targetSelector: 'main', position: 'middle' })).toBe(false)
    })
  })

  describe('isMemoryUpdate', () => {
    it('returns true for valid MemoryUpdate', () => {
      expect(isMemoryUpdate({ relationshipStage: 'noticed', understandingDepth: 50, observedPatterns: [], notes: '' })).toBe(true)
    })
  })

  describe('isNarrativeDecision', () => {
    it('returns true for valid NarrativeDecision', () => {
      const decision = validNarrativeDecision()
      expect(isNarrativeDecision(decision)).toBe(true)
    })

    it('returns false for invalid version', () => {
      const decision = { ...validNarrativeDecision(), version: 'wrong' }
      expect(isNarrativeDecision(decision)).toBe(false)
    })
  })

  describe('isGameEvent', () => {
    it('returns true for valid GameEvent', () => {
      expect(isGameEvent({ type: 'pageVisit', pageId: 'volume-01' })).toBe(true)
      expect(isGameEvent({ type: 'search', keyword: '内科' })).toBe(true)
    })

    it('returns false for invalid type', () => {
      expect(isGameEvent({ type: 'unknown' })).toBe(false)
    })
  })
})

// helpers
function validPageVisit() {
  return {
    url: 'https://example.com/volume-01',
    title: '卷一',
    firstVisit: 1717584000000,
    lastVisit: 1717584100000,
    visitCount: 1,
    dwellTime: 100,
    maxScrollDepth: 0.5,
  }
}

function validPlayerSignature() {
  return {
    sessionId: 'test-session',
    startTime: 1717584000000,
    lastActiveTime: 1717584100000,
    pagesVisited: [validPageVisit()],
    searches: [{ query: '内科', timestamp: 1717584000000, pageUrl: '/pages/volume-02' }],
    anomaliesTriggered: [],
    ruleViolations: [],
    copies: 0,
    totalScrollDepth: 0.5,
    pageCount: 1,
    returnVisit: false,
    version: 1,
  }
}

function validNarrativeDecision() {
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
