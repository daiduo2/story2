// === Console Easter Egg ===

function printConsoleEasterEgg() {
  console.log('%c白鹿疗养院病历数字化项目', 'font-size: 20px; color: #2c5f2d;')
  console.log('%c系统运行正常。', 'color: #666;')
  console.log('%c...', 'color: #f0f2f5;')
  console.log('%c如果你能看到这行字，说明你已经比大多数研究者走得更远了。', 'color: #c8cdd5; font-size: 10px;')
}

// === Anomaly: Search Injection ===

const ANOMALY_SEARCH_TERMS = ['4楼', '第七本', '2:47', '不对劲', '多出来']

function maybeInjectSearch() {
  const sig = window.BaiLuBehavior?.getSignature()
  if (!sig) return

  const totalVisits = sig.pagesVisited.reduce((sum, p) => sum + p.visitCount, 0)
  if (totalVisits < 3) return
  if (Math.random() >= 0.15) return

  const searchInput = document.getElementById('search-input') as HTMLInputElement | null
  if (!searchInput) return

  const term = ANOMALY_SEARCH_TERMS[Math.floor(Math.random() * ANOMALY_SEARCH_TERMS.length)]
  searchInput.setAttribute('placeholder', term)
  searchInput.dataset.injected = term
  window.BaiLuBehavior?.recordAnomaly('anom-search-inject')
}

// === Anomaly: Content Shift ===

function handleCopyWithShift() {
  window.BaiLuBehavior?.recordCopy()
}

// === Anomaly: Page Timeout ===

function checkPageTimeout() {
  const sig = window.BaiLuBehavior?.getSignature()
  if (!sig || sig.pagesVisited.length === 0) return

  const currentPage = sig.pagesVisited[sig.pagesVisited.length - 1]
  if (currentPage.dwellTime > 600) {
    document.body.style.setProperty('--footer-color', '#8b0000')
  }
}

// === Rule Detection ===

function checkRule1() {
  if (location.href.includes('volume-00')) {
    window.BaiLuBehavior?.recordRuleViolation('rule_1', '访问了卷零页面')
  }
}

function initRule3Detection() {
  const searchForm = document.getElementById('search-form')
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null
  if (!searchForm || !searchInput) return

  searchForm.addEventListener('submit', (e) => {
    const injected = searchInput.dataset.injected
    if (injected && searchInput.value === injected) {
      window.BaiLuBehavior?.recordRuleViolation('rule_3', `搜索了注入的关键词：${injected}`)
    }
  })
}

// === Public API ===

export function initMain() {
  printConsoleEasterEgg()
  checkRule1()
  maybeInjectSearch()
  initRule3Detection()

  document.addEventListener('copy', handleCopyWithShift)
  checkPageTimeout()
  setInterval(checkPageTimeout, 60000)
}
