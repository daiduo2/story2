import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PlayerSignature, PageVisit } from './types'

// We test through the module's exported init + exposed global
describe('behavior', () => {
  beforeEach(() => {
    // Clean module state between tests by re-importing
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    // Reset URL
    window.history.replaceState(null, '', '/')
    // Clear any existing global
    // @ts-expect-error
    delete window.BaiLuBehavior
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function loadBehavior() {
    vi.resetModules()
    const mod = await import('./behavior')
    return mod
  }

  describe('initialization', () => {
    it('creates a fresh signature on first load', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.sessionId).toBeTruthy()
      expect(sig.pagesVisited).toEqual([])
      expect(sig.searches).toEqual([])
      expect(sig.anomaliesTriggered).toEqual([])
      expect(sig.ruleViolations).toEqual([])
      expect(sig.copies).toBe(0)
      expect(sig.totalScrollDepth).toBe(0)
      expect(sig.pageCount).toBe(0)
      expect(sig.returnVisit).toBe(false)
      expect(sig.version).toBe(1)
    })

    it('restores signature from localStorage if present', async () => {
      const existing: PlayerSignature = {
        sessionId: 'sess-123',
        startTime: 1000,
        lastActiveTime: 2000,
        pagesVisited: [],
        searches: [],
        anomaliesTriggered: [],
        ruleViolations: [],
        copies: 3,
        totalScrollDepth: 1.2,
        pageCount: 2,
        returnVisit: true,
        version: 1,
      }
      localStorage.setItem('bailu_sig_sess-123', JSON.stringify(existing))
      window.history.replaceState(null, '', '/?sid=sess-123')

      const { initBehavior } = await loadBehavior()
      initBehavior()
      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.sessionId).toBe('sess-123')
      expect(sig.copies).toBe(3)
      expect(sig.returnVisit).toBe(true)
    })

    it('resets signature from localStorage if corrupted', async () => {
      localStorage.setItem('bailu_sig_sess-123', 'not-json')
      window.history.replaceState(null, '', '/?sid=sess-123')

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { initBehavior } = await loadBehavior()
      initBehavior()
      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.sessionId).toBe('sess-123')
      expect(sig.pagesVisited).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load signature'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('recordPageVisit', () => {
    it('records a new page visit', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一 · 入院记录')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.pagesVisited).toHaveLength(1)
      expect(sig.pagesVisited[0]!.url).toBe('/pages/volume-01')
      expect(sig.pagesVisited[0]!.title).toBe('卷一 · 入院记录')
      expect(sig.pagesVisited[0]!.visitCount).toBe(1)
      expect(sig.pageCount).toBe(1)
    })

    it('increments visitCount on repeat visit', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      vi.advanceTimersByTime(1000)
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.pagesVisited).toHaveLength(1)
      expect(sig.pagesVisited[0]!.visitCount).toBe(2)
    })

    it('tracks dwell time', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      vi.advanceTimersByTime(15000)

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.pagesVisited[0]!.dwellTime).toBeGreaterThanOrEqual(10)
    })

    it('tracks multiple distinct pages', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-02', '卷二')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.pagesVisited).toHaveLength(2)
      expect(sig.pageCount).toBe(2)
    })

    it('persists to localStorage', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')

      const sid = window.BaiLuBehavior!.getSignature().sessionId
      const stored = localStorage.getItem(`bailu_sig_${sid}`)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.pagesVisited[0].url).toBe('/pages/volume-01')
    })
  })

  describe('recordSearch', () => {
    it('records a search query', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordSearch('内科')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.searches).toHaveLength(1)
      expect(sig.searches[0]!.query).toBe('内科')
      expect(sig.searches[0]!.pageUrl).toBe(window.location.href)
    })
  })

  describe('recordCopy', () => {
    it('increments copy count', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordCopy()
      window.BaiLuBehavior!.recordCopy()

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.copies).toBe(2)
    })
  })

  describe('recordAnomaly', () => {
    it('records anomaly trigger', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordAnomaly('anom-search-inject')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.anomaliesTriggered).toContain('anom-search-inject')
    })

    it('does not duplicate anomaly records', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordAnomaly('anom-search-inject')
      window.BaiLuBehavior!.recordAnomaly('anom-search-inject')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.anomaliesTriggered).toHaveLength(1)
    })
  })

  describe('recordRuleViolation', () => {
    it('records a rule violation', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordRuleViolation('rule_1', '访问了卷零页面')

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.ruleViolations).toHaveLength(1)
      expect(sig.ruleViolations[0]!.ruleId).toBe('rule_1')
      expect(sig.ruleViolations[0]!.detail).toBe('访问了卷零页面')
    })
  })

  describe('getSummary', () => {
    it('returns correct summary', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-02', '卷二')
      window.BaiLuBehavior!.recordSearch('内科')
      window.BaiLuBehavior!.recordSearch('4楼')
      window.BaiLuBehavior!.recordCopy()
      window.BaiLuBehavior!.recordRuleViolation('rule_1', 'test')

      const summary = window.BaiLuBehavior!.getSummary()
      expect(summary.totalVisits).toBe(2)
      expect(summary.uniquePages).toBe(2)
      expect(summary.totalSearches).toBe(2)
      expect(summary.hiddenSearches).toBe(1)
      expect(summary.violations).toBe(1)
    })
  })

  describe('getPhase', () => {
    it('returns "newcomer" for empty signature', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      expect(window.BaiLuBehavior!.getPhase()).toBe('newcomer')
    })

    it('returns "explorer" after some page visits', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-02', '卷二')
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-03', '卷三')
      expect(window.BaiLuBehavior!.getPhase()).toBe('explorer')
    })

    it('returns "curious" after hidden searches', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordSearch('4楼')
      expect(window.BaiLuBehavior!.getPhase()).toBe('curious')
    })

    it('returns "noticed" after rule violations', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordRuleViolation('rule_1', 'test')
      expect(window.BaiLuBehavior!.getPhase()).toBe('noticed')
    })

    it('returns "awakened" after many violations', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      for (let i = 0; i < 5; i++) {
        window.BaiLuBehavior!.recordRuleViolation(`rule_${i}`, 'test')
      }
      expect(window.BaiLuBehavior!.getPhase()).toBe('awakened')
    })
  })

  describe('reset', () => {
    it('clears all data and starts fresh', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')
      window.BaiLuBehavior!.recordSearch('内科')
      window.BaiLuBehavior!.recordCopy()

      const sid = window.BaiLuBehavior!.getSignature().sessionId
      window.BaiLuBehavior!.reset()
      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.pagesVisited).toEqual([])
      expect(sig.searches).toEqual([])
      expect(sig.copies).toBe(0)
      expect(localStorage.getItem(`bailu_sig_${sid}`)).toBeNull()
    })
  })

  describe('scroll tracking', () => {
    it('updates scroll depth on scroll event', async () => {
      const { initBehavior } = await loadBehavior()
      initBehavior()
      window.BaiLuBehavior!.recordPageVisit('/pages/volume-01', '卷一')

      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 500, configurable: true })
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true })

      window.dispatchEvent(new Event('scroll'))

      const sig = window.BaiLuBehavior!.getSignature()
      expect(sig.totalScrollDepth).toBeGreaterThan(0)
      expect(sig.pagesVisited[0]!.maxScrollDepth).toBeGreaterThan(0)
    })
  })
})
