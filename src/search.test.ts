import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('search', () => {
  beforeEach(() => {
    vi.resetModules()
    // @ts-expect-error
    delete window.BaiLuSearch
    // @ts-expect-error
    delete window.__bailu_search_overrides
  })

  async function loadSearch() {
    const mod = await import('./search')
    return mod
  }

  function mockBehavior(pagesVisited: string[] = []) {
    window.BaiLuBehavior = {
      getSignature: () => ({
        sessionId: 'test',
        startTime: 0,
        lastActiveTime: 0,
        pagesVisited: pagesVisited.map(url => ({
          url,
          title: '',
          firstVisit: 0,
          lastVisit: 0,
          visitCount: 1,
          dwellTime: 0,
          maxScrollDepth: 0,
        })),
        searches: [],
        anomaliesTriggered: [],
        ruleViolations: [],
        copies: 0,
        totalScrollDepth: 0,
        pageCount: pagesVisited.length,
        returnVisit: false,
        version: 1,
      }),
      getSummary: () => ({ totalVisits: 0, uniquePages: 0, totalSearches: 0, hiddenSearches: 0, violations: 0, phase: '' }),
      recordSearch: vi.fn(),
      recordAnomaly: vi.fn(),
      recordRuleViolation: vi.fn(),
      recordCopy: vi.fn(),
      getPhase: () => 'newcomer',
      reset: vi.fn(),
    }
  }

  describe('getIndex', () => {
    it('returns the full search index', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      const index = window.BaiLuSearch!.getIndex()
      expect(index['入院']).toEqual({ page: 'volume-01', tier: 'public' })
      expect(index['4楼']).toBeDefined()
      expect(index['4楼']!.tier).toBe('hidden')
    })
  })

  describe('resolveSearch', () => {
    it('routes public keywords directly', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior()

      expect(window.BaiLuSearch!.resolveSearch('入院')).toBe('volume-01')
      expect(window.BaiLuSearch!.resolveSearch('内科')).toBe('volume-02')
      expect(window.BaiLuSearch!.resolveSearch('精神科')).toBe('volume-04')
    })

    it('returns null for unknown keywords', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior()

      expect(window.BaiLuSearch!.resolveSearch('不存在的关键词')).toBeNull()
    })

    it('returns null for hidden keyword when no candidates visited', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior([])

      expect(window.BaiLuSearch!.resolveSearch('4楼')).toBeNull()
    })

    it('routes hidden keyword to first candidate when visited', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior(['/pages/volume-04'])

      expect(window.BaiLuSearch!.resolveSearch('4楼')).toBe('volume-04')
    })

    it('uses search override when present', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior([])
      // @ts-expect-error
      window.__bailu_search_overrides = { '4楼': 'volume-08' }

      expect(window.BaiLuSearch!.resolveSearch('4楼')).toBe('volume-08')
    })

    it('matches hidden keyword with any candidate visited', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior(['/pages/supplement-lin'])

      expect(window.BaiLuSearch!.resolveSearch('4楼')).toBe('volume-04')
    })
  })

  describe('handleSearch', () => {
    it('records search via behavior and resolves keyword', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior()

      window.BaiLuSearch!.handleSearch('入院')
      expect(window.BaiLuBehavior!.recordSearch).toHaveBeenCalledWith('入院')
    })

    it('returns null result for unmatched keyword', async () => {
      const { initSearch } = await loadSearch()
      initSearch()
      mockBehavior()

      const result = window.BaiLuSearch!.handleSearch('不存在')
      expect(result).toBeNull()
    })
  })
})
