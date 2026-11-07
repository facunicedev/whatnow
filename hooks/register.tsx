import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Sitio, Dict, Limite, Paralela, Agente, Abierta } from '../types'

const DEFAULT_LIMIT = 150_000 // 150k of context = 100%, change with /whatnow limit <n>k
const PROGRESS = 'PROGRESS.md' // at the project root (folder where claude was started)
const HANDOFF = '.claude/HANDOFF.md'
const P = 'whatnow'

// Project root, fixed when the session opens: if the working folder changes (a cd), PROGRESS and handoff are not lost.
let root = ''
let live: string[] = [] // marks of the sessions open now; empty = not every one could be read, so nothing may be deleted
let me = '' // this session's id once found (see findMe); '' until then
// A session started with claude -w works in .claude/worktrees/<name>, but PROGRESS.md is one for the whole project: it lives in the main folder.
const mainOf = (p: string) => p.replace(/[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/, '')
const at = (f: string) => (root ? `${f === PROGRESS ? mainOf(root) : root}/${f}` : f)

const tokens = atom({ plugin: 'whatnow', key: 'tokens' } as const, 0, { shape: 'tokens-1' })
const progress = atom({ plugin: 'whatnow', key: 'progress' } as const, '', { shape: 'progress-1' })
const hidden = atom({ plugin: 'whatnow', key: 'hidden' } as const, false, { shape: 'hidden-1' })
const sitio = atom({ plugin: 'whatnow', key: 'sitio' } as const, 'banda' as Sitio, { shape: 'sitio-1' })
const limit = atom({ plugin: 'whatnow', key: 'limit' } as const, DEFAULT_LIMIT, { shape: 'limit-1' })
const limits = atom({ plugin: 'whatnow', key: 'limits' } as const, [] as Limite[], { shape: 'limits-1' })
const parallels = atom({ plugin: 'whatnow', key: 'parallels' } as const, [] as Paralela[], { shape: 'parallels-1' })
const agents = atom({ plugin: 'whatnow', key: 'agents' } as const, [] as Agente[], { shape: 'agents-1' })
const peers = atom({ plugin: 'whatnow', key: 'peers' } as const, [] as Abierta[], { shape: 'peers-1' })
const strings = atom({ plugin: 'whatnow', key: 'strings' } as const, {} as Dict, { shape: 'strings-1' })

// Words in every built-in language, so a PROGRESS.md written in one language still reads after switching.
const SESSION_HEADINGS = ['This session', 'Esta sesión']
const STATUS_LABELS = ['Status:', 'Estado:']
const TASK_LABELS = ['Task:', 'Tarea:']

const fill = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, n) => String(v[n] ?? ''))
const t = (d: Dict, k: string, v?: Record<string, string | number>) => fill(d[k] ?? k, v)

// --- language: lang/<code>.json in the mod folder; en is the base, a missing key falls back to it ---
const codeOf = (s: string) => {
  const x = s.trim().toLowerCase()
  if (/^(es|spanish|español|castellano)/.test(x)) return 'es'
  if (/^(en|english|inglés)/.test(x)) return 'en'
  return x.split(/[-_ ]/)[0] || 'en'
}
async function detect($: EngineInterface) {
  const set = await $.settings.read({ key: 'language' }).catch(() => undefined) // Claude Code's own language setting
  if (typeof set === 'string' && set.trim()) return codeOf(set)
  return codeOf(Intl.DateTimeFormat().resolvedOptions().locale || 'en') // then the system's
}
async function getLang($: EngineInterface, code: string) {
  try { return JSON.parse(await $.fs.read(`${$.plugin.root}/lang/${code}.json`)) as Dict } catch { return undefined }
}
// Loads the saved preference ('auto' by default) and returns { code, found }.
async function loadLang($: EngineInterface, pref?: string) {
  const want = pref ?? (await $.store.get('lang')) ?? 'auto'
  const code = want === 'auto' ? await detect($) : String(want)
  const base = (await getLang($, 'en')) ?? {}
  const own = code === 'en' ? base : await getLang($, code)
  await update($, strings, () => ({ ...base, ...(own ?? {}) }))
  return { want: String(want), code, found: !!own }
}
async function registerCommand($: EngineInterface) {
  const s = await read($, strings)
  await $.command.register({ name: P, description: t(s, 'cmdDescription'), argumentHint: t(s, 'cmdHint') })
}

