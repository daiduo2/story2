import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NarrativeDecision, SystemMessage, ContentModuleRef } from './types'

describe('router', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = '<main id="main"><div id="target">Target</div></main>'
    // @ts-expect-error
    delete window.__bailu_module_registry
  })

  async function loadRouter() {
    const mod = await import('./router')
    return mod
  }

  describe('executeDecision', () => {
    function mockLocation() {
      const assignMock = vi.fn()
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, assign: assignMock, href: originalLocation.href },
      })
      return assignMock
    }

    function restoreLocation() {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: location,
      })
    }

    it('redirects when action is redirect', async () => {
      const { executeDecision } = await loadRouter()
      const assignMock = mockLocation()

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'redirect', targetPage: 'volume-04' },
        contentModules: [],
        memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
      }

      executeDecision(decision)
      expect(assignMock).toHaveBeenCalled()
      restoreLocation()
    })

    it('stays on page when action is stay', async () => {
      const { executeDecision } = await loadRouter()
      const assignMock = mockLocation()

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'stay' },
        contentModules: [],
        memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
      }

      executeDecision(decision)
      expect(assignMock).not.toHaveBeenCalled()
      restoreLocation()
    })

    it('injects system message', async () => {
      const { executeDecision } = await loadRouter()

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'stay' },
        systemMessage: { text: '系统记录了。', style: 'observational' },
        contentModules: [],
        memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
      }

      executeDecision(decision)
      const msg = document.querySelector('.system-message')
      expect(msg).not.toBeNull()
      expect(msg!.textContent).toBe('系统记录了。')
      expect(msg!.classList.contains('style-observational')).toBe(true)
    })

    it('injects multiple content modules', async () => {
      const { executeDecision } = await loadRouter()
      // @ts-expect-error
      window.__bailu_module_registry = {
        'test-module': '<p class="injected">Injected content</p>',
      }

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'stay' },
        contentModules: [
          { moduleId: 'test-module', targetSelector: '#target', position: 'after' },
        ],
        memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
      }

      executeDecision(decision)
      const injected = document.querySelector('.injected')
      expect(injected).not.toBeNull()
    })

    it('handles missing target selector gracefully', async () => {
      const { executeDecision } = await loadRouter()

      const decision: NarrativeDecision = {
        version: 'narrative-v2',
        routeDecision: { action: 'stay' },
        contentModules: [
          { moduleId: 'test', targetSelector: '#nonexistent', position: 'after' },
        ],
        memoryUpdate: { relationshipStage: 'unknown', understandingDepth: 0, observedPatterns: [], notes: '' },
      }

      expect(() => executeDecision(decision)).not.toThrow()
    })
  })

  describe('injectSystemMessage', () => {
    it('creates observational style message', async () => {
      const { injectSystemMessage } = await loadRouter()
      const msg: SystemMessage = { text: '观察中...', style: 'observational' }

      injectSystemMessage(msg)
      const el = document.querySelector('.system-message')
      expect(el).not.toBeNull()
      expect(el!.textContent).toBe('观察中...')
      expect(el!.classList.contains('style-observational')).toBe(true)
    })

    it('creates confrontational style message', async () => {
      const { injectSystemMessage } = await loadRouter()
      const msg: SystemMessage = { text: '警告！', style: 'confrontational' }

      injectSystemMessage(msg)
      const el = document.querySelector('.system-message')
      expect(el!.classList.contains('style-confrontational')).toBe(true)
    })

    it('falls back to body when no main exists', async () => {
      document.body.innerHTML = '<div>No main here</div>'
      const { injectSystemMessage } = await loadRouter()
      const msg: SystemMessage = { text: 'test', style: 'observational' }

      injectSystemMessage(msg)
      const el = document.querySelector('.system-message')
      expect(el).not.toBeNull()
      expect(el!.parentElement).toBe(document.body)
    })
  })

  describe('injectContentModule', () => {
    it('inserts after target', async () => {
      const { injectContentModule } = await loadRouter()
      // @ts-expect-error
      window.__bailu_module_registry = {
        'mod-1': '<span class="mod">Content</span>',
      }

      const mod: ContentModuleRef = { moduleId: 'mod-1', targetSelector: '#target', position: 'after' }
      injectContentModule(mod)

      const injected = document.querySelector('.mod')
      expect(injected).not.toBeNull()
    })

    it('inserts before target', async () => {
      const { injectContentModule } = await loadRouter()
      // @ts-expect-error
      window.__bailu_module_registry = {
        'mod-1': '<span class="mod">Content</span>',
      }

      const mod: ContentModuleRef = { moduleId: 'mod-1', targetSelector: '#target', position: 'before' }
      injectContentModule(mod)

      const injected = document.querySelector('.mod')
      expect(injected).not.toBeNull()
    })

    it('returns early for missing target', async () => {
      const { injectContentModule } = await loadRouter()
      const mod: ContentModuleRef = { moduleId: 'mod-1', targetSelector: '#nonexistent', position: 'after' }
      expect(() => injectContentModule(mod)).not.toThrow()
    })
  })

  describe('loadModuleHtml', () => {
    it('returns registry content when available', async () => {
      const { loadModuleHtml } = await loadRouter()
      // @ts-expect-error
      window.__bailu_module_registry = {
        'test-mod': '<p>Registered</p>',
      }

      expect(loadModuleHtml('test-mod')).toBe('<p>Registered</p>')
    })

    it('returns placeholder when not in registry', async () => {
      const { loadModuleHtml } = await loadRouter()
      const html = loadModuleHtml('unknown-mod')
      expect(html).toContain('module-loading')
      expect(html).toContain('unknown-mod')
    })
  })
})
