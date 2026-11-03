import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Sitio, Dict } from '../types'

const DEFAULT_LIMIT = 150_000 // 150k of context = 100%, change with /whatnow limit <n>k
const PROGRESS = 'PROGRESS.md' // at the project root (folder where claude was started)
const HANDOFF = '.claude/HANDOFF.md'
const P = 'whatnow'

// Project root, fixed when the session opens: if the working folder changes (a cd), PROGRESS and handoff are not lost.
let root = ''
const at = (f: string) => (root ? `${root}/${f}` : f)

const tokens = atom({ plugin: 'whatnow', key: 'tokens' } as const, 0, { shape: 'tokens-1' })
const progress = atom({ plugin: 'whatnow', key: 'progress' } as const, '', { shape: 'progress-1' })
const hidden = atom({ plugin: 'whatnow', key: 'hidden' } as const, false, { shape: 'hidden-1' })
const sitio = atom({ plugin: 'whatnow', key: 'sitio' } as const, 'banda' as Sitio, { shape: 'sitio-1' })
const limit = atom({ plugin: 'whatnow', key: 'limit' } as const, DEFAULT_LIMIT, { shape: 'limit-1' })
const strings = atom({ plugin: 'whatnow', key: 'strings' } as const, {} as Dict, { shape: 'strings-1' })

// Words in every built-in language, so a PROGRESS.md written in one language still reads after switching.
const SESSION_HEADINGS = ['This session', 'Esta sesión']
const STATUS_LABELS = ['Status:', 'Estado:']

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
    prompt: `Translate this Markdown file into ${name}. Keep the structure exactly: heading levels, every "- [ ]" and "- [x]" line, blank lines, code, file names and paths. The heading that means "this session" must read exactly "${s.sessionHeading}" and the line label that means "status" must read exactly "${s.statusLabel}". Reply with the translated file only, no comments, no code fence.\n\n${md}`,
  })
  const out = r.isAnswered ? r.text.replace(/^```\w*\n|\n```\s*$/g, '').trim() : ''
  if (!out || boxes(out) !== boxes(md)) return void $.ui.toast(t(s, 'translateFail'))
  await $.fs.write(at(PROGRESS), out + '\n')
  await update($, progress, () => out)
  $.ui.toast(t(s, 'translated'))
}

const handoffPrompt = (s: Dict, why: string) => t(s, 'handoffPrompt', { why, handoff: at(HANDOFF), progress: at(PROGRESS) })
const openPane = ($: EngineInterface, s: Dict) => $.ui.open({ id: P, title: t(s, 'paneTitle') })

