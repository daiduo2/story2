import type { NarrativeDecision, SystemMessage, ContentModuleRef } from './types'

export function executeDecision(decision: NarrativeDecision) {
  const { routeDecision, systemMessage, contentModules } = decision

  if (routeDecision.action === 'redirect' && routeDecision.targetPage) {
    const prefix = location.pathname.includes('/pages/') ? '' : 'pages/'
    location.assign(prefix + routeDecision.targetPage + '.html')
    return
  }

  if (systemMessage?.text) {
    injectSystemMessage(systemMessage)
  }

  contentModules.forEach(module => {
    injectContentModule(module)
  })
}

export function injectSystemMessage(msg: SystemMessage) {
  const container = document.querySelector('main') || document.body
  const el = document.createElement('div')
  el.className = `system-message style-${msg.style}`
  el.textContent = msg.text
  container.appendChild(el)
}

export function injectContentModule(module: ContentModuleRef) {
  const target = document.querySelector(module.targetSelector)
  if (!target || !target.parentNode) return

  const html = loadModuleHtml(module.moduleId)
  const temp = document.createElement('div')
  temp.innerHTML = html

  if (module.position === 'after') {
    target.parentNode.insertBefore(temp, target.nextSibling)
  } else {
    target.parentNode.insertBefore(temp, target)
  }
}

export function loadModuleHtml(moduleId: string): string {
  const registry = (window as unknown as Record<string, unknown>).__bailu_module_registry as Record<string, string> | undefined
  if (registry?.[moduleId]) return registry[moduleId]

  return `<div data-module-id="${moduleId}" class="module-loading"></div>`
}
