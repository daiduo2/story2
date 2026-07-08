import type { PlayerSignature, PageVisit, BehaviorSummary, RuleViolation } from './types'

const HIDDEN_KEYWORDS = ['4楼', '404', '体温', '多出来', '2:47', '集体癔症', '不像自己', '第七本', '给药', '零', '规则', '不对劲', '镜子', '融合', '理解', '真相']

let signature: PlayerSignature | null = null
let dwellInterval: ReturnType<typeof setInterval> | null = null
let currentPageUrl: string | null = null

function generateSessionId(): string {
  return `bailu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getStorageKey(sessionId: string): string {
  return `bailu_sig_${sessionId}`
}

function getSessionIdFromUrl(): string | null {
  const params = new URLSearchParams(location.search)
  return params.get('sid')
}

function getOrCreateSessionId(): string {
  const fromUrl = getSessionIdFromUrl()
  if (fromUrl) {
    sessionStorage.setItem('bailu_current_sid', fromUrl)
    return fromUrl
  }

  const fromSession = sessionStorage.getItem('bailu_current_sid')
  if (fromSession) {
    return fromSession
  }

  const newId = generateSessionId()
  sessionStorage.setItem('bailu_current_sid', newId)
  return newId
}

function ensureUrlHasSessionId(): void {
  if (getSessionIdFromUrl()) return
  const sid = getOrCreateSessionId()
  const url = new URL(location.href)
  url.searchParams.set('sid', sid)
  history.replaceState(null, '', url.toString())
}

export function appendSidToUrl(url: string): string {
  const sid = getOrCreateSessionId()
  if (!sid) return url
  const u = new URL(url, location.href)
  u.searchParams.set('sid', sid)
  return u.pathname + u.search + u.hash
}

function interceptLinks(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const anchor = target.closest('a') as HTMLAnchorElement | null
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    e.preventDefault()
    location.assign(appendSidToUrl(href))
  })
}

function createFreshSignature(sessionId: string): PlayerSignature {
  const now = Date.now()
  return {
    sessionId,
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

function loadSignature(sessionId: string): PlayerSignature {
  const stored = localStorage.getItem(getStorageKey(sessionId))
  if (!stored) {
    return createFreshSignature(sessionId)
  }

  const parsed = JSON.parse(stored)
  if (!isValidSignature(parsed)) {
    throw new Error(`Corrupted behavior signature for session ${sessionId}`)
  }
  parsed.returnVisit = true
  parsed.lastActiveTime = Date.now()
  return parsed
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
    localStorage.setItem(getStorageKey(signature.sessionId), JSON.stringify(signature))
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
  if (!signature) signature = loadSignature(getOrCreateSessionId())
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
  if (signature) {
    localStorage.removeItem(getStorageKey(signature.sessionId))
  }
  sessionStorage.removeItem('bailu_current_sid')
  signature = null
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
  ensureUrlHasSessionId()
  const sessionId = getOrCreateSessionId()

  try {
    signature = loadSignature(sessionId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[BaiLuBehavior] Failed to load signature, resetting:', message)
    reset()
    signature = createFreshSignature(sessionId)
  }

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

  interceptLinks()
  window.addEventListener('scroll', handleScroll)
  document.addEventListener('copy', recordCopy)
}
