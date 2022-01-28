import type {CustomElement} from './custom-element.js'
import {defineMark, getPropertiesToCall} from './mark.js'

type attrValue = string | number | boolean

/**
 * Attr is a decorator which tags a property as one to be initialized via
 * `initializeAttrs`.
 *
 * The signature is typed such that the property must be one of a String,
 * Number or Boolean. This matches the behavior of `initializeAttrs`.
 */
export const attr = defineMark<string, attrValue>('attr', {
  initializePropertyCallback: initializeAttr,
  initializeClassCallback: defineObservedAttributes
})

/**
 * initializeAttr is called with a class property name. With this
 * name it defines a property descriptor that maps to the `data-[name]`
 * attribute on the HTMLElement instance.
 *
 * If a class property is assigned to the class body, it will infer the type
 * (using `typeof`) and define an appropriate getter/setter combo that aligns
 * to that type. This means class properties assigned to Numbers can only ever
 * be Numbers, assigned to Booleans can only ever be Booleans, and assigned to
 * Strings can only ever be Strings.
 *
 * This is automatically called as part of `@controller`. If a class uses the
 * `@controller` decorator it should not call this manually.
 */
export function initializeAttr(instance: HTMLElement, key: PropertyKey, value: attrValue): void {
  const name = attrToAttributeName(String(key))
  let descriptor: PropertyDescriptor = {
    get(this: HTMLElement): string {
      return this.getAttribute(name) || ''
    },
    set(this: HTMLElement, newValue: string) {
      this.setAttribute(name, newValue || '')
    }
  }
  if (typeof value === 'number') {
    descriptor = {
      get(this: HTMLElement): number {
        return Number(this.getAttribute(name) || 0)
      },
      set(this: HTMLElement, newValue: string) {
        this.setAttribute(name, newValue)
      }
    }
  } else if (typeof value === 'boolean') {
    descriptor = {
      get(this: HTMLElement): boolean {
        return this.hasAttribute(name)
      },
      set(this: HTMLElement, newValue: boolean) {
        this.toggleAttribute(name, newValue)
      }
    }
  }
  Object.defineProperty(instance, key, descriptor)
  if (key in instance && !instance.hasAttribute(name)) {
    descriptor.set!.call(instance, value)
  }
}

function attrToAttributeName(name: string): string {
  return `data-${name.replace(/([A-Z]($|[a-z]))/g, '-$1')}`.replace(/--/g, '-').toLowerCase()
}

export function defineObservedAttributes(classObject: CustomElement, additional?: string[]): void {
  let observed = classObject.observedAttributes || []
  Object.defineProperty(classObject, 'observedAttributes', {
    get() {
      const attrs = []
      for (const entry of getPropertiesToCall(classObject.prototype, initializeAttr)) {
        attrs.push(attrToAttributeName(String(entry[1])))
      }
      if (additional) {
        attrs.push(...attrs.map(attrToAttributeName))
      }
      return [...attrs, ...observed]
    },
    set(attributes: string[]) {
      observed = attributes
    }
  })
}

/**
 * @deprecated
 *
 * `initializeAttr` should be used instead, which needs to be called for each `name`.
 */
export function initializeAttrs(instance: HTMLElement, names?: Iterable<string>): void {
  if (!names) {
    for (const [init, key] of getPropertiesToCall(Object.getPrototypeOf(instance), initializeAttr)) {
      init(instance, key, (<Record<PropertyKey, attrValue>>(<unknown>instance))[key as string])
    }
  } else {
    for (const key of names) {
      initializeAttr(instance, key, (<Record<PropertyKey, attrValue>>(<unknown>instance))[key])
    }
  }
}
