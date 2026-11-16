import { useCallback, useState } from 'react'

/* Where the person was, kept for this browser tab: the filters of each list page and the scroll offset of each
 * address. Coming back from a code lands on the same list, filtered and scrolled as it was left.
 * sessionStorage is used when the browser allows it; otherwise the values live in memory until the tab reloads. */
const mem: Record<string, string> = {}
function read<T>(k: string): T | null {
  try { const v = sessionStorage.getItem(k) ?? mem[k]; return v ? JSON.parse(v) as T : null } catch { try { return mem[k] ? JSON.parse(mem[k]) as T : null } catch { return null } }
}
function write(k: string, v: unknown) { const s = JSON.stringify(v); mem[k] = s; try { sessionStorage.setItem(k, s) } catch { /* private mode: memory only */ } }
const query = () => location.hash.split('?')[1] || ''
const clean = <T,>(o?: Partial<T>): Partial<T> => { const r: Partial<T> = {}; if (o) for (const k of Object.keys(o) as (keyof T)[]) if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; return r }

/** State of a page's filters that survives leaving the page. Values given in the address (a drill-down link) start a
 *  fresh set; returning to the same address continues with whatever the person had changed since. */
export function useViewState<T extends object>(page: string, defaults: T, fromUrl?: Partial<T>): [T, (patch: Partial<T>) => void] {
  const key = 'view:' + page
  const [v, setV] = useState<T>(() => {
    const s = read<{ src: string; v: Partial<T> }>(key); const q = query()
    const init = s && s.src === q ? { ...defaults, ...s.v } : { ...defaults, ...clean(fromUrl) }
    write(key, { src: q, v: init }); return init
  })
  const set = useCallback((patch: Partial<T>) => setV(p => { const n = { ...p, ...patch }; write(key, { src: query(), v: n }); return n }), [key])
  return [v, set]
}

type Nav = { stack: string[]; scroll: Record<string, number>; origin: string }
const NAV = 'view:nav'
const pageOf = (h: string) => h.split('?')[0].split('/')[0] || 'home'
const nav = (): Nav => read<Nav>(NAV) || { stack: [], scroll: {}, origin: '' }

/** Records a move from one address to another and returns the scroll offset the new page should open at:
 *  the remembered offset when the person is going back (or leaving a code page for the list), the top otherwise. */
export function navigate(prev: string, y: number, next: string): number {
  const n = nav(); if (!n.stack.length) n.stack.push(prev)
  n.scroll[prev] = Math.round(y)
  if (pageOf(next) === 'code' && pageOf(prev) !== 'code') n.origin = prev
  const back = n.stack[n.stack.length - 2] === next
  if (back) n.stack.pop(); else { n.stack.push(next); if (n.stack.length > 60) n.stack.splice(0, n.stack.length - 60) }
  const restore = back || (pageOf(prev) === 'code' && pageOf(next) !== 'code')
  const keys = Object.keys(n.scroll); if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete n.scroll[k]
  write(NAV, n)
  return restore ? (n.scroll[next] || 0) : 0
}
/** The page a code was opened from (address without the leading "#/"); "my" when it was opened directly. */
export function originOfCode(): string { return nav().origin || 'my' }
export const originPage = () => pageOf(originOfCode())
