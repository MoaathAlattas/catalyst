import type {CustomElement} from './custom-element.js'

export type InitializePropertyCallback<K = PropertyKey, V = unknown> = (instance: HTMLElement, k: K, v: V) => void
export type ElementAttributeChangedCallback = (child: Element, value: string | null) => void
export type InitializeClassCallback = (classObj: CustomElement) => void

interface MarkHandlers<K, V> {
  initializePropertyCallback?: InitializePropertyCallback<K, V>
  elementAttributeChangedCallback?: ElementAttributeChangedCallback
  initializeClassCallback?: InitializeClassCallback
}

const classCallbacks = new Set<InitializeClassCallback>()
const attrCallbacks = new Map<string, Set<ElementAttributeChangedCallback>>()
const propCallbacks = new WeakMap<Record<PropertyKey, unknown>, Map<InitializePropertyCallback, Set<PropertyKey>>>()

interface Subscription {
  closed: boolean
  unsubscribe(): void
}

const observers = new WeakMap<Document | ShadowRoot, Subscription>()
export function listenForNewAttributes(doc: Document | ShadowRoot): Subscription {
  if (observers.has(doc)) return observers.get(doc)!
  let closed = false
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName && mutation.target instanceof Element) {
        for (const callback of attrCallbacks.get(mutation.attributeName) || []) {
          callback(mutation.target, mutation.attributeName)
        }
      } else if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) callOnAttributes(node)
        }
      }
    }
  })
  observer.observe(doc, {childList: true, subtree: true, attributeFilter: ['data-action']})
  const subscription = {
    get closed() {
      return closed
    },
    unsubscribe() {
      closed = true
      observers.delete(doc)
      observer.disconnect()
    }
  }
  observers.set(doc, subscription)
  return subscription
}

function getAttributeSelector() {
  let selector = ''
  for (const key of attrCallbacks.keys()) {
    if (selector) selector += ','
    selector += `[${key}]`
  }
  return selector
}

function callOnAttributes(root: Element | ShadowRoot): void {
  const selector = getAttributeSelector()
  const elements = Array.from(root.querySelectorAll(selector))
  // Also bind the controller to itself
  if (root instanceof Element && root.matches(selector)) elements.push(root)
  for (const child of elements) {
    console.log(child)
    for (const [attr, initializers] of attrCallbacks) {
      if (!child.hasAttribute(attr)) continue
      for (const initializer of initializers) {
        initializer(child, child.getAttribute(attr))
      }
    }
  }
}

function callOnProps(instance: HTMLElement) {
  for (const [callback, prop] of getPropertiesToCall(Object.getPrototypeOf(instance))) {
    callback(instance, prop, (<Record<PropertyKey, unknown>>(<unknown>instance))[prop as string])
  }
}

export function* getPropertiesToCall<K extends PropertyKey = PropertyKey, V = unknown>(
  proto: Record<K, unknown>,
  initializePropertyCallback?: InitializePropertyCallback<K, V>
): Iterable<[InitializePropertyCallback<K, V>, K]> {
  while (proto && (proto as unknown) !== HTMLElement) {
    if (propCallbacks.has(proto)) {
      for (const [initializer, props] of propCallbacks.get(proto)!) {
        if (!initializePropertyCallback || initializePropertyCallback === initializer) {
          for (const prop of props) {
            yield [initializer, prop as K]
          }
        }
      }
    }
    proto = Object.getPrototypeOf(proto)
  }
}

export function defineMark<K extends PropertyKey = PropertyKey, V = unknown>(
  name: string,
  {initializePropertyCallback, elementAttributeChangedCallback, initializeClassCallback}: MarkHandlers<K, V> = {}
): (proto: Record<K, V>, key: K) => void {
  if (elementAttributeChangedCallback) {
    const attr = `data-${name}`
    if (!attrCallbacks.has(attr)) attrCallbacks.set(attr, new Set())
    attrCallbacks.get(attr)!.add(elementAttributeChangedCallback)
  }
  if (initializeClassCallback) {
    classCallbacks.add(initializeClassCallback)
  }
  return (proto: Record<K, V>, key: K): Record<K, V> => {
    if (!initializePropertyCallback) return proto
    if (!propCallbacks.has(proto)) propCallbacks.set(proto, new Map())
    const markProps = propCallbacks.get(proto)! as Map<InitializePropertyCallback<K, V>, Set<PropertyKey>>
    if (!markProps.has(initializePropertyCallback)) markProps.set(initializePropertyCallback, new Set())
    markProps.get(initializePropertyCallback)!.add(key)
    return proto
  }
}

const instances = new WeakSet<Element>()
export function initializeInstance(instance: HTMLElement, connect?: (this: HTMLElement) => void): void {
  instance.toggleAttribute('data-catalyst', true)
  instances.add(instance)
  callOnProps(instance)
  callOnAttributes(instance)
  listenForNewAttributes(instance.ownerDocument)
  connect?.call(instance)
  if (instance.shadowRoot) {
    callOnAttributes(instance.shadowRoot)
    listenForNewAttributes(instance.shadowRoot)
  }
}

export function initialized(instance: Element): boolean {
  return instances.has(instance)
}

export function initializeClass(classObj: CustomElement): void {
  for (const callback of classCallbacks) callback(classObj)
}
