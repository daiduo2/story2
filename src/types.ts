// === Core Data Types ===

export interface PageVisit {
  url: string
  title: string
  firstVisit: number
  lastVisit: number
  visitCount: number
  dwellTime: number
  maxScrollDepth: number
}

export interface SearchRecord {
  query: string
  timestamp: number
  pageUrl: string
}

export interface RuleViolation {
  ruleId: string
  detail: string
  timestamp: number
  pageUrl: string
}

export interface PlayerSignature {
  sessionId: string
  startTime: number
  lastActiveTime: number
  pagesVisited: PageVisit[]
  searches: SearchRecord[]
  anomaliesTriggered: string[]
  ruleViolations: RuleViolation[]
  copies: number
  totalScrollDepth: number
  pageCount: number
  returnVisit: boolean
  version: number
}

export interface BehaviorSummary {
  totalVisits: number
  uniquePages: number
  totalSearches: number
  hiddenSearches: number
  violations: number
  phase: string
}

// === Narrative Decision Types ===

export type RouteAction = 'stay' | 'redirect' | 'inject'

export interface RouteDecision {
  action: RouteAction
  targetPage?: string
}

export type MessageStyle = 'observational' | 'confrontational' | 'whisper'

export interface SystemMessage {
  text: string
  style: MessageStyle
}

export type ModulePosition = 'before' | 'after'

export interface ContentModuleRef {
  moduleId: string
  targetSelector: string
  position: ModulePosition
}

export interface MemoryUpdate {
  relationshipStage: string
  understandingDepth: number
  observedPatterns: string[]
  notes: string
}

export interface NarrativeDecision {
  version: string
  routeDecision: RouteDecision
  systemMessage?: SystemMessage
  contentModules: ContentModuleRef[]
  memoryUpdate: MemoryUpdate
}

// === Game Event Types ===

export type GameEventType = 'pageVisit' | 'search' | 'copy' | 'scroll' | 'ruleViolation' | 'anomalyTrigger'

export interface GameEvent {
  type: GameEventType
  pageId?: string
  keyword?: string
  ruleId?: string
  anomalyId?: string
}

// === Search Index Types ===

export interface SearchEntryPublic {
  page: string
  tier: 'public'
}

export interface SearchEntryHidden {
  type: 'agent-routed'
  candidates: string[]
  tier: 'hidden'
}

export type SearchEntry = SearchEntryPublic | SearchEntryHidden

// === Type Guards ===

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard)
}

export function isPageVisit(value: unknown): value is PageVisit {
  if (!isObject(value)) return false
  return (
    isString(value.url) &&
    isString(value.title) &&
    isNumber(value.firstVisit) &&
    isNumber(value.lastVisit) &&
    isNumber(value.visitCount) &&
    isNumber(value.dwellTime) &&
    isNumber(value.maxScrollDepth)
  )
}

export function isSearchRecord(value: unknown): value is SearchRecord {
  if (!isObject(value)) return false
  return (
    isString(value.query) &&
    isNumber(value.timestamp) &&
    isString(value.pageUrl)
  )
}

export function isRuleViolation(value: unknown): value is RuleViolation {
  if (!isObject(value)) return false
  return (
    isString(value.ruleId) &&
    isString(value.detail) &&
    isNumber(value.timestamp) &&
    isString(value.pageUrl)
  )
}

export function isPlayerSignature(value: unknown): value is PlayerSignature {
  if (!isObject(value)) return false
  return (
    isString(value.sessionId) &&
    isNumber(value.startTime) &&
    isNumber(value.lastActiveTime) &&
    isArrayOf(value.pagesVisited, isPageVisit) &&
    isArrayOf(value.searches, isSearchRecord) &&
    isArrayOf(value.anomaliesTriggered, isString) &&
    isArrayOf(value.ruleViolations, isRuleViolation) &&
    isNumber(value.copies) &&
    isNumber(value.totalScrollDepth) &&
    isNumber(value.pageCount) &&
    isBoolean(value.returnVisit) &&
    isNumber(value.version)
  )
}

const VALID_ROUTE_ACTIONS: RouteAction[] = ['stay', 'redirect', 'inject']

export function isRouteDecision(value: unknown): value is RouteDecision {
  if (!isObject(value)) return false
  if (!isString(value.action) || !VALID_ROUTE_ACTIONS.includes(value.action as RouteAction)) {
    return false
  }
  if (value.action === 'redirect' || value.action === 'inject') {
    if (!isString(value.targetPage)) return false
  }
  return true
}

const VALID_MESSAGE_STYLES: MessageStyle[] = ['observational', 'confrontational', 'whisper']

export function isSystemMessage(value: unknown): value is SystemMessage {
  if (!isObject(value)) return false
  return (
    isString(value.text) &&
    isString(value.style) &&
    VALID_MESSAGE_STYLES.includes(value.style as MessageStyle)
  )
}

const VALID_MODULE_POSITIONS: ModulePosition[] = ['before', 'after']

export function isContentModuleRef(value: unknown): value is ContentModuleRef {
  if (!isObject(value)) return false
  return (
    isString(value.moduleId) &&
    isString(value.targetSelector) &&
    isString(value.position) &&
    VALID_MODULE_POSITIONS.includes(value.position as ModulePosition)
  )
}

export function isMemoryUpdate(value: unknown): value is MemoryUpdate {
  if (!isObject(value)) return false
  return (
    isString(value.relationshipStage) &&
    isNumber(value.understandingDepth) &&
    isArrayOf(value.observedPatterns, isString) &&
    isString(value.notes)
  )
}

export function isNarrativeDecision(value: unknown): value is NarrativeDecision {
  if (!isObject(value)) return false
  return (
    isString(value.version) && value.version.startsWith('narrative-v') &&
    isRouteDecision(value.routeDecision) &&
    (value.systemMessage === undefined || isSystemMessage(value.systemMessage)) &&
    isArrayOf(value.contentModules, isContentModuleRef) &&
    isMemoryUpdate(value.memoryUpdate)
  )
}

const VALID_EVENT_TYPES: GameEventType[] = [
  'pageVisit',
  'search',
  'copy',
  'scroll',
  'ruleViolation',
  'anomalyTrigger',
]

export function isGameEvent(value: unknown): value is GameEvent {
  if (!isObject(value)) return false
  if (!isString(value.type) || !VALID_EVENT_TYPES.includes(value.type as GameEventType)) {
    return false
  }
  return true
}
