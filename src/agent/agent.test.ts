// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Agent } from '@earendil-works/pi-agent-core'
import type { AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai'
import {
  narrativeDecisionTool,
  validateDecision,
  extractDecision,
  promptWithTimeout,
  clampMessageText,
  clampStage,
  getCuriosityVector,
} from './agent.js'
import type { NarrativeDecision, PlayerSignature } from './store.js'

describe('agent', () => {
  describe('narrativeDecisionTool.execute', () => {
    it('returns terminate true to stop agent loop', async () => {
      const decision = validDecision()
      const result = await narrativeDecisionTool.execute('call-1', decision)

      expect(result.terminate).toBe(true)
      expect(result.details).toEqual(decision)
      expect(result.content).toEqual([{ type: 'text', text: '决策已接收' }])
    })
  })

  describe('validateDecision', () => {
    it('returns valid decision unchanged', () => {
      const decision = validDecision()
      expect(validateDecision(decision)).toEqual(decision)
    })

    it('rejects invalid style', () => {
      const decision = {
        ...validDecision(),
        systemMessage: { text: '你好', style: 'invalid' },
      }
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })

    it('rejects invalid action', () => {
      const decision = {
        ...validDecision(),
        routeDecision: { action: 'invalid' as any, targetPage: 'x' },
      }
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })

    it('rejects invalid version', () => {
      const decision = { ...validDecision(), version: 'wrong' }
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })

    it('rejects understandingDepth above 100', () => {
      expect(() =>
        validateDecision({
          ...validDecision(),
          memoryUpdate: { ...validDecision().memoryUpdate, understandingDepth: 150 },
        })
      ).toThrow('Invalid decision')
    })

    it('rejects understandingDepth below 0', () => {
      expect(() =>
        validateDecision({
          ...validDecision(),
          memoryUpdate: { ...validDecision().memoryUpdate, understandingDepth: -10 },
        })
      ).toThrow('Invalid decision')
    })

    it('rejects missing routeDecision', () => {
      const decision = { ...validDecision() } as any
      delete decision.routeDecision
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })

    it('rejects missing memoryUpdate', () => {
      const decision = { ...validDecision() } as any
      delete decision.memoryUpdate
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })

    it('allows missing systemMessage', () => {
      const decision = { ...validDecision() } as any
      delete decision.systemMessage
      expect(validateDecision(decision)).toEqual(decision)
    })

    it('rejects non-array contentModules', () => {
      const decision = { ...validDecision(), contentModules: null } as any
      expect(() => validateDecision(decision)).toThrow('Invalid decision')
    })
  })

  describe('extractDecision', () => {
    function mockAgent(messages: any[]): Agent {
      return { state: { messages } } as Agent
    }

    it('extracts from toolResult message details first', () => {
      const decision = validDecision()
      const agent = mockAgent([
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [{ type: 'toolCall', id: '1', name: 'narrative_decision', arguments: {} }],
          stopReason: 'toolUse',
        } as AssistantMessage,
        {
          role: 'toolResult',
          toolCallId: '1',
          toolName: 'narrative_decision',
          details: decision,
          isError: false,
        } as ToolResultMessage,
      ])
      expect(extractDecision(agent)).toEqual(decision)
    })

    it('throws when toolResult details are invalid', () => {
      const agent = mockAgent([
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [{ type: 'toolCall', id: '1', name: 'narrative_decision', arguments: {} }],
          stopReason: 'toolUse',
        } as AssistantMessage,
        {
          role: 'toolResult',
          toolCallId: '1',
          toolName: 'narrative_decision',
          details: { version: 'wrong' },
          isError: false,
        } as ToolResultMessage,
      ])
      expect(() => extractDecision(agent)).toThrow('Invalid decision')
    })

    it('throws when no tool result found', () => {
      const agent = mockAgent([
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'no tool' }],
          stopReason: 'stop',
        } as AssistantMessage,
      ])
      expect(() => extractDecision(agent)).toThrow('No narrative_decision found')
    })
  })

  describe('promptWithTimeout', () => {
    it('resolves when prompt succeeds before timeout', async () => {
      const agent = {
        prompt: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn(),
      } as unknown as Agent

      await promptWithTimeout(agent, 'hello', 5000)
      expect(agent.prompt).toHaveBeenCalledWith('hello')
      expect(agent.abort).not.toHaveBeenCalled()
    })

    it('rejects when timeout fires before prompt completes', async () => {
      const agent = {
        prompt: vi.fn().mockImplementation(() => new Promise(() => {})),
        abort: vi.fn(),
      } as unknown as Agent

      await expect(promptWithTimeout(agent, 'hello', 10)).rejects.toThrow('Agent timeout after 10ms')
      expect(agent.abort).toHaveBeenCalled()
    })

    it('rejects when prompt fails', async () => {
      const agent = {
        prompt: vi.fn().mockRejectedValue(new Error('LLM failed')),
        abort: vi.fn(),
      } as unknown as Agent

      await expect(promptWithTimeout(agent, 'hello', 5000)).rejects.toThrow('LLM failed')
    })

    it('clears timer when prompt resolves', async () => {
      const agent = {
        prompt: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn(),
      } as unknown as Agent

      vi.useFakeTimers()
      const promise = promptWithTimeout(agent, 'hello', 10000)
      await promise
      vi.advanceTimersByTime(20000)
      expect(agent.abort).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('clampMessageText', () => {
    it('returns decision unchanged when systemMessage has <= 3 sentences', () => {
      const decision = {
        ...validDecision(),
        systemMessage: { text: '第一句。第二句。', style: 'observational' },
      }
      expect(clampMessageText(decision)).toEqual(decision)
    })

    it('throws when systemMessage has more than 3 sentences', () => {
      const decision = {
        ...validDecision(),
        systemMessage: { text: '一。二。三。四。五。', style: 'observational' },
      }
      expect(() => clampMessageText(decision)).toThrow('System message exceeds 3 sentences')
    })

    it('returns decision unchanged when no systemMessage', () => {
      const decision = { ...validDecision(), systemMessage: undefined }
      expect(clampMessageText(decision)).toEqual(decision)
    })
  })

  describe('clampStage', () => {
    it('advances stage forward', () => {
      expect(clampStage('watched', 'noticed')).toBe('watched')
    })

    it('prevents stage regression', () => {
      expect(clampStage('noticed', 'watched')).toBe('watched')
    })

    it('throws for invalid stage name', () => {
      expect(() => clampStage('invalid', 'noticed')).toThrow('Invalid stage')
    })
  })

  describe('getCuriosityVector', () => {
    it('returns empty array for no matches', () => {
      const sig = validPlayerSignature()
      expect(getCuriosityVector(sig)).toEqual([])
    })

    it('detects core_mystery from 4楼 search', () => {
      const sig = { ...validPlayerSignature(), searches: [{ query: '4楼', timestamp: 0 }] }
      expect(getCuriosityVector(sig)).toContain('core_mystery')
    })

    it('detects investigator from 林素琴 search', () => {
      const sig = { ...validPlayerSignature(), searches: [{ query: '林素琴', timestamp: 0 }] }
      expect(getCuriosityVector(sig)).toContain('investigator')
    })

    it('detects meta_aware from 零 search', () => {
      const sig = { ...validPlayerSignature(), searches: [{ query: '零', timestamp: 0 }] }
      expect(getCuriosityVector(sig)).toContain('meta_aware')
    })

    it('detects anomaly_hunter from 3+ anomalies', () => {
      const sig = { ...validPlayerSignature(), anomaliesTriggered: ['a', 'b', 'c'] }
      expect(getCuriosityVector(sig)).toContain('anomaly_hunter')
    })

    it('detects rule_breaker from 3+ violations', () => {
      const sig = { ...validPlayerSignature(), ruleViolations: ['r1', 'r2', 'r3'] }
      expect(getCuriosityVector(sig)).toContain('rule_breaker')
    })

    it('detects archivist from 3+ copies', () => {
      const sig = { ...validPlayerSignature(), copies: 3 }
      expect(getCuriosityVector(sig)).toContain('archivist')
    })
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function validPlayerSignature(): PlayerSignature {
  return {
    sessionId: 'test-session',
    startTime: 1717584000000,
    pagesVisited: [],
    searches: [],
    anomaliesTriggered: [],
    ruleViolations: [],
    copies: 0,
    totalScrollDepth: 0,
  }
}
