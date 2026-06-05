import type { PlayerSignature, NarrativeDecision } from './types'

const STORAGE_KEY = 'bailu_player_history'

export interface HistoryEvent {
  type: string
  timestamp: number
  data: unknown
}

export interface PlayerHistoryData {
  events: HistoryEvent[]
  sessions: string[]
}

export interface BaiLuPlayerHistoryAPI {
  getHistory: () => PlayerHistoryData
  recordEvent: (type: string, data: unknown) => void
  recordSessionSnapshot: (signature: PlayerSignature) => void
  recordDecision: (decision: NarrativeDecision) => void
  getTimeline: () => HistoryEvent[]
  getRecentEvents: (count: number) => HistoryEvent[]
  clearHistory: () => void
}

declare global {
  interface Window {
    BaiLuPlayerHistory?: BaiLuPlayerHistoryAPI
  }
}

let historyData: PlayerHistoryData | null = null

function createFreshHistory(): PlayerHistoryData {
  return {
    events: [],
    sessions: [],
  }
}

function loadHistory(): PlayerHistoryData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (isValidHistory(parsed)) {
        return parsed
      }
    } catch {
      // ignore parse error
    }
  }
  return createFreshHistory()
}

function isValidHistory(value: unknown): value is PlayerHistoryData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.events) && Array.isArray(v.sessions)
}

function persist() {
  if (historyData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData))
  }
}

function getHistory(): PlayerHistoryData {
  if (!historyData) historyData = loadHistory()
  return historyData
}

function recordEvent(type: string, data: unknown) {
  const history = getHistory()
  history.events.push({
    type,
    timestamp: Date.now(),
    data,
  })
  persist()
}

function recordSessionSnapshot(signature: PlayerSignature) {
  const history = getHistory()
  if (!history.sessions.includes(signature.sessionId)) {
    history.sessions.push(signature.sessionId)
  }
  recordEvent('sessionSnapshot', {
    sessionId: signature.sessionId,
    pageCount: signature.pageCount,
    searchCount: signature.searches.length,
    violationCount: signature.ruleViolations.length,
  })
}

function recordDecision(decision: NarrativeDecision) {
  recordEvent('decision', {
    action: decision.routeDecision.action,
    targetPage: decision.routeDecision.targetPage,
    memoryStage: decision.memoryUpdate.relationshipStage,
    understandingDepth: decision.memoryUpdate.understandingDepth,
  })
}

function getTimeline(): HistoryEvent[] {
  const history = getHistory()
  return [...history.events].sort((a, b) => a.timestamp - b.timestamp)
}

function getRecentEvents(count: number): HistoryEvent[] {
  const history = getHistory()
  return history.events.slice(-count)
}

function clearHistory() {
  historyData = createFreshHistory()
  localStorage.removeItem(STORAGE_KEY)
}

export function initPlayerHistory() {
  historyData = loadHistory()

  window.BaiLuPlayerHistory = {
    getHistory,
    recordEvent,
    recordSessionSnapshot,
    recordDecision,
    getTimeline,
    getRecentEvents,
    clearHistory,
  }
}
