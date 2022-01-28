import {defineMark, initialized} from './mark.js'

defineMark('action', {
  elementAttributeChangedCallback(child: Element) {
    for (const binding of bindings(child)) {
      child.addEventListener(binding.type, handleEvent)
    }
  }
})

type Binding = {type: string; tag: string; method: string}
function* bindings(el: Element): Iterable<Binding> {
  for (const action of (el.getAttribute('data-action') || '').trim().split(/\s+/)) {
    const eventSep = action.lastIndexOf(':')
    const methodSep = action.lastIndexOf('#')
    yield {
      type: action.slice(0, eventSep),
      tag: action.slice(eventSep + 1, methodSep),
      method: action.slice(methodSep + 1)
    }
  }
}

// Bind a single function to all events to avoid anonymous closure performance penalty.
function handleEvent(event: Event) {
  const el = event.currentTarget as Element
  for (const binding of bindings(el)) {
    if (event.type === binding.type) {
      type EventDispatcher = HTMLElement & Record<string, (ev: Event) => unknown>
      const controller = el.closest<EventDispatcher>(binding.tag)!
      if (initialized(controller) && typeof controller[binding.method] === 'function') {
        controller[binding.method](event)
      }
      const root = el.getRootNode()
      if (root instanceof ShadowRoot && initialized(root.host) && root.host.matches(binding.tag)) {
        const shadowController = root.host as EventDispatcher
        if (typeof shadowController[binding.method] === 'function') {
          shadowController[binding.method](event)
        }
      }
    }
  }
}
