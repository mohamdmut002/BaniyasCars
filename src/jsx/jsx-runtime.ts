/**
 * A tiny JSX runtime that renders straight to HTML strings at build time.
 * It replaces a framework: pages are plain functions that return HTML, written out as static files.
 */

/** Already-safe HTML. Strings passed as children are escaped; Html values are inserted as they are. */
export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value
  }
}

export type Child = Html | string | number | boolean | null | undefined | Child[]

export const raw = (html: string) => new Html(html)

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function renderChildren(children: Child): string {
  if (children == null || children === false || children === true) return ''
  if (Array.isArray(children)) return children.map(renderChildren).join('')
  if (children instanceof Html) return children.value
  return escapeHtml(String(children))
}

type Props = Record<string, unknown> & { children?: Child }
type Component = (props: any) => Html

export function Fragment(props: { children?: Child }) {
  return new Html(renderChildren(props.children))
}

export function jsx(type: string | Component, props: Props): Html {
  if (typeof type === 'function') return type(props)
  let attrs = ''
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || value == null || value === false) continue
    const name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key
    attrs += value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`
  }
  if (VOID.has(type)) return new Html(`<${type}${attrs}>`)
  return new Html(`<${type}${attrs}>${renderChildren(props.children)}</${type}>`)
}

export const jsxs = jsx
export const jsxDEV = jsx

export namespace JSX {
  export type Element = Html
  export interface IntrinsicElements {
    [tag: string]: Record<string, unknown>
  }
  export interface ElementChildrenAttribute {
    children: {}
  }
}
