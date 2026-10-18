// The one grid story-spec ui draws every screen with (screens.ts defines the screens). It searches, sorts by a column,
// filters by tab, opens a row in place (a nested grid is this grid again, with the row as its scope), hides the columns
// a person hides, and returns the markup. Like route.ts, server.ts writes its source into the page, so the tests call
// the very code the page runs: it must use nothing outside its own body, and is handed the vocabulary and say().
import type { Action, RecordView, Why } from './view.js'
import type { Column, Grid, GridRow, Part, ScreenDefinition } from './screens.js'
import type { Vocabulary } from './vocabulary.js'

/** What a screen is showing: the rows opened, the search, the tab and the sort, as the route holds them. */
export type GridView = { open: string[]; q: string; tab?: string; sort?: string }
/** A row as shown: its key in the view (scoped by its parents'), whether it is open, and, under a search, its matching
 * children; `fixed` rows are shown open, with no fold. */
export type Shown = { row: GridRow; key: string; open: boolean; kids?: Record<string, Shown[]>; fixed?: boolean }
type Say = (template: string, vars?: Record<string, unknown>, nouns?: Record<string, [string, string]>) => string
/** Somewhere to keep the hidden columns: the browser's localStorage, or anything with the same two methods. */
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void }

export const gridComponent = (V: Vocabulary, say: Say) => {
  const t = (template: string, vars: Record<string, unknown> = {}) => say(template, vars, V.nouns)
  const esc = (x: unknown) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!)
  const code = (html: string) => html.replace(/`([^`]+)`/g, '<code>$1</code>')
  const LONG = 60

  // ---------- which rows a view shows ----------
  const hit = (row: GridRow, q: string) => Object.values(row.cells).some((c) => String(c ?? '').toLowerCase().includes(q))
  /** Rows under a search: a row whose children match shows open at the matches; a row that matches itself shows as it
   * was; the rest hide. With no search, every row shows, open if the view says so. */
  const fold = (rows: GridRow[], view: GridView, scope: string): Shown[] => {
    const q = String(view.q ?? '').trim().toLowerCase()
    const out: Shown[] = []
    for (const row of rows) {
      const key = scope ? `${scope}/${row.key}` : row.key
      const open = view.open.includes(key)
      if (!q) { out.push({ row, key, open }); continue }
      const kids: Record<string, Shown[]> = {}
      let found = false
      for (const [source, list] of Object.entries(row.children ?? {})) { kids[source] = fold(list, view, key); if (kids[source]!.length) found = true }
      if (found) out.push({ row, key, open: true, kids })
      else if (hit(row, q)) out.push({ row, key, open })
    }
    return out
  }
  const sortOf = (def: ScreenDefinition, view: GridView) => {
    const s = String(view.sort ?? ''), key = s.replace(/^-/, '')
    return def.columns.some((c) => c.key === key && c.sort) ? { key, desc: s.startsWith('-') } : null
  }
  /** What a screen shows: its rows after the search, the tab and the sort; each tab with its count under the search;
   * and how many rows that is of all of them. */
  const view = (def: ScreenDefinition, grid: Grid, v: GridView) => {
    const searched = fold(grid.rows, v, '')
    const of = (kinds: string[]) => searched.filter((s) => !kinds.length || kinds.includes(s.row.kind))
    const tab = def.tabs.find((x) => x.key === v.tab) ?? def.tabs[0]!
    let rows = of(tab.kinds)
    const by = sortOf(def, v)
    if (by) {
      const cell = (s: Shown) => String(s.row.cells[by.key as keyof GridRow['cells']] ?? '')
      rows = [...rows].sort((a, b) => {
        const x = cell(a), y = cell(b)
        if (!x || !y) return x ? -1 : y ? 1 : 0
        const c = x.localeCompare(y, 'en', { numeric: true })
        return by.desc ? -c : c
      })
    }
    return {
      rows, count: rows.length, total: grid.rows.length, sort: by, tab: tab.key,
      tabs: def.tabs.map((x) => ({ key: x.key, label: x.label, count: of(x.kinds).length, selected: x === tab })),
    }
  }

  // ---------- the columns a person hides, per screen ----------
  const storeKey = (screen: string) => `story-spec-ui-columns:${screen}`
  const hidden = (store: Store | null | undefined, screen: string): string[] => {
    try { const v = JSON.parse(store?.getItem(storeKey(screen)) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [] } catch { return [] }
  }
  const toggle = (store: Store | null | undefined, screen: string, key: string) => {
    const was = hidden(store, screen), next = was.includes(key) ? was.filter((x) => x !== key) : [...was, key]
    try { store?.setItem(storeKey(screen), JSON.stringify(next)) } catch { /* private mode: the choice lasts until reload */ }
    return next
  }

  // ---------- pieces ----------
  const actionHtml = (a: Action | undefined, primary = false) => !a ? '' : a.op
    ? `<button class="btn sm ${primary ? 'warn' : ''}" data-op="${esc(a.op)}" data-target="${esc(a.target ?? '')}">${esc(a.label)}</button>`
    : `<span class="hint">${esc(a.label)}</span>`
  const detailsHtml = (d?: string) => d ? `<details class="dl"><summary>${esc(V.details)}</summary><span>${esc(d)}</span></details>` : ''
  const stateKey = (word: string) => (Object.entries(V.states).find(([, s]) => s.word === word) ?? [''])[0]
  const steps = (lines: string[]) => lines.length
    ? `<div class="lines">${lines.map((l) => { const m = l.match(/^(GIVEN|WHEN|THEN|AND|BUT)\s+(.*)$/); return `<div><span class="kw">${m ? m[1] : ''}</span><span>${code(esc(m ? m[2] : l))}</span></div>` }).join('')}</div>`
    : `<span class="dim">${esc(V.page.noSteps)}</span>`
  const thenNow = (w: { then?: string; now?: string }) => w.then || w.now
    ? `<div class="thennow">${w.then ? `<div><h3>${esc(V.why.then)}</h3><pre>${esc(w.then)}</pre></div>` : ''}<div><h3>${esc(V.why.now)}</h3><pre>${esc(w.now)}</pre></div></div>` : ''
  const same = (a?: Action, b?: Action) => !!a && !!b && a.op === b.op && a.target === b.target
  /** The why of a state: its sentence, the items still to go (a grid of its own), a note, the text then and now, and
   * the action that would change it, unless the row's action column already offers it. */
  const why = (w: Why, row?: GridRow): string => {
    const items: Shown[] = w.items.map((i, n) => ({ row: { key: String(n), kind: '', cells: { what: i.title, state: i.word }, ...(i.action && { action: i.action }) }, key: '', open: false }))
    const cols: Column[] = (['what', 'state', 'action'] as const).map((key) => ({ key, label: V.columns[key], sort: false }))
    return `<div class="why"><p>${esc(w.sentence)}</p>${items.length ? table(cols, items, [], 1, null, []) : ''}${w.note ? `<span>${esc(w.note)}</span>` : ''}${thenNow(w)}${w.action && !same(w.action, row?.action) ? `<div>${actionHtml(w.action, true)}</div>` : ''}</div>`
  }
  const requirement = (text: string) => code(esc(text)).replace(/^WHEN/, '<b>WHEN</b>').replace(/THE SYSTEM SHALL/, '<br><b>THE SYSTEM SHALL</b>')

  // Lays a record's states out in columns by distance from where records start; a transition back bends below.
  const lifecycle = (r: RecordView) => {
    const W = 150, H = 44, GX = 110, GY = 46, PAD = 30
    const short = (x: string) => x.length > 26 ? `${x.slice(0, 25)}…` : x
    const of = (name: string) => r.states.find((s) => s.name === name)!
    const back = new Set<string>(), seen = new Set<string>(), onPath = new Set<string>()
    const visit = (s: string) => { seen.add(s); onPath.add(s); for (const [f, x] of r.transitions) if (f === s) { if (onPath.has(x)) back.add(`${f}>${x}`); else if (!seen.has(x)) visit(x) } onPath.delete(s) }
    for (const s of [...r.states.filter((x) => x.start).map((x) => x.name), ...r.states.map((x) => x.name)]) if (!seen.has(s)) visit(s)
    const forward = r.transitions.filter(([f, x]) => !back.has(`${f}>${x}`))
    const depth = new Map<string, number>()
    const depthOf = (s: string): number => { if (!depth.has(s)) { depth.set(s, 0); depth.set(s, Math.max(0, ...forward.filter(([, x]) => x === s).map(([f]) => depthOf(f) + 1))) } return depth.get(s)! }
    for (const st of r.states) depthOf(st.name)
    const cols = new Map<number, string[]>()
    for (const st of r.states) { const d = depth.get(st.name)!; cols.set(d, [...(cols.get(d) ?? []), st.name]) }
    const pos = new Map<string, [number, number]>()
    for (const [d, names] of cols) names.forEach((n, i) => pos.set(n, [PAD + d * (W + GX), PAD + 18 + 34 + i * (H + GY)]))
    const maxRows = Math.max(...[...cols.values()].map((c) => c.length))
    const width = PAD * 2 + cols.size * W + (cols.size - 1) * GX
    const height = PAD * 2 + 18 + 34 + maxRows * H + (maxRows - 1) * GY + 44
    const edges = r.transitions.map(([f, x]) => {
      const [x1, y1] = pos.get(f)!, [x2, y2] = pos.get(x)!
      const by = of(x).movedBy, gap = !by.length
      let d: string, lx: number, ly: number
      if (depth.get(x)! - depth.get(f)! > 1) { const sx = x1 + W / 2 + 12, sy = y1, ex = x2 + W / 2 - 12, ey = y2, top = Math.min(sy, ey) - 30; d = `M ${sx} ${sy} C ${sx} ${top}, ${ex} ${top}, ${ex} ${ey - 2}`; lx = (sx + ex) / 2; ly = top + 2 }
      else if (depth.get(x)! > depth.get(f)!) { const sx = x1 + W, sy = y1 + H / 2, ex = x2, ey = y2 + H / 2; d = `M ${sx} ${sy} C ${sx + GX / 2} ${sy}, ${ex - GX / 2} ${ey}, ${ex - 2} ${ey}`; lx = (sx + ex) / 2; ly = (sy + ey) / 2 - 8 }
      else { const sx = x1 + W / 2, sy = y1 + H, ex = x2 + W / 2 + 12, ey = y2 + H, low = Math.max(sy, ey) + 34; d = `M ${sx} ${sy} C ${sx} ${low}, ${ex} ${low}, ${ex} ${ey + 2}`; lx = (sx + ex) / 2; ly = low - 4 }
      const text = gap ? `✗ ${V.records.noStory}` : by.map(short).join(' · ')
      const w = text.length * 6.2 + 10
      return `<g class="edge ${gap ? 'gap' : ''}"><path d="${d}" marker-end="url(#${gap ? 'arrBad' : 'arr'})"/><rect class="bg" x="${lx - w / 2}" y="${ly - 11}" width="${w}" height="16" rx="3"/><text x="${lx}" y="${ly + 1}" text-anchor="middle">${esc(text)}</text></g>`
    }).join('')
    const nodes = r.states.map((st) => {
      const [x, y] = pos.get(st.name)!
      const created = st.createdBy.map(short)
      return `<g class="node ${st.start ? 'start' : ''} ${st.quiet ? 'end' : ''}"><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8"/><text x="${x + W / 2}" y="${y + 27}" text-anchor="middle">${esc(st.name)}</text>${st.quiet ? `<text class="note" x="${x + W / 2}" y="${y + H + 15}" text-anchor="middle">⚠ ${esc(V.records.startsNothing)}</text>` : ''}${st.start ? `<text class="note" style="fill:var(--fg-dim)" x="${x + W / 2}" y="${y - 8}" text-anchor="middle">${esc(V.records.start)}${created.length ? ` · ${esc(t(V.records.createdBy, { stories: created.join(', ') }))}` : ''}</text>` : ''}</g>`
    }).join('')
    return `<div class="model"><svg viewBox="0 0 ${width} ${height}" style="max-width:${width}px" role="img" aria-label="${esc(r.name)}"><defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--fg-dim)"/></marker>
      <marker id="arrBad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--bad)"/></marker></defs>${edges}${nodes}</svg></div>`
  }

  // ---------- the grid ----------
  /** Whether opening the row shows anything: a part with something in it, its full title, or its details line. */
  const opens = (row: GridRow, parts: Part[], first: string) => !!row.details || String(row.cells[first as keyof GridRow['cells']] ?? '').length > LONG || parts.some((p) =>
    p.part === 'text' ? !!row.text : p.part === 'why' ? !!row.state : p.part === 'requirement' ? row.requirement !== undefined : p.part === 'steps' ? !!row.steps
      : p.part === 'prose' ? !!row.html : p.part === 'lifecycle' ? !!row.record : !!row.children?.[p.source])
  const cell = (s: Shown, c: Column, i: number, can: boolean) => {
    const { row, key, open } = s
    const text = row.cells[c.key] ?? ''
    if (i === 0) {
      const fold = can && !s.fixed ? `<button class="fold" data-fold="${esc(key)}" aria-expanded="${open}" aria-label="${esc(text)}">${open ? '▾' : '▸'}</button>` : '<span class="fold"></span>'
      return `<td class="c-first"><div class="cell">${fold}<span class="title" title="${esc(text)}">${esc(text)}</span></div></td>`
    }
    // The state cell opens the row, where its why is; hovering it says the why's sentence.
    if (c.key === 'state') return `<td class="c-state">${row.state
      ? `<button class="state ${esc(row.state.key)}" ${s.fixed ? '' : `data-fold="${esc(key)}"`} aria-expanded="${open}" title="${esc(row.state.why.sentence)}">${esc(row.state.word)}</button>`
      : text ? `<span class="state ${esc(stateKey(text))}">${esc(text)}</span>` : ''}</td>`
    if (c.key === 'action') return `<td class="c-action">${actionHtml(row.action, true)}</td>`
    return `<td class="c-${esc(c.key)}"><span class="clip" title="${esc(text)}">${esc(text)}</span></td>`
  }
  const expansion = (s: Shown, parts: Part[], first: string, depth: number, v: GridView): string => {
    const { row, key } = s
    const title = String(row.cells[first as keyof GridRow['cells']] ?? '')
    const body = parts.map((p): string => {
      if (p.part === 'text') return row.text ? `<p class="text">${code(esc(row.text))}</p>` : ''
      if (p.part === 'why') return row.state ? why(row.state.why, row) : ''
      if (p.part === 'requirement') return row.requirement === undefined ? '' : `<h3>${esc(p.label)}</h3><div class="req">${requirement(row.requirement) || esc(V.page.noRequirement)}</div>`
      if (p.part === 'steps') return row.steps ? `${steps(row.steps)}${row.edit ? `<div><button class="btn sm ghost" data-edit="${esc(row.edit)}">${esc(V.page.edit)}</button></div>` : ''}` : ''
      if (p.part === 'prose') return row.html ? `<div class="prose">${row.html}</div>` : ''
      if (p.part === 'lifecycle') return row.record ? lifecycle(row.record) : ''
      const list = row.children?.[p.source]
      if (!list) return ''
      if (s.kids) return s.kids[p.source]?.length ? nested(p, s.kids[p.source]!, row, depth + 1, v) : ''
      return nested(p, fold(list, { ...v, q: '' }, key), row, depth + 1, v)
    }).join('')
    return `${title.length > LONG ? `<p class="full">${esc(title)}</p>` : ''}${body}${detailsHtml(row.details)}`
  }
  const rowHtml = (s: Shown, cols: Column[], parts: Part[], depth: number, v: GridView): string => {
    const can = opens(s.row, parts, cols[0]!.key), open = s.open && can
    return `<tr class="${open ? 'open' : ''}">${cols.map((c, i) => cell(s, c, i, can)).join('')}</tr>`
      + (open ? `<tr class="exp"><td colspan="${cols.length}" style="--depth:${depth + 1}"><div class="nest">${expansion(s, parts, cols[0]!.key, depth, v)}</div></td></tr>` : '')
  }
  function table(columns: Column[], shown: Shown[], parts: Part[], depth: number, by: { key: string; desc: boolean } | null, hide: string[], v: GridView = { open: [], q: '' }): string {
    const cols = columns.filter((c, i) => i === 0 || !hide.includes(c.key))
    const head = cols.map((c) => {
      if (!c.sort || depth) return `<th class="c-${esc(c.key)}">${esc(c.label)}</th>`
      const on = by?.key === c.key
      return `<th class="c-${esc(c.key)}" aria-sort="${on ? (by!.desc ? 'descending' : 'ascending') : 'none'}"><button data-sort="${esc(c.key)}">${esc(c.label)}<span class="arrow">${on ? (by!.desc ? '↓' : '↑') : ''}</span></button></th>`
    }).join('')
    return `<table class="grid" data-depth="${depth}"><thead><tr>${head}</tr></thead><tbody>${shown.map((s) => rowHtml(s, cols, parts, depth, v)).join('')}</tbody></table>`
  }
  /** A nested grid: the same grid with the parent row as its scope, titled, counted, with its own action. */
  function nested(p: Extract<Part, { part: 'grid' }>, shown: Shown[], parent: GridRow, depth: number, v: GridView): string {
    return `<section class="sub"><div class="sub-head"><h3>${esc(p.title)} <span class="n">${shown.length}</span></h3>${p.action ? actionHtml({ ...p.action, target: parent.key }) : ''}</div>`
      + (shown.length ? table(p.columns, shown, p.expand, depth, null, [], v) : `<div class="none">${esc(parent.empty?.[p.source] ?? V.grid.none)}</div>`) + '</section>'
  }
  /** A list outside a screen (a form's), drawn by the same grid, every row open. */
  const list = (p: Extract<Part, { part: 'grid' }>, rows: GridRow[]) => nested(p, rows.map((row) => ({ row, key: row.key, open: true, fixed: true })), { key: '', kind: '', cells: {} }, 0, { open: [], q: '' })

  /** A screen: its header (title, question and the screen's one primary action), anything the page puts above the grid
   * (`lead`), the search, the count, the tabs and the columns, then the rows. */
  const html = (def: ScreenDefinition, grid: Grid, v: GridView, hide: string[] = [], opts: { lead?: string; columnsOpen?: boolean } = {}) => {
    const r = view(def, grid, v)
    const head = `<div class="screen-head"><div><h1>${esc(def.title)}</h1>${def.question ? `<p class="intro">${esc(def.question)}</p>` : ''}</div>${grid.action ? actionHtml(grid.action, true) : ''}</div>`
    const tools = `<div class="tools"><label class="search"><span class="dim" aria-hidden="true">⌕</span><input id="q" placeholder="${esc(V.grid.search)}" aria-label="${esc(V.grid.search)}" autocomplete="off" value="${esc(v.q)}"><span class="kbd">/</span></label>`
      + `<div class="tabs" role="group">${r.tabs.map((x) => `<button class="tab" data-tab="${esc(x.key)}" aria-pressed="${x.selected}" ${x.count ? '' : 'disabled'}>${esc(x.label)} <span class="n">${x.count}</span></button>`).join('')}</div>`
      + `<span class="count">${esc(t(V.grid.count, { shown: r.count, n: r.total }))}</span>`
      + `<details class="cols" ${opts.columnsOpen ? 'open' : ''}><summary>${esc(V.grid.columns)}</summary><div class="menu">${def.columns.slice(1).map((c) => `<label><input type="checkbox" data-col="${esc(c.key)}" ${hide.includes(c.key) ? '' : 'checked'}> ${esc(c.label)}</label>`).join('')}</div></details></div>`
    const body = !grid.rows.length ? `<div class="empty">${esc(grid.empty)}</div>`
      : !r.rows.length ? `<div class="empty">${esc(v.q.trim() ? t(V.grid.noMatch, { q: v.q.trim() }) : V.grid.none)}</div>`
      : table(def.columns, r.rows, def.expand, 0, r.sort, hide, v)
    return `<section class="screen" data-screen="${esc(def.id)}">${head}${opts.lead ?? ''}${tools}${body}${grid.note ? `<span class="hint">${esc(grid.note)}</span>` : ''}</section>`
  }

  return { view, html, list, why, steps, thenNow, columns: { hidden, toggle } }
}
