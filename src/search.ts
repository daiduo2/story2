import type { SearchEntry } from './types'
import type { BaiLuBehaviorAPI } from './behavior'

const SEARCH_INDEX: Record<string, SearchEntry> = {
  '入院': { page: 'volume-01', tier: 'public' },
  '内科': { page: 'volume-02', tier: 'public' },
  '精神科': { page: 'volume-04', tier: 'public' },
  '护理': { page: 'volume-05', tier: 'public' },
  '药房': { page: 'volume-06', tier: 'public' },
  '临终': { page: 'volume-07', tier: 'public' },
  '林素琴': { page: 'supplement-lin', tier: 'public' },
  '监控': { page: 'security-cctv', tier: 'public' },
  '停电': { page: 'power-outage', tier: 'public' },

  '4楼': { type: 'agent-routed', candidates: ['volume-04', 'volume-08', 'supplement-lin'], tier: 'hidden' },
  '404': { type: 'agent-routed', candidates: ['volume-04', 'supplement-lin'], tier: 'hidden' },
  '体温': { type: 'agent-routed', candidates: ['volume-05', 'volume-18'], tier: 'hidden' },
  '多出来': { type: 'agent-routed', candidates: ['volume-09', 'food-supply', 'security-cctv'], tier: 'hidden' },
  '2:47': { type: 'agent-routed', candidates: ['volume-10', 'security-cctv'], tier: 'hidden' },
  '集体癔症': { type: 'agent-routed', candidates: ['volume-04', 'volume-18', 'volume-19'], tier: 'hidden' },
  '不像自己': { type: 'agent-routed', candidates: ['volume-17', 'volume-21'], tier: 'hidden' },
  '第七本': { type: 'agent-routed', candidates: ['supplement-lin', 'lin-note-7'], tier: 'hidden' },
  '给药': { type: 'agent-routed', candidates: ['volume-06', 'pharmacy-log'], tier: 'hidden' },
  '零': { type: 'agent-routed', candidates: ['volume-00'], tier: 'hidden' },
  '规则': { type: 'agent-routed', candidates: ['notice', 'volume-00'], tier: 'hidden' },
  '不对劲': { type: 'agent-routed', candidates: ['supplement-lin', 'volume-04-awakened'], tier: 'hidden' },
  '镜子': { type: 'agent-routed', candidates: ['mirror'], tier: 'hidden' },
  '融合': { type: 'agent-routed', candidates: ['ending-awakened'], tier: 'hidden' },
  '理解': { type: 'agent-routed', candidates: ['ending-empath'], tier: 'hidden' },
  '真相': { type: 'agent-routed', candidates: ['ending-curious'], tier: 'hidden' },
}

export interface BaiLuSearchAPI {
  handleSearch: (keyword: string) => string | null
  resolveSearch: (keyword: string) => string | null
  getIndex: () => Record<string, SearchEntry>
}

declare global {
  interface Window {
    BaiLuSearch?: BaiLuSearchAPI
    __bailu_search_overrides?: Record<string, string>
    BaiLuBehavior?: BaiLuBehaviorAPI
  }
}

function extractPageId(url: string): string {
  const match = url.match(/\/pages\/(\S+)/)
  return match ? match[1] : url
}

function getSearchOverrides(): Record<string, string> | undefined {
  return window.__bailu_search_overrides
}

function resolveSearch(keyword: string): string | null {
  const entry = SEARCH_INDEX[keyword]
  if (!entry) return null

  if (entry.tier === 'public') return entry.page

  const overrides = getSearchOverrides()
  if (overrides?.[keyword]) return overrides[keyword]

  const sig = window.BaiLuBehavior?.getSignature()
  const visited = sig?.pagesVisited.map(p => extractPageId(p.url)) || []
  const hasVisitedAny = entry.candidates.some(c => visited.includes(c))

  if (hasVisitedAny) return entry.candidates[0]
  return null
}

function handleSearch(keyword: string): string | null {
  window.BaiLuBehavior?.recordSearch(keyword)
  return resolveSearch(keyword)
}

function getIndex(): Record<string, SearchEntry> {
  return { ...SEARCH_INDEX }
}

export function initSearch() {
  window.BaiLuSearch = {
    handleSearch,
    resolveSearch,
    getIndex,
  }
}
