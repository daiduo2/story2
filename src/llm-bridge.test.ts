import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { GameEvent, NarrativeDecision } from './types'

describe('llm-bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    // @ts-expect-error
    delete window.BaiLuLLM
    // @ts-expect-error
    delete window.__bailu_prefetch_state
    vi.stubGlobal('fetch', vi.fn())

    window.BaiLuBehavior = {
      getSignature: () => ({
        sessionId: 'test-session',
        startTime: 0,
        lastActiveTime: 0,
        pagesVisited: [],
        searches: [],
        anomaliesTriggered: [],
        ruleViolations: [],
        copies: 0,
        totalScrollDepth: 0,
        pageCount: 0,
        returnVisit: false,
        version: 1,
      }),
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadBridge() {
    const mod = await import('./llm-bridge')
    return mod
  }

  function validDecision(): NarrativeDecision {
    return {
      version: 'narrative-v2',
      routeDecision: { action: 'stay' },
      contentModules: [],
      memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
    }
  }

  describe('evaluate', () => {
    it('returns agent decision on successful fetch', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      const decision = validDecision()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(decision),
      } as Response)

      const event: GameEvent = { type: 'pageVisit', pageId: 'volume-01' }
      const result = await window.BaiLuLLM!.evaluate(event)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3724/api/narrative',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
      expect(body.event).toEqual(event)
      expect(body.signature).toBeDefined()
      expect(result).toEqual(decision)
    })

    it('returns null on network error', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const event: GameEvent = { type: 'pageVisit' }
      const result = await window.BaiLuLLM!.evaluate(event)

      expect(result).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const event: GameEvent = { type: 'pageVisit' }
      const result = await window.BaiLuLLM!.evaluate(event)

      expect(result).toBeNull()
    })

    it('returns null on timeout', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Timeout', 'AbortError'))

      const event: GameEvent = { type: 'pageVisit' }
      const result = await window.BaiLuLLM!.evaluate(event)

      expect(result).toBeNull()
    })

    it('includes signature in request body', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validDecision()),
      } as Response)

      const event: GameEvent = { type: 'search', keyword: '内科' }
      await window.BaiLuLLM!.evaluate(event)

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
      expect(body.signature.sessionId).toBeDefined()
      expect(body.signature.version).toBeDefined()
    })
  })

  describe('prefetch', () => {
    it('silently fetches and caches decision', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      const decision = validDecision()
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(decision),
      } as Response)

      await window.BaiLuLLM!.prefetch()

      expect(fetch).toHaveBeenCalled()
      expect(window.__bailu_prefetch_state).toEqual(decision)
    })

    it('does not throw on prefetch failure', async () => {
      const { initLLMBridge } = await loadBridge()
      initLLMBridge()

      vi.mocked(fetch).mockRejectedValueOnce(new Error('fail'))

      await expect(window.BaiLuLLM!.prefetch()).resolves.not.toThrow()
      expect(window.__bailu_prefetch_state).toBeUndefined()
    })
  })
})
