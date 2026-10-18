// Pure functions the page runs as well as the server. server.ts injects their source into index.html next to the
// vocabulary, so the tests call the very code the page runs. Each must use nothing outside its own body: no imports,
// and no other function from this file.

/** Where the page is: the project and screen, the rows opened (a nested row's key follows its parent's: `S-001/S-001.2`),
 * the search, the tab, and the sorted column (`since`, or `-since` for descending). */
export type Route = { project: string; screen: string; open: string[]; q: string; tab?: string; sort?: string }

/** Fills a vocabulary template: `{name}` with `vars.name`, and `{n|story}` with the count and the noun's singular or
 * plural from `nouns`. A placeholder with no value stays as written, so a missing word shows rather than vanishing. */
export const say = (template: string, vars: Record<string, unknown> = {}, nouns: Record<string, [string, string]> = {}) =>
  String(template).replace(/\{(\w+)(?:\|([^}]+))?\}/g, (whole: string, key: string, noun?: string) => {
    const v = vars[key]
    if (v === undefined) return whole
    if (!noun) return String(v)
    const n = Number(v)
    const [one, many] = nouns[noun] ?? [noun, `${noun}s`]
    return `${n} ${n === 1 ? one : many}`
  })

/** `#/deadlight/proof/by-a-person?open=S-001,S-003&q=greet&tab=pending&sort=-since` → its parts. The group in the path
 * is for the person reading the URL; the screen alone decides. No screen (or, given `screens`, one that isn't among
 * them) is Needs you. */
export const parseRoute = (hash: string, screens?: string[]): Route => {
  const [path = '', query = ''] = String(hash || '').replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map((p: string) => decodeURIComponent(p))
  const params = new URLSearchParams(query)
  const named = parts.length > 1 ? parts[parts.length - 1]! : 'needs-you'
  const tab = params.get('tab'), sort = params.get('sort')
  return {
    project: parts[0] ?? '',
    screen: screens && !screens.includes(named) ? 'needs-you' : named,
    open: (params.get('open') ?? '').split(',').filter(Boolean),
    q: params.get('q') ?? '',
    ...(tab && { tab }),
    ...(sort && { sort }),
  }
}

/** The URL hash for a route: the project, the screen's group (when it has one), the screen, then what is open, the
 * search, the tab and the sort. A project's name may hold a slash (`team/gamma`), so it is encoded as one part. */
export const formatRoute = (route: Partial<Route> & { project: string }, group?: string) => {
  const screen = route.screen || 'needs-you'
  const params = new URLSearchParams()
  if (route.open?.length) params.set('open', route.open.join(','))
  if (route.q) params.set('q', route.q)
  if (route.tab) params.set('tab', route.tab)
  if (route.sort) params.set('sort', route.sort)
  const query = params.toString().replace(/%2C/g, ',').replace(/%2F/g, '/')
  return `#/${encodeURIComponent(route.project)}/${group && screen !== 'needs-you' ? `${group}/` : ''}${screen}${query ? `?${query}` : ''}`
}