// Rewrites PROGRESS.md in the chosen language with one direct model call (no conversation turn).
// ponytail: haiku, one shot; the file is only written if the checkbox lines survive intact.
async function translateProgress($: EngineInterface, code: string, s: Dict) {
  const md = await $.fs.read(at(PROGRESS)).catch(() => '')
  if (typeof md !== 'string' || !md.trim()) return
  const boxes = (x: string) => (x.match(/^\s*- \[[ xX]\] /gm) ?? []).length
  let name = code
  try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code } catch { /* keep the code */ }
  $.ui.toast(t(s, 'translating', { lang: name }))
  const r = await $.model.complete({
    model: 'haiku',
    effort: 'low',
    maxTokens: 4000,
    timeoutMs: 60_000,
    prompt: `Translate this Markdown file into ${name}. Keep the structure exactly: heading levels, every "- [ ]" and "- [x]" line, blank lines, code, file names and paths. The heading that means "this session" must read exactly "${s.sessionHeading}", the line label that means "status" must read exactly "${s.statusLabel}" and the line label that means "task" must read exactly "${s.taskLabel}". Reply with the translated file only, no comments, no code fence.\n\n${md}`,
  })
  const out = r.isAnswered ? r.text.replace(/^```\w*\n|\n```\s*$/g, '').trim() : ''
  if (!out || boxes(out) !== boxes(md)) return void $.ui.toast(t(s, 'translateFail'))
  await $.fs.write(at(PROGRESS), out + '\n')
  await update($, progress, () => out)
  $.ui.toast(t(s, 'translated'))
}

