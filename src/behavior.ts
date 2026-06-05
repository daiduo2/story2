import type { PlayerSignature, PageVisit, BehaviorSummary, RuleViolation } from './types'

const STORAGE_KEY = 'bailu_behavior_signature'
const HIDDEN_KEYWORDS = ['4楼', '404', '体温', '多出来', '2:47', '集体癔症', '不像自己', '第七本', '给药', '零', '规则', '不对劲', '镜子', '融合', '理解', '真相']

let signature: PlayerSignature | null = null
let dwellInterval: ReturnType<typeof setInterval> | null = null
let currentPageUrl: string | null = null

function generateSessionId(): string {
  return `bailu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createFreshSignature(): PlayerSignature {
  const now = Date.now()
  return {
    sessionId: generateSessionId(),
    startTime: now,
    lastActiveTime: now,
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
}

function loadSignature(): PlayerSignature {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (isValidSignature(parsed)) {
        parsed.returnVisit = true
        parsed.lastActiveTime = Date.now()
        return parsed
      }
    } catch {
      // ignore parse error
    }
  }
  return createFreshSignature()
}

function isValidSignature(value: unknown): value is PlayerSignature {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.sessionId === 'string' &&
    typeof v.startTime === 'number' &&
    Array.isArray(v.pagesVisited) &&
    Array.isArray(v.searches) &&
    typeof v.copies === 'number'
  )
}

function persist() {
  if (signature) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signature))
  }
}

function startDwellTracking() {
  if (dwellInterval) clearInterval(dwellInterval)
  dwellInterval = setInterval(() => {
    if (!signature || !currentPageUrl) return
    const page = signature.pagesVisited.find(p => p.url === currentPageUrl)
    if (page) {
      page.dwellTime += 5
      signature.lastActiveTime = Date.now()
      persist()
    }
  }, 5000)
}

function extractPageId(url: string): string {
  const match = url.match(/\/pages\/(\S+)/)
  return match ? match[1] : url
}

// === Public API ===

export interface BaiLuBehaviorAPI {
  getSignature: () => PlayerSignature
  getSummary: () => BehaviorSummary
  recordSearch: (query: string) => void
  recordAnomaly: (anomalyId: string) => void
  recordRuleViolation: (ruleId: string, detail: string) => void
  recordCopy: () => void
  recordPageVisit: (url: string, title: string) => void
  getPhase: () => string
  reset: () => void
}

declare global {
  interface Window {
    BaiLuBehavior?: BaiLuBehaviorAPI
  }
}

function getSignature(): PlayerSignature {
  if (!signature) signature = loadSignature()
  return signature
}

function getSummary(): BehaviorSummary {
  const sig = getSignature()
  const hiddenSearches = sig.searches.filter(s => HIDDEN_KEYWORDS.includes(s.query)).length
  return {
    totalVisits: sig.pagesVisited.reduce((sum, p) => sum + p.visitCount, 0),
    uniquePages: sig.pagesVisited.length,
    totalSearches: sig.searches.length,
    hiddenSearches,
    violations: sig.ruleViolations.length,
    phase: getPhase(),
  }
}

function recordSearch(query: string) {
  const sig = getSignature()
  sig.searches.push({
    query,
    timestamp: Date.now(),
    pageUrl: window.location.href,
  })
  sig.lastActiveTime = Date.now()
  persist()
}

function recordAnomaly(anomalyId: string) {
  const sig = getSignature()
  if (!sig.anomaliesTriggered.includes(anomalyId)) {
    sig.anomaliesTriggered.push(anomalyId)
  }
  sig.lastActiveTime = Date.now()
  persist()
}

function recordRuleViolation(ruleId: string, detail: string) {
  const sig = getSignature()
  const violation: RuleViolation = {
    ruleId,
    detail,
    timestamp: Date.now(),
    pageUrl: window.location.href,
  }
  sig.ruleViolations.push(violation)
  sig.lastActiveTime = Date.now()
  persist()
}

function recordCopy() {
  const sig = getSignature()
  sig.copies += 1
  sig.lastActiveTime = Date.now()
  persist()
}

function recordPageVisit(url: string, title: string) {
  const sig = getSignature()
  const now = Date.now()
  currentPageUrl = url

  const existing = sig.pagesVisited.find(p => p.url === url)
  if (existing) {
    existing.lastVisit = now
    existing.visitCount += 1
  } else {
    const visit: PageVisit = {
      url,
      title,
      firstVisit: now,
      lastVisit: now,
      visitCount: 1,
      dwellTime: 0,
      maxScrollDepth: 0,
    }
    sig.pagesVisited.push(visit)
  }

  sig.pageCount = sig.pagesVisited.length
  sig.lastActiveTime = now
  startDwellTracking()
  persist()
}

function getPhase(): string {
  const sig = getSignature()
  const violations = sig.ruleViolations.length
  const hiddenSearches = sig.searches.filter(s => HIDDEN_KEYWORDS.includes(s.query)).length
  const uniquePages = sig.pagesVisited.length

  if (violations >= 5) return 'awakened'
  if (violations >= 1) return 'noticed'
  if (hiddenSearches >= 1) return 'curious'
  if (uniquePages >= 3) return 'explorer'
  return 'newcomer'
}

function reset() {
  signature = createFreshSignature()
  localStorage.removeItem(STORAGE_KEY)
  currentPageUrl = null
  if (dwellInterval) {
    clearInterval(dwellInterval)
    dwellInterval = null
  }
}

function handleScroll() {
  if (!signature || !currentPageUrl) return
  const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
  const scrollTop = window.scrollY
  const depth = scrollHeight > 0 ? scrollTop / scrollHeight : 0

  const page = signature.pagesVisited.find(p => p.url === currentPageUrl)
  if (page) {
    page.maxScrollDepth = Math.max(page.maxScrollDepth, depth)
  }
  signature.totalScrollDepth += depth
  signature.lastActiveTime = Date.now()
  persist()
}

export function initBehavior() {
  signature = loadSignature()

  window.BaiLuBehavior = {
    getSignature,
    getSummary,
    recordSearch,
    recordAnomaly,
    recordRuleViolation,
    recordCopy,
    recordPageVisit,
    getPhase,
    reset,
  }

  window.addEventListener('scroll', handleScroll)
  document.addEventListener('copy', recordCopy)
}
