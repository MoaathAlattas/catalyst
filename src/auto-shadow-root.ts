import {defineMark, initialized} from './mark.js'

const shadows = new WeakMap<Element, ShadowRoot>()
defineMark('shadowroot', {
  elementAttributeChangedCallback(child: Element, mode: string | null) {
    if (!(child instanceof HTMLTemplateElement)) return
    if (!child.parentElement || !initialized(child.parentElement)) return
    const controller = child.parentElement
    if (!shadows.has(controller)) {
      shadows.set(
        controller,
        controller.shadowRoot || controller.attachShadow({mode: mode === 'closed' ? 'closed' : 'open'})
      )
    }
    shadows.get(controller)?.append(child.content.cloneNode(true))
  }
})