// After each main-loop turn: haiku writes ITS OWN section "## Haiku [mark]" in PROGRESS.md, and only about this session (task line, steps it thinks are done, new steps). No conversation turn.
// It never touches the rest of the file; the panel counts its ticks and new steps in the SESSION bar. The project part is updated only by the session's model at the handoff, which also merges (or drops) what haiku left and deletes the section.
// ponytail: only runs on the main loop, one at a time; only lines of the expected shapes are kept, a tick must copy an existing step exactly.
let syncing = false
let recent: string[] = [] // the last answers of this conversation, oldest first: a task finished two turns ago still gets ticked
const HAIKU_HEAD = 'Haiku'
const sectionRe = (heads: string) => new RegExp(`^#{2,}[ \\t]*(?:${heads})[^\\n]*\\n?([\\s\\S]*?)(?=^#{1,6}[ \\t]|$(?![\\s\\S]))`, 'gim')
const ownHaiku = (md: string) => [...md.matchAll(sectionRe(HAIKU_HEAD))].find(m => m[0].split('\n')[0].includes(`[${mark}]`))
async function syncProgress($: EngineInterface, answer: string) {
  if (syncing || !answer.trim()) return
  recent = [...recent, answer.slice(0, 3000)].slice(-4)
  syncing = true
  try {
    const md = await $.fs.read(at(PROGRESS)).catch(() => '')
    if (typeof md !== 'string' || !md.trim()) return
    const s = await read($, strings)
    const task = s.taskLabel ?? 'Task:'
    const tasks = (x: string) => [...x.matchAll(/^\s*- \[[ xX]\] (.+)$/gm)].map(y => y[1].trim())
    const mine = ownHaiku(md)
    const heads = [...SESSION_HEADINGS, s.sessionHeading].filter(Boolean).join('|')
    const secs = [...md.matchAll(sectionRe(heads))]
    const sec = secs.find(m => m[0].split('\n')[0].includes(`[${mark}]`)) ?? secs.find(m => !/\[whatnow-/.test(m[0].split('\n')[0]))
    const steps = new Set(sec ? tasks(sec[1]) : []) // the steps of this session's own list
    const before = new Set(mine ? tasks(mine[1]) : []) // steps haiku itself proposed earlier
    const r = await $.model.complete({
      model: 'haiku', effort: 'low', maxTokens: 1500, timeoutMs: 60_000,
      prompt: `Below is a PROGRESS.md, your previous notes (may be empty) and the assistant's recent messages of the work session (oldest first, the last one is the newest). Write your notes for the file, true now. Reply with ONLY these lines, no headings, no comments, no code fence:
1. "${task} " plus one sentence with what this session is doing now.
2. One line "- [x] <text>" for each step of this session's list (the section "## ${s.sessionHeading ?? 'This session'} [${mark}]") that the messages show is done, or that a later message replaced or cancelled. Copy the step text EXACTLY. Keep the ones of your previous notes that are still true.
3. One line "- [ ] <text>" for a new step of this session only if something is still missing that no existing step covers: read the existing steps first and never repeat one in other words.
Ignore the project list: it is not yours.
Tick only when the messages really say so; if unsure, leave it out. Write in the language of the file.

--- PROGRESS.md ---
${md}

--- YOUR PREVIOUS NOTES ---
${mine ? mine[1].trim() : ''}

--- RECENT MESSAGES ---
${recent.map((m, i) => `[${i + 1}] ${m}`).join('\n\n')}`,
    })
    const out = r.isAnswered ? r.text.replace(/^```\w*\n|\n```\s*$/g, '').trim() : ''
    const startsWith = (l: string, labels: string[]) => labels.some(x => l.toLowerCase().startsWith(x.toLowerCase()))
    const seen = new Set<string>()
    const lines = out.split('\n').map(l => l.trim()).filter(l => {
      const m = l.match(/^- \[([ xX])\] (.+)$/)
      if (m) return !seen.has(m[2].trim()) && !!seen.add(m[2].trim()) && (m[1] === ' ' ? !steps.has(m[2].trim()) : steps.has(m[2].trim()) || before.has(m[2].trim()))
      return startsWith(l, [...TASK_LABELS, task]) && !seen.has(l.slice(0, 4).toLowerCase()) && !!seen.add(l.slice(0, 4).toLowerCase())
    }).slice(0, 60)
    if (!lines.length) return
    const section = `## ${HAIKU_HEAD} [${mark}]\n${lines.join('\n')}\n`
    const now = await $.fs.read(at(PROGRESS)).catch(() => '') // read again right before writing: only this section is replaced
    if (typeof now !== 'string' || !now.trim()) return
    const old = ownHaiku(now)
    const next = old ? now.replace(old[0], () => section) : `${now.replace(/\s*$/, '')}\n\n${section}`
    if (next === now) return
    await $.fs.write(at(PROGRESS), next)
    await refresh($)
  } catch { /* a failed sync just leaves the file as it was */ } finally { syncing = false }
}

// session.measure only fires when a window moves a whole point, so ask for the usage figures directly too.
async function refreshLimits($: EngineInterface) {
  try {
    const u = await $.session.usage()
    if (u.rateLimits?.length) await update($, limits, () => u.rateLimits)
  } catch { /* no usage figures yet */ }
}
const handoffPrompt = (s: Dict, why: string) => t(s, 'handoffPrompt', { why, handoff: at(HANDOFF), progress: at(PROGRESS), mark, live: live.join(', ') })
const openPane = ($: EngineInterface, s: Dict) => $.ui.open({ id: P, title: t(s, 'paneTitle') })

// Each session writes its own section "## This session [whatnow-xxxx]" and haiku its own "## Haiku [whatnow-xxxx]"; everything outside those sections is the project.
// The panel counts what haiku ticked (an existing step copied exactly) and the new steps it proposes in the SESSION list only; the project part is the model's.
// Reads one PROGRESS.md: project part, the section of the session with this key, status and the one-sentence task.
// ponytail: a legacy section with no mark is shown to every session until the model rewrites it with one.
function parse(md: string, s: Dict, key = '') {
  const alts = (k: string, known: string[]) => [...new Set([...known, s[k]].filter(Boolean))]
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const label = (text: string, labels: string[]) =>
    labels.map(l => text.split('\n').find(x => x.toLowerCase().startsWith(l.toLowerCase()))?.slice(l.length).trim()).find(Boolean) ?? ''
  const head = (m: RegExpMatchArray) => m[0].split('\n')[0]
  const all = [...md.matchAll(sectionRe(alts('sessionHeading', SESSION_HEADINGS).map(esc).join('|')))]
  const hk = [...md.matchAll(sectionRe(HAIKU_HEAD))]
  const sec = all.find(m => !!key && head(m).includes(`[${key}]`)) ?? all.find(m => !/\[whatnow-/.test(head(m)))
  const hmine = hk.find(m => !!key && head(m).includes(`[${key}]`))
  const rest = [...all, ...hk].reduce((x, m) => x.replace(m[0], ''), md)
  const lines = (x: string, box: string) => [...x.matchAll(new RegExp(`^\\s*- \\[${box}\\] (.+)$`, 'gm'))].map(y => y[1].trim())
  const ticks = new Set(hmine ? lines(hmine[1], '[xX]') : []) // haiku only speaks about its own session
  const fresh = hmine ? [...new Set(lines(hmine[1], ' '))].filter(x => !ticks.has(x)) : []
  const count = (x: string, extra: string[] = [], ticked = new Set<string>()) => {
    const tasks = [...lines(x, '[ xX]'), ...extra.filter(e => !lines(x, '[ xX]').includes(e))]
    const done = (t: string) => ticked.has(t) || lines(x, '[xX]').includes(t)
    const todo = tasks.filter(t => !done(t))
    return { n: tasks.length, todo, pct: tasks.length ? Math.round(((tasks.length - todo.length) / tasks.length) * 100) : 0 }
  }
  const { todo, pct } = count(rest)
  const ses = count(sec ? sec[1] : '', fresh, ticks)
  return {
    status: label(rest, alts('statusLabel', STATUS_LABELS)),
    todo, pct,
    task: (hmine && label(hmine[1], alts('taskLabel', TASK_LABELS))) || (sec ? label(sec[1], alts('taskLabel', TASK_LABELS)) : ''),
    sesPct: ses.n ? ses.pct : undefined, // undefined = no session list yet
    sesTodo: ses.todo,
  }
}

// Data shared by the band and the side pane: PROGRESS.md, the context, the usage windows and the parallel sessions.
// After /clear the in-memory state can come back empty while the side pane is still open (raw labels, band shown twice).
// ponytail: only the dictionary is checked; add other atoms here if they ever show the same problem.
// Drawing is pure (no state writes), so here we only READ: if the atoms are empty, the dictionary and the pane position come from disk/store.
async function view($: EngineInterface) {
  const have = await read($, strings)
  if (Object.keys(have).length) return { s: have, lateral: (await read($, sitio)) === 'lateral' }
  const pref = (await $.store.get('lang')) ?? 'auto'
  const code = pref === 'auto' ? await detect($) : String(pref)
  const base = (await getLang($, 'en')) ?? {}
  const own = code === 'en' ? base : await getLang($, code)
  return { s: { ...base, ...(own ?? {}) }, lateral: (await $.store.get('sitio')) === 'lateral' }
}
// The same refill, but writing the atoms: only from event handlers (never while drawing).
async function ensureInit($: EngineInterface) {
  if (Object.keys(await read($, strings)).length) return
  await loadLang($)
  if ((await $.store.get('sitio')) === 'lateral') await update($, sitio, () => 'lateral')
  const saved = await $.store.get('limit')
  if (typeof saved === 'number') await update($, limit, () => saved)
}
async function datos($: EngineInterface) {
  const { s, lateral } = await view($)
  const md = await read($, progress)
  const used = await read($, tokens)
  const L = await read($, limit)
  const ctx = Math.min(100, Math.round((used / L) * 100))
  const rl = await read($, limits)
  const subs = await read($, agents)
  const open = await read($, peers)
  const pars = (await read($, parallels)).map(p => ({ ...parse(p.md, s, p.mark), name: p.name, state: p.status, doing: p.doing }))
  return { s, lateral, md, used, L, ...parse(md, s, mark), ctx, ctxColor: fillColor(ctx), h5: rl.find(x => x.kind === 'five_hour'), d7: rl.find(x => x.kind === 'seven_day'), pars, subs, open }
}
// Colours: the more is used the worse (context, usage); the more is done the better (progress).
const fillColor = (p: number) => (p >= 90 ? 'red' : p >= 70 ? 'yellow' : 'green')
const doneColor = (p: number) => (p < 30 ? 'red' : p < 70 ? 'yellow' : 'green')
const bar = (p: number, width = 20) => '█'.repeat(Math.round((p / 100) * width)).padEnd(width, '░')

let warned = false // ponytail: one warning per session; re-armed when the context drops below the limit (after /clear or compaction)

// Subagents running now, from the engine's own list; written only when it changed so the panel does not redraw for nothing.
async function refreshAgents($: EngineInterface) {
  const all = await $.agent.list().catch(() => [])
  const live: Agente[] = all.filter(a => ['pending', 'running', 'waiting'].includes(a.status)).map(a => ({ id: a.id, text: a.description || a.name || a.type, type: a.type, name: a.name }))
  if (JSON.stringify(live) !== JSON.stringify(await read($, agents))) await update($, agents, () => live)
}

// Sessions open in this project (the folder itself and its .claude/worktrees/*), from the registry Claude Code keeps in ~/.claude/sessions (one JSON per open session).
// ponytail: undocumented file format; if it changes the list just stays empty. Assumes a closed session removes its file.
const flat = (p: string) => p.replace(/\\/g, '/').replace(/\/$/, '')
async function openSessions($: EngineInterface) {
  const home = flat($.plugin.root).split('/plugins/')[0]
  const proj = flat(mainOf(root)).toLowerCase() // a claude -w session still belongs to the main project
  const list: { id: string; cwd: string; name: string; status: string }[] = []
  for (const f of (await $.fs.list(`${home}/sessions`).catch(() => [])).filter(f => f.name.endsWith('.json'))) {
    try {
      const x = JSON.parse(await $.fs.read(`${home}/sessions/${f.name}`))
      const cwd = flat(String(x.cwd ?? ''))
      const low = cwd.toLowerCase()
      if (x.kind !== 'interactive' || !(low === proj || low.startsWith(proj + '/'))) continue
      const wt = low.startsWith(proj + '/.claude/worktrees/') ? cwd.split('/').pop() : ''
      list.push({ id: String(x.sessionId ?? ''), cwd, name: wt || String(x.name ?? f.name), status: String(x.status ?? '') })
    } catch { /* unreadable file: skip it */ }
  }
  return { home, list }
}

// Claude Code never tells a mod its own session id. So the mod puts a mark in what it adds to the conversation (the transcript keeps it) and looks for it.
// ponytail: reads whole transcripts, so it gives up after a few tries; it starts again with every new conversation (/clear).
const mark = `whatnow-${Math.random().toString(36).slice(2, 10)}`
let tries = 0
async function findMe($: EngineInterface, home: string, list: { id: string; cwd: string }[]) {
  if (me || tries >= 4) return
  tries++
  for (const p of list) {
    const text = await $.fs.read(`${home}/projects/${p.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${p.id}.jsonl`).catch(() => '')
    if (typeof text === 'string' && text.includes(mark)) { me = p.id; return }
  }
}

// The mark of another session, read from its transcript (the block the mod added is `\n(whatnow-xxxxxxxx)`). Remembered once found.
// ponytail: whole-file read, at most 5 tries per session id.
const peerMarks = new Map<string, string>()
const peerTries = new Map<string, number>()
async function markOf($: EngineInterface, home: string, p: { id: string; cwd: string }) {
  if (peerMarks.has(p.id) || (peerTries.get(p.id) ?? 0) >= 5) return peerMarks.get(p.id) ?? ''
  peerTries.set(p.id, (peerTries.get(p.id) ?? 0) + 1)
  const text = await $.fs.read(`${home}/projects/${p.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${p.id}.jsonl`).catch(() => '')
  const m = typeof text === 'string' ? [...text.matchAll(/\\n\((whatnow-[a-z0-9]{8})\)/g)].pop() : undefined
  if (m) peerMarks.set(p.id, m[1])
  return m?.[1] ?? ''
}

// A short name and one sentence of what each open session is doing. The source is its PROGRESS.md task line, or its last message if there is none.
// Haiku is asked only when that source changes (and never twice at once); a failure is remembered too, so it is not retried on every tool call.
const named = new Map<string, { src: string; label: string; doing: string }>()
const asking = new Set<string>()
async function lastMessage($: EngineInterface, home: string, p: { id: string; cwd: string }) {
  const text = await $.fs.read(`${home}/projects/${p.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${p.id}.jsonl`).catch(() => '')
  if (typeof text !== 'string') return ''
  const lines = text.slice(-300_000).split('\n') // only the tail of the transcript; a cut first line just fails to parse
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const x = JSON.parse(lines[i])
      const c = x.message?.content
      const s = x.type !== 'user' ? '' : typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join(' ') : ''
      if (s.trim() && !s.trim().startsWith('<')) return s.trim().slice(0, 400) // "<" = system text, not the person
    } catch { /* not a message line */ }
  }
  return ''
}
async function nameSession($: EngineInterface, home: string, p: { id: string; cwd: string }, task: string) {
  const src = task || (await lastMessage($, home, p))
  if (!src || named.get(p.id)?.src === src || asking.has(p.id)) return
  asking.add(p.id)
  let entry = { src, label: '', doing: '' }
  try {
    const r = await $.model.complete({
      model: 'haiku', effort: 'low', maxTokens: 200, timeoutMs: 30_000,
      prompt: `The text below says what a work session is doing. Reply with exactly two lines. Line 1: a name of 2 or 3 words joined by hyphens, lowercase, no spaces. Line 2: one short sentence (at most 12 words) saying what the session is doing now. Use the language of the text. Nothing else.\n\n${src}`,
    })
    const [label = '', doing = ''] = r.isAnswered ? r.text.trim().split('\n').map(x => x.trim()) : []
    if (label && doing) entry = { src, label: label.slice(0, 40), doing: doing.slice(0, 120) }
  } catch { /* keep the empty entry */ }
  named.set(p.id, entry)
  asking.delete(p.id)
  void refreshOpen($) // draw the new name; the source is the same now, so it does not ask again
}

