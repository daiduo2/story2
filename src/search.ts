import type { SearchEntry } from './types'
import type { BaiLuBehaviorAPI } from './behavior'

const SEARCH_INDEX: Record<string, SearchEntry> = {
  // volumes — 正编病历
  '入院': { page: 'volume-01', tier: 'public' },
  '内科': { page: 'volume-02', tier: 'public' },
  '病程下': { page: 'volume-03', tier: 'public' },
  '精神科': { page: 'volume-04', tier: 'public' },
  '护理': { page: 'volume-05', tier: 'public' },
  '药房': { page: 'volume-06', tier: 'public' },
  '临终': { page: 'volume-07', tier: 'public' },
  '建筑': { page: 'volume-08', tier: 'public' },
  '膳食': { page: 'volume-09', tier: 'public' },
  '安全': { page: 'volume-10', tier: 'public' },
  '财务': { page: 'volume-11', tier: 'public' },
  '人员': { page: 'volume-12', tier: 'public' },
  '设备': { page: 'volume-13', tier: 'public' },
  '感染': { page: 'volume-14', tier: 'public' },
  '康复': { page: 'volume-15', tier: 'public' },
  '会诊': { page: 'volume-16', tier: 'public' },
  '家属': { page: 'volume-17', tier: 'public' },
  '特殊': { page: 'volume-18', tier: 'public' },
  '病例下': { page: 'volume-19', tier: 'public' },
  '事故': { page: 'volume-20', tier: 'public' },
  '调查下': { page: 'volume-21', tier: 'public' },
  '未归档': { page: 'volume-22', tier: 'public' },
  '异闻': { page: 'volume-23', tier: 'public' },
  '异闻下': { page: 'volume-24', tier: 'public' },

  // supplements
  '林素琴': { page: 'supplement-lin', tier: 'public' },

  // peripherals
  '急救': { page: 'ambulance-log', tier: 'public' },
  '保洁': { page: 'cleaning-log', tier: 'public' },
  '餐饮': { page: 'food-supply', tier: 'public' },
  '太平间': { page: 'morgue-transfer', tier: 'public' },
  '发药': { page: 'pharmacy-log', tier: 'public' },
  '停电': { page: 'power-outage', tier: 'public' },
  '监控': { page: 'security-cctv', tier: 'public' },

  // meta
  '关于': { page: 'about', tier: 'public' },
  '目录': { page: 'archives', tier: 'public' },
  '须知': { page: 'notice', tier: 'public' },

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

function getSessionId(): string | null {
  return new URLSearchParams(location.search).get('sid')
}

function buildPageUrl(pageId: string): string {
  const url = new URL(`/pages/${pageId}`, location.href)
  const sid = getSessionId()
  if (sid) url.searchParams.set('sid', sid)
  return url.toString()
}

function showSearchFeedback(keyword: string, found: boolean): void {
  const form = document.getElementById('search-form')
  if (!form) return

  const existing = document.getElementById('search-feedback')
  if (existing) existing.remove()

  const el = document.createElement('div')
  el.id = 'search-feedback'
  el.className = `search-feedback ${found ? 'search-found' : 'search-not-found'}`
  el.textContent = found
    ? `已定位相关档案，正在跳转...`
    : `未找到与"${keyword}"相关的档案。`

  form.parentNode?.insertBefore(el, form.nextSibling)

  if (found) {
    setTimeout(() => el.remove(), 1500)
  } else {
    setTimeout(() => el.remove(), 4000)
  }
}

function renderSearchHistory(): void {
  const sig = window.BaiLuBehavior?.getSignature()
  if (!sig || sig.searches.length === 0) return

  const container = document.getElementById('search-history')
  if (!container) return

  const recent = sig.searches.slice(-5).reverse()
  container.innerHTML = recent.map(s =>
    `<span class="search-history-item" data-keyword="${encodeURIComponent(s.query)}">${s.query}</span>`
  ).join('')

  container.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const keyword = decodeURIComponent(item.getAttribute('data-keyword') || '')
      executeSearch(keyword)
    })
  })
}

function executeSearch(keyword?: string): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null
  if (!input) return

  const q = (keyword ?? input.value).trim()
  if (!q) return

  if (!keyword && input) input.value = ''

  const targetPage = window.BaiLuSearch?.handleSearch(q)

  if (targetPage) {
    showSearchFeedback(q, true)
    setTimeout(() => {
      location.assign(buildPageUrl(targetPage))
    }, 300)
  } else {
    showSearchFeedback(q, false)
  }

  renderSearchHistory()
}

function initSearchUI(): void {
  const form = document.getElementById('search-form')
  const input = document.getElementById('search-input') as HTMLInputElement | null
  if (!form || !input) return

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    executeSearch()
  })

  input.addEventListener('focus', () => {
    renderSearchHistory()
  })
}

export function initSearch() {
  window.BaiLuSearch = {
    handleSearch,
    resolveSearch,
    getIndex,
  }
  initSearchUI()
}