// Data shared by the band and the side pane, taken from PROGRESS.md and the context.
async function datos($: EngineInterface) {
  const md = await read($, progress)
  const s = await read($, strings)
  const used = await read($, tokens)
  const L = await read($, limit)
  const alts = (key: string, known: string[]) => [...new Set([...known, s[key]].filter(Boolean))]
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const labels = alts('statusLabel', STATUS_LABELS)
  const status = labels.map(l => md.split('\n').find(x => x.toLowerCase().startsWith(l.toLowerCase()))?.slice(l.length).trim()).find(Boolean) ?? ''
  // The session section runs to the next heading (or the end); the rest is the project.
  const headings = alts('sessionHeading', SESSION_HEADINGS).map(esc).join('|')
  const sec = md.match(new RegExp(`^#{2,}[ \\t]*(?:${headings})[^\\n]*\\n?([\\s\\S]*?)(?=^#{1,6}[ \\t]|$(?![\\s\\S]))`, 'im'))
  const count = (x: string) => {
    const tasks = [...x.matchAll(/^\s*- \[([ xX])\] (.+)$/gm)]
    const done = tasks.filter(y => y[1] !== ' ').length
    return { n: tasks.length, todo: tasks.filter(y => y[1] === ' ').map(y => y[2]), pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }
  const { todo, pct } = count(sec ? md.replace(sec[0], '') : md)
  const ses = count(sec ? sec[1] : '')
  const sesPct = ses.n ? ses.pct : undefined // undefined = no session list yet
  const ctx = Math.min(100, Math.round((used / L) * 100))
  const ctxColor = ctx >= 90 ? 'red' : ctx >= 70 ? 'yellow' : 'green'
  return { s, md, used, L, status, todo, pct, sesPct, sesTodo: ses.todo, ctx, ctxColor }
}
const bar = (p: number, width = 20) => '█'.repeat(Math.round((p / 100) * width)).padEnd(width, '░')

let warned = false // ponytail: one warning per session; re-armed when the context drops below the limit (after /clear or compaction)

async function refresh($: EngineInterface) {
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
      void $.prompt.submit({ text: t(s, 'progressNow', { progress: at(PROGRESS) }), asUser: true }).catch(err => $.ui.toast(t(s, 'progressFail', { err: String(err) })))
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
    const used = e.context.tokens ?? 0
    const L = await read($, limit)
    await update($, tokens, () => used)
    await refresh($)
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

  // First message of each conversation: instructions + the previous session's handoff, if any.
  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    const s = await read($, strings)
    const blocks = [...r.blocks, { name: P, text: t(s, 'instructions', { progress: at(PROGRESS) }) }]
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
    if (e.props.hasSurvey || (await read($, hidden)) || (await read($, sitio)) === 'lateral') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { s, md, pct, sesPct, ctx, ctxColor } = await datos($)
    // ponytail: one line only; the "Falta" lists live in the side pane (/whatnow lateral).
    const rest = md
      ? ` · ${t(s, 'session')} ${sesPct === undefined ? '–' : `${bar(sesPct, 6)} ${sesPct}%`} · ${t(s, 'project')} ${bar(pct, 6)} ${pct}%`
      : ` · ${t(s, 'noFile', { file: PROGRESS })}`
    return (
      <Box>
        <Text wrap="truncate"><Text bold>{t(s, 'context')} </Text><Text color={ctxColor}>{bar(ctx, 6)} {ctx}%</Text><Text dimColor>{rest}</Text></Text>
      </Box>
    )
  })

  // Side pane: the same, vertical, with the full pending lists.
  on('ui.render', { component: 'Pane', requestId: P }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { s, md, used, L, status, todo, pct, sesPct, sesTodo, ctx, ctxColor } = await datos($)
    const w = Math.max(8, Math.min(20, e.props.bodyColumns - 6))
    const list = (items: string[]) => <Text dimColor={!items.length}>{items.length ? items.map(x => `· ${x}`).join('\n') : t(s, 'nothing')}</Text>
    return (
      <Box flexDirection="column">
        <Text bold>{t(s, 'context')}</Text>
        <Text color={ctxColor}>{bar(ctx, w)} {ctx}%</Text>
        <Text dimColor>{Math.round(used / 1000)}k / {L / 1000}k</Text>
        <Text> </Text>
        {md ? (
          <>
            <Text bold>{t(s, 'session')}</Text>
            <Text dimColor={sesPct === undefined}>{sesPct === undefined ? t(s, 'noList') : `${bar(sesPct, w)} ${sesPct}%`}</Text>
            <Text> </Text>
            <Text bold>{t(s, 'project')}</Text>
            <Text>{bar(pct, w)} {pct}%</Text>
            <Text dimColor>{status}</Text>
            <Text> </Text>
            <Text bold>{t(s, 'leftSession')} ({sesTodo.length})</Text>
            {list(sesTodo)}
            <Text> </Text>
            <Text bold>{t(s, 'leftProject')} ({todo.length})</Text>
            {list(todo)}
          </>
        ) : (
          <Text dimColor>{t(s, 'noFilePane', { file: PROGRESS })}</Text>
        )}
      </Box>
    )
  })
}