// Perspective: this session sees itself as the main one and every other open session as parallel (a -w session sees the main one as parallel).
async function refreshOpen($: EngineInterface) {
  if (!root) return
  const { home, list } = await openSessions($)
  await findMe($, home, list)
  const s = await read($, strings)
  // Progress of the other sessions: the section of each one (found by its mark) in the PROGRESS.md of its own folder; sessions in the same folder share the file, not the section.
  const pars: Paralela[] = []
  const marks = [mark]
  const got = await Promise.all(list.map(async p => ({ p, pm: p.id === me ? mark : await markOf($, home, p) })))
  // Before its first message a session has no mark in its transcript yet, so it cannot be told apart from itself. If exactly one session of my own folder is in that state, it is this one.
  const mine = me || (got.filter(g => !g.pm && flat(g.p.cwd).toLowerCase() === flat(root).toLowerCase()).length === 1 ? got.find(g => !g.pm && flat(g.p.cwd).toLowerCase() === flat(root).toLowerCase())!.p.id : '')
  for (const { p, pm } of got) {
    const md = await $.fs.read(`${mainOf(p.cwd)}/${PROGRESS}`).catch(() => '')
    const text = typeof md === 'string' ? md.replace(/\r\n/g, '\n') : ''
    void nameSession($, home, p, text.trim() ? parse(text, s, pm).task : '')
    if (p.id !== mine && pm !== mark) marks.push(pm)
    // a session of my own folder without a mark may be this very one (or an old version): never shown as parallel
    const unknown = !pm && flat(p.cwd).toLowerCase() === flat(root).toLowerCase()
    if (p.id === mine || pm === mark || (unknown && !mine)) continue // unknown and no way to tell who is who: better to hide than to show this very session as another
    pars.push({ name: named.get(p.id)?.label || p.name, md: text, mark: pm, status: p.status, doing: named.get(p.id)?.doing })
  }
  live = marks.every(Boolean) ? marks : []
  const open: Abierta[] = list.map(p => ({ name: named.get(p.id)?.label || p.name, status: p.status, self: !!mine && p.id === mine, doing: named.get(p.id)?.doing })).sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name))
  if (JSON.stringify(open) !== JSON.stringify(await read($, peers))) await update($, peers, () => open)
  if (JSON.stringify(pars) !== JSON.stringify(await read($, parallels))) await update($, parallels, () => pars) // a closed session drops out of the panel by itself
}

