import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PlayerSignature, NarrativeDecision } from './types'

describe('player-history', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    // @ts-expect-error
    delete window.BaiLuPlayerHistory
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function loadHistory() {
    vi.resetModules()
    const mod = await import('./player-history')
    return mod
  }

  describe('initialization', () => {
    it('creates empty history on first load', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toEqual([])
      expect(history.sessions).toEqual([])
    })

    it('restores history from localStorage', async () => {
      const stored = {
        events: [{ type: 'pageVisit', timestamp: 1000, data: { url: '/test' } }],
        sessions: ['sess-1'],
      }
      localStorage.setItem('bailu_player_history', JSON.stringify(stored))

      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toHaveLength(1)
      expect(history.sessions).toContain('sess-1')
    })
  })

  describe('recordEvent', () => {
    it('records a page visit event', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      window.BaiLuPlayerHistory!.recordEvent('pageVisit', { url: '/pages/volume-01' })

      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toHaveLength(1)
      expect(history.events[0]!.type).toBe('pageVisit')
      expect(history.events[0]!.data).toEqual({ url: '/pages/volume-01' })
      expect(history.events[0]!.timestamp).toBeGreaterThan(0)
    })

    it('records multiple event types', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      window.BaiLuPlayerHistory!.recordEvent('search', { keyword: '内科' })
      window.BaiLuPlayerHistory!.recordEvent('copy', {})
      window.BaiLuPlayerHistory!.recordEvent('ruleViolation', { ruleId: 'rule_1' })

      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toHaveLength(3)
      expect(history.events.map(e => e.type)).toEqual(['search', 'copy', 'ruleViolation'])
    })

    it('persists to localStorage', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      window.BaiLuPlayerHistory!.recordEvent('pageVisit', { url: '/test' })

      const stored = localStorage.getItem('bailu_player_history')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.events).toHaveLength(1)
    })
  })

  describe('recordSessionSnapshot', () => {
    it('archives a session signature', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()

      const sig: PlayerSignature = {
        sessionId: 'sess-abc',
        startTime: 1000,
        lastActiveTime: 2000,
        pagesVisited: [],
        searches: [],
        anomaliesTriggered: [],
        ruleViolations: [],
        copies: 0,
        totalScrollDepth: 0,
        pageCount: 0,
        returnVisit: false,
        version: 1,
      }

      window.BaiLuPlayerHistory!.recordSessionSnapshot(sig)
      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.sessions).toContain('sess-abc')
    })

    it('does not duplicate session ids', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()

      const sig = {
        sessionId: 'sess-abc',
        startTime: 1000,
        lastActiveTime: 2000,
        pagesVisited: [],
        searches: [],
        anomaliesTriggered: [],
        ruleViolations: [],
        copies: 0,
        totalScrollDepth: 0,
        pageCount: 0,
        returnVisit: false,
        version: 1,
      }

      window.BaiLuPlayerHistory!.recordSessionSnapshot(sig)
      window.BaiLuPlayerHistory!.recordSessionSnapshot(sig)

      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.sessions).toHaveLength(1)
    })
  })

  describe('recordDecision', () => {
    it('records a narrative decision', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'stay' },
        contentModules: [],
        memoryUpdate: {
          relationshipStage: 'noticed',
          understandingDepth: 50,
          observedPatterns: [],
          notes: 'test',
        },
      }

      window.BaiLuPlayerHistory!.recordDecision(decision)
      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toHaveLength(1)
      expect(history.events[0]!.type).toBe('decision')
    })
  })

  describe('getTimeline', () => {
    it('returns events sorted by timestamp', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()

      vi.setSystemTime(1000)
      window.BaiLuPlayerHistory!.recordEvent('pageVisit', { url: '/a' })
      vi.setSystemTime(500)
      window.BaiLuPlayerHistory!.recordEvent('search', { keyword: 'x' })
      vi.setSystemTime(1500)
      window.BaiLuPlayerHistory!.recordEvent('copy', {})

      const timeline = window.BaiLuPlayerHistory!.getTimeline()
      expect(timeline.map(e => e.type)).toEqual(['search', 'pageVisit', 'copy'])
    })
  })

  describe('getRecentEvents', () => {
    it('returns last N events', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()

      for (let i = 0; i < 5; i++) {
        window.BaiLuPlayerHistory!.recordEvent('pageVisit', { url: `/${i}` })
      }

      const recent = window.BaiLuPlayerHistory!.getRecentEvents(3)
      expect(recent).toHaveLength(3)
      expect(recent.map(e => e.data.url)).toEqual(['/2', '/3', '/4'])
    })
  })

  describe('clearHistory', () => {
    it('removes all history', async () => {
      const { initPlayerHistory } = await loadHistory()
      initPlayerHistory()
      window.BaiLuPlayerHistory!.recordEvent('pageVisit', { url: '/test' })

      window.BaiLuPlayerHistory!.clearHistory()
      const history = window.BaiLuPlayerHistory!.getHistory()
      expect(history.events).toEqual([])
      expect(history.sessions).toEqual([])
      expect(localStorage.getItem('bailu_player_history')).toBeNull()
    })
  })
})
