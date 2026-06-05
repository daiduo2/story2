import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('main', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    // @ts-expect-error
    delete window.BaiLuBehavior
    // @ts-expect-error
    delete window.BaiLuSearch
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function loadMain() {
    const mod = await import('./main')
    return mod
  }

  function mockBehavior(overrides: Record<string, unknown> = {}) {
    const sig = {
      sessionId: 'test',
      startTime: 0,
      lastActiveTime: 0,
      pagesVisited: [] as Array<{ url: string; title: string; firstVisit: number; lastVisit: number; visitCount: number; dwellTime: number; maxScrollDepth: number }>,
      searches: [] as Array<{ query: string; timestamp: number; pageUrl: string }>,
      anomaliesTriggered: [] as string[],
      ruleViolations: [] as Array<{ ruleId: string; detail: string; timestamp: number; pageUrl: string }>,
      copies: 0,
      totalScrollDepth: 0,
      pageCount: 0,
      returnVisit: false,
      version: 1,
      ...overrides,
    }

    window.BaiLuBehavior = {
      getSignature: () => sig,
      getSummary: () => ({ totalVisits: 0, uniquePages: 0, totalSearches: 0, hiddenSearches: 0, violations: 0, phase: '' }),
      recordSearch: vi.fn(),
      recordAnomaly: vi.fn((id: string) => { sig.anomaliesTriggered.push(id) }),
      recordRuleViolation: vi.fn((ruleId: string, detail: string) => {
        sig.ruleViolations.push({ ruleId, detail, timestamp: Date.now(), pageUrl: '' })
      }),
      recordCopy: vi.fn(),
      getPhase: () => 'newcomer',
      reset: vi.fn(),
    }
  }

  describe('console easter egg', () => {
    it('outputs console messages on init', async () => {
      const { initMain } = await loadMain()
      mockBehavior()
      initMain()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('白鹿疗养院'),
        expect.any(String)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('如果你能看到这行字'),
        expect.any(String)
      )
    })
  })

  describe('rule 1: volume-00 visit', () => {
    it('records violation when on volume-00 page', async () => {
      const { initMain } = await loadMain()
      mockBehavior()
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: 'http://localhost/pages/volume-00.html', pathname: '/pages/volume-00.html' },
      })

      initMain()
      expect(window.BaiLuBehavior!.recordRuleViolation).toHaveBeenCalledWith(
        'rule_1',
        expect.stringContaining('卷零')
      )
    })

    it('does not record violation on other pages', async () => {
      const { initMain } = await loadMain()
      mockBehavior()
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: 'http://localhost/pages/volume-01.html', pathname: '/pages/volume-01.html' },
      })

      initMain()
      expect(window.BaiLuBehavior!.recordRuleViolation).not.toHaveBeenCalledWith('rule_1', expect.anything())
    })
  })

  describe('anom-search-inject', () => {
    it('injects hidden keyword when visit count >= 3 and random allows', async () => {
      const { initMain } = await loadMain()
      mockBehavior({
        pagesVisited: [
          { url: '/a', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
          { url: '/b', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
          { url: '/c', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
        ],
      })

      const searchInput = document.createElement('input')
      searchInput.id = 'search-input'
      document.body.appendChild(searchInput)

      vi.spyOn(Math, 'random').mockReturnValue(0.1)
      initMain()

      const placeholder = searchInput.getAttribute('placeholder')
      expect(placeholder).toBeTruthy()
      expect(['4楼', '第七本', '2:47', '不对劲', '多出来']).toContain(placeholder)
      expect(window.BaiLuBehavior!.recordAnomaly).toHaveBeenCalledWith('anom-search-inject')
    })

    it('does not inject when random is too high', async () => {
      const { initMain } = await loadMain()
      mockBehavior({
        pagesVisited: [
          { url: '/a', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
          { url: '/b', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
          { url: '/c', title: '', firstVisit: 0, lastVisit: 0, visitCount: 1, dwellTime: 0, maxScrollDepth: 0 },
        ],
      })

      const searchInput = document.createElement('input')
      searchInput.id = 'search-input'
      document.body.appendChild(searchInput)

      vi.spyOn(Math, 'random').mockReturnValue(0.9)
      initMain()

      expect(searchInput.getAttribute('placeholder')).toBeNull()
    })
  })

  describe('anom-content-shift', () => {
    it('registers copy listener', async () => {
      const { initMain } = await loadMain()
      mockBehavior({ copies: 3 })
      initMain()

      document.dispatchEvent(new Event('copy'))
      // The copy handler in main.ts delegates to BaiLuBehavior.recordCopy
      expect(window.BaiLuBehavior!.recordCopy).toHaveBeenCalled()
    })
  })

  describe('anom-timeout', () => {
    it('sets up timeout check interval', async () => {
      const { initMain } = await loadMain()
      mockBehavior()
      vi.useFakeTimers()
      initMain()

      // Should not throw when interval fires
      vi.advanceTimersByTime(60000)
      vi.useRealTimers()
    })
  })

  describe('search form rule 3', () => {
    it('records violation when searching injected keyword', async () => {
      const { initMain } = await loadMain()
      mockBehavior()

      const searchInput = document.createElement('input')
      searchInput.id = 'search-input'
      const searchForm = document.createElement('form')
      searchForm.id = 'search-form'
      searchForm.appendChild(searchInput)
      document.body.appendChild(searchForm)

      initMain()

      // Simulate injected keyword
      searchInput.dataset.injected = '4楼'
      searchInput.value = '4楼'
      searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

      expect(window.BaiLuBehavior!.recordRuleViolation).toHaveBeenCalledWith(
        'rule_3',
        expect.stringContaining('4楼')
      )
    })
  })
})