async function refresh($: EngineInterface) {
  await refreshOpen($)
  const text = await $.fs.read(at(PROGRESS)).catch(() => undefined)
  if (typeof text !== 'string' || !text.trim()) return // ponytail: a failed read keeps the last good text; the panel is not wiped
  await update($, progress, () => text.replace(/\r\n/g, '\n'))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    root = e.cwd
    await loadLang($)
    await registerCommand($)
    const saved = await $.store.get('limit') // remembered between sessions
    if (typeof saved === 'number') await update($, limit, () => saved)
    if ((await $.store.get('sitio')) === 'lateral') {
      await update($, sitio, () => 'lateral')
      void openPane($, await read($, strings))
    }
    await refresh($)
    await refreshLimits($)
    return next(e)
  })

  on('command.run', { command: P }, async ($, e) => {
    const [word = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const s = await read($, strings)
    const L = await read($, limit)
    const lateral = (await read($, sitio)) === 'lateral'
    if (word === '') {
      const now = await update($, hidden, h => !h)
      if (lateral) await (now ? $.ui.close({ id: P }) : openPane($, s))
      return { text: t(s, now ? 'hidden' : 'shown') }
    }
    if (/^(lateral|side)/.test(word)) {
      await update($, sitio, () => 'lateral')
      await update($, hidden, () => false)
      await $.store.set('sitio', 'lateral')
      await openPane($, s)
      const { isFullscreen, columns } = e.presentation
      const note = !isFullscreen || columns < 110 ? t(s, 'sideNarrow', { columns, noFs: isFullscreen ? '' : t(s, 'noFs') }) : ''
      return { text: t(s, 'side') + note }
    }
    if (/^band/.test(word)) {
      await update($, sitio, () => 'banda')
      await update($, hidden, () => false)
      await $.store.set('sitio', 'banda')
      await $.ui.close({ id: P })
      return { text: t(s, 'band') }
    }
    if (/^limit/.test(word)) {
      const n = Math.round(parseFloat(value) * (/k$/.test(value) || parseFloat(value) < 1000 ? 1000 : 1))
      if (!(n >= 20_000 && n <= 1_000_000)) return { text: t(s, 'limitUsage') }
      await update($, limit, () => n)
      await $.store.set('limit', n)
      warned = false
      return { text: t(s, 'limitSet', { n: n / 1000 }) }
    }
    if (/^progres/.test(word)) {
      void $.prompt.submit({ text: t(s, 'progressNow', { progress: at(PROGRESS), mark }), asUser: true }).catch(err => $.ui.toast(t(s, 'progressFail', { err: String(err) })))
      return { text: t(s, 'progressAsk', { file: PROGRESS }) }
    }
    if (/^(traspas|handoff)/.test(word)) {
      void $.prompt.submit({ text: handoffPrompt(s, t(s, 'whyUser')), asUser: true }).catch(err => $.ui.toast(t(s, 'handoffFail', { err: String(err) })))
      return { text: t(s, 'handoffAsk') }
    }
    const files = await $.fs.list(`${$.plugin.root}/lang`).catch(() => [])
    const codes = files.map(f => f.name.replace(/\.json$/, ''))
    const isLangWord = /^(lang|idiom)/.test(word)
    // /whatnow en, /whatnow es, /whatnow auto (or any lang/<code>.json): the word itself is the language.
    if (isLangWord || word === 'auto' || codes.includes(word)) {
      const pick = isLangWord ? value : word
      if (!pick) {
        const cur = ((await $.store.get('lang')) ?? 'auto') as string
        return { text: t(s, 'langCurrent', { lang: cur, list: codes.join(', ') }) }
      }
      const { code, found } = await loadLang($, pick)
      await $.store.set('lang', pick)
      await registerCommand($)
      const s2 = await read($, strings)
      void translateProgress($, code, s2).catch(err => $.ui.toast(t(s2, 'translateFail') + ' ' + String(err)))
      return { text: t(s2, 'langSet', { lang: pick === 'auto' ? `auto (${code})` : code }) + (found || code === 'en' ? '' : ' ' + t(s2, 'langMissing', { lang: code })) }
    }
    return { text: t(s, 'help', { L: L / 1000 }) }
  })

  // After each turn: update the numbers and, past the limit, ask for the handoff.
  on('session.measure', async ($, e, next) => {
    await ensureInit($)
    const used = e.context.tokens ?? 0
    const L = await read($, limit)
    await update($, tokens, () => used)
    await update($, limits, () => e.rateLimits ?? [])
    await refresh($)
    await refreshAgents($)
    if (used < L) warned = false
    else if (!warned) {
      warned = true
      const s = await read($, strings)
      $.ui.toast(t(s, 'toastFull'))
      void $.prompt.submit({ text: handoffPrompt(s, t(s, 'whyFull', { n: L / 1000 })), asUser: true }).catch(err => $.ui.toast(t(s, 'handoffFail', { err: String(err) }))) // goes in when the current turn ends
    }
    return next(e)
  })

  // Safety net: if native compaction fires first, its summary is written as a handoff.
  on('session.compact', { trigger: 'auto' }, async ($, e, next) =>
    e.agentId ? next(e) : next({ ...e, instructions: handoffPrompt(await read($, strings), t(await read($, strings), 'whyCompact')) }),
  )

  // Subagents start and stop between turns of the main loop, so look at every tool call (the ones inside a subagent too) and at the end of each turn.
  on('tool.call', async ($, e, next) => {
    await refreshOpen($)
    await refreshAgents($)
    const r = await next(e)
    await refreshAgents($)
    return r
  })
  on('turn.complete', async ($, e, next) => {
    await ensureInit($)
    const r = await next(e)
    await refreshAgents($)
    await refreshLimits($)
    if (!e.agentId) void syncProgress($, e.answer)
    return r
  })

  // First message of each conversation: instructions + the previous session's handoff, if any.
  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    const s = await read($, strings)
    recent = []
    me = ''; tries = 0 // a new conversation can be a new session id: look for it again
    const blocks = [...r.blocks, { name: P, text: `${t(s, 'instructions', { progress: at(PROGRESS), mark })}
(${mark})` }]
    const prev = await $.fs.read(at(HANDOFF)).catch(() => '')
    if (typeof prev === 'string' && prev.trim()) {
      blocks.push({ name: 'handoff', text: `${t(s, 'handoffIntro', { handoff: HANDOFF })}\n\n${prev}` })
      await $.fs.write(at('.claude/HANDOFF.usado.md'), prev) // a copy is kept and the file emptied so it is not repeated
      await $.fs.write(at(HANDOFF), '')
    }
    return { ...r, blocks }
  })

  // If the person closes the side pane with its X, the panel goes back above the prompt (it is not lost).
  on('ui.close', { id: P }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      await update($, sitio, () => 'banda')
      await $.store.set('sitio', 'banda')
    }
    return next(e)
  })

  // Band above the box where you type.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, hidden)) || (await view($)).lateral) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { s, md, pct, sesPct, ctx, ctxColor, h5, d7, subs, open } = await datos($)
    // ponytail: one line only; usage details, task descriptions, parallel sessions and "Left" lists live in the side pane (/whatnow side).
    const pc = (p: number | undefined, color: (n: number) => string) => (p === undefined ? <Text dimColor>–</Text> : <Text color={color(p)}>{bar(p, 6)} {p}%</Text>)
    return (
      <Box>
        <Text wrap="truncate">
          <Text bold>{t(s, 'context')} </Text>{pc(ctx, fillColor)}
          {h5 || d7 ? <Text dimColor> · {t(s, 'usage')} </Text> : null}
          {h5 ? <Text color={fillColor(h5.percentUsed)}>{Math.round(h5.percentUsed)}%</Text> : null}
          {h5 && d7 ? <Text dimColor>/</Text> : null}
          {d7 ? <Text color={fillColor(d7.percentUsed)}>{Math.round(d7.percentUsed)}%</Text> : null}
          {subs.length ? <Text dimColor> · {t(s, 'agents')} {subs.length}</Text> : null}
          {open.length > 1 ? <Text dimColor> · {t(s, 'peers')} {open.length}</Text> : null}
          {md ? <Text dimColor> · {t(s, 'session')} </Text> : null}
          {md ? pc(sesPct, doneColor) : null}
          {md ? <Text dimColor> · {t(s, 'project')} </Text> : null}
          {md ? pc(pct, doneColor) : null}
          {md ? null : <Text dimColor> · {t(s, 'noFile', { file: PROGRESS })}</Text>}
        </Text>
      </Box>
    )
  })

  // Side pane: the same, vertical, with the full pending lists.
  on('ui.render', { component: 'Pane', requestId: P }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { s, md, used, L, status, task, todo, pct, sesPct, sesTodo, ctx, ctxColor, h5, d7, pars, subs, open } = await datos($)
    const w = Math.max(8, Math.min(20, e.props.bodyColumns - 6))
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1) // sentences start with a capital
    const list = (items: string[]) => <Text dimColor={!items.length}>{items.length ? items.map(x => `• ${cap(x)}`).join('\n') : cap(t(s, 'nothing'))}</Text>
    // Section title: blank line, a rule, then the title in capitals and colour.
    const head = (title: string) => (
      <>
        <Text> </Text>
        <Text dimColor>{'─'.repeat(w + 6)}</Text>
        <Text bold>{title.toUpperCase()}</Text>
      </>
    )
    const cw = Math.max(10, Math.floor((e.props.bodyColumns - 2) / 3)) // column width
    const bw = Math.max(4, cw - 6) // bar width inside a column
    const col = (name: string, r?: { percentUsed: number }) => (
      <Box flexDirection="column" width={cw}>
        <Text bold wrap="truncate">{name.toUpperCase()}</Text>
        {r ? <Text color={fillColor(r.percentUsed)} wrap="truncate">{bar(r.percentUsed, bw)} {Math.round(r.percentUsed)}%</Text> : <Text dimColor>{t(s, 'noUsage')}</Text>}
      </Box>
    )
    // A session block: title, bar + %, one-sentence task, what is left.
    const block = (title: string, p: number | undefined, text: string, items: string[]) => (
      <>
        {head(title)}
        {p === undefined ? <Text dimColor>{t(s, 'noList')}</Text> : <Text color={doneColor(p)}>{bar(p, w)} {p}%</Text>}
        {text ? <Text>{cap(text)}</Text> : null}
        <Text> </Text>
        <Text bold dimColor>{cap(t(s, 'left'))} ({items.length}):</Text>
        {list(items)}
      </>
    )
    return (
      <Box flexDirection="column">
        {/* Three columns side by side: context, usage 5 h, usage week. */}
        <Box>
          <Box flexDirection="column" width={cw}>
            <Text bold wrap="truncate">{t(s, 'context').toUpperCase()}</Text>
            <Text color={ctxColor} wrap="truncate">{bar(ctx, bw)} {ctx}%</Text>
            <Text dimColor wrap="truncate">{Math.round(used / 1000)}k / {L / 1000}k</Text>
          </Box>
          {col(t(s, 'usage5h'), h5)}
          {col(t(s, 'usage7d'), d7)}
        </Box>
        {md ? (
          <>
            {block(t(s, 'mainSession'), sesPct, task, sesTodo)}
            {subs.length ? (
              <Box flexDirection="column">
                {head(`${t(s, 'agents')} (${subs.length})`)}
                {list(subs.map(a => `${a.name && a.name !== a.text ? `${a.name}: ` : ''}${a.text} (${a.type})`))}
              </Box>
            ) : null}
          </>
        ) : (
          <Text dimColor>{t(s, 'noFilePane', { file: PROGRESS })}</Text>
        )}
        {/* The other open sessions, below the whole section of this one (this one is never repeated here). */}
        {pars.length ? (
          <Box flexDirection="column">
            {head(`${t(s, 'parallels')} (${pars.length})`)}
            {pars.map((p, i) => (
              <Box key={i} flexDirection="column">
                <Text> </Text>
                <Text bold>{cap(p.name)} · {t(s, p.state === 'busy' ? 'busy' : 'idle')}</Text>
                {p.doing || p.task ? <Text>{cap(p.doing || p.task)}</Text> : null}
                {p.sesPct === undefined ? <Text dimColor>{t(s, 'noList')}</Text> : <Text color={doneColor(p.sesPct)}>{bar(p.sesPct, w)} {p.sesPct}%</Text>}
                <Text bold dimColor>{cap(t(s, 'left'))} ({p.sesTodo.length}):</Text>
                {list(p.sesTodo)}
              </Box>
            ))}
          </Box>
        ) : null}
        {md ? block(t(s, 'project'), pct, status, todo) : null}
      </Box>
    )
  })
}
