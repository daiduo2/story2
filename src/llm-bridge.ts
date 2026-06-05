import type { GameEvent, NarrativeDecision, PlayerSignature } from './types'

const API_URL = 'http://localhost:3724/api/narrative'

export interface BaiLuLLMAPI {
  evaluate: (event: GameEvent) => Promise<NarrativeDecision | null>
  prefetch: () => Promise<void>
}

declare global {
  interface Window {
    BaiLuLLM?: BaiLuLLMAPI
    __bailu_prefetch_state?: NarrativeDecision
  }
}

async function evaluate(event: GameEvent): Promise<NarrativeDecision | null> {
  const signature = window.BaiLuBehavior?.getSignature()
  if (!signature) return null

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: signature.sessionId, event, signature }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return null

    const decision = await response.json() as NarrativeDecision
    window.__bailu_prefetch_state = decision
    return decision
  } catch {
    return null
  }
}

async function prefetch() {
  const signature = window.BaiLuBehavior?.getSignature()
  if (!signature) return

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: signature.sessionId, event: { type: 'pageVisit' }, signature }),
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const decision = await response.json() as NarrativeDecision
      window.__bailu_prefetch_state = decision
    }
  } catch {
    // prefetch failures are silent
  }
}

export function initLLMBridge() {
  window.BaiLuLLM = {
    evaluate,
    prefetch,
  }
}
