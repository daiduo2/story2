import { initBehavior } from './behavior.js'
import { initLLMBridge } from './llm-bridge.js'
import { initMain } from './main.js'
import { initSearch } from './search.js'

function initAll() {
  initBehavior()
  initSearch()
  initMain()
  initLLMBridge()

  const sig = window.BaiLuBehavior?.getSignature()
  if (sig) {
    const path = location.pathname
    const title = document.title
    window.BaiLuBehavior?.recordPageVisit(path, title)
  }

  window.BaiLuLLM?.prefetch()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll)
} else {
  initAll()
}
