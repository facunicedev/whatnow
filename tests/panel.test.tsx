import { expect, test } from 'claude-code/testing'

// Diccionarios mínimos: los tests no pueden importar los JSON reales (la paridad es/en se comprueba aparte).
const en = {
  context: 'Context', session: 'Session', project: 'Project', leftSession: 'Left in session', leftProject: 'Left in project',
  nothing: 'nothing', sessionHeading: 'This session', statusLabel: 'Status:', side: 'Shown at the side.', band: 'Shown above the prompt.',
  sideNarrow: ' Note: {columns} columns{noFs}', noFs: ', not fullscreen', limitSet: 'Context limit: {n}k', paneTitle: 'What now',
  agents: 'Subagents', usage: 'Usage', usage5h: 'Usage 5h', usage7d: 'Usage week', noUsage: 'no data', mainSession: 'Main session', parallels: 'Parallel sessions', parallel: 'Parallel session', left: 'Left', taskLabel: 'Task:', peers: 'Open sessions', busy: 'working', idle: 'waiting', here: 'this one (main)', parallelWord: 'parallel',
  langSet: 'Language: {lang} (saved).', handoffPrompt: '{why} handoff in {handoff}', whyFull: 'Context is full ({n}k).', toastFull: 'Context full',
}
const es = {
  ...en, context: 'Contexto', session: 'Sesión', project: 'Proyecto', leftSession: 'Falta en la sesión', leftProject: 'Falta en el proyecto',
  nothing: 'nada', sessionHeading: 'Esta sesión', statusLabel: 'Estado:', side: 'En el lateral (se recuerda).', band: 'Encima del prompt (se recuerda).',
  agents: 'Subagentes', usage: 'Uso', usage5h: 'Uso 5 horas', usage7d: 'Uso semana', noUsage: 'sin datos', mainSession: 'Sesión principal', parallels: 'Sesiones paralelas', parallel: 'Sesión paralela', left: 'Falta', taskLabel: 'Tarea:', peers: 'Sesiones abiertas', busy: 'trabajando', idle: 'esperando', here: 'esta (principal)', parallelWord: 'paralela',
  sideNarrow: ' Ojo: {columns} columnas{noFs}', limitSet: 'Límite de contexto: {n}k', whyFull: 'Contexto lleno ({n}k).', langSet: 'Idioma: {lang} (guardado).',
}

// Lee los archivos de idioma del propio mod; el resto de lecturas devuelven PROGRESS.md.
const readFile = (_: unknown, e: any) => ({ value: /lang[\\/]\w+\.json$/.test(e.path) ? JSON.stringify(e.path.endsWith('es.json') ? es : en) : MD }) as never
const LANG = (code: string) => ({ value: { language: code } }) as never

const BAND = {
  plugin: 'whatnow',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 } },
} as const

// Guardado con saltos de línea de Windows (\r\n), como lo dejaría un editor en este PC.
const MD = [
  '# Mini dashboard para Claude Code',
  'Estado: banda hecha, falta probar el traspaso',
  'Qué: probar el mod',
  'Por qué: que funcione antes de usarlo',
  '',
  '- [x] investigar',
  '- [x] escribir el mod',
  '- [ ] probar el traspaso',
  '- [ ] usarlo en un proyecto',
  '',
  '## Esta sesión',
  '- [x] paso uno',
  '- [x] paso dos',
  '- [x] paso tres',
  '- [ ] paso cuatro',
].join('\r\n')

test('la banda calcula proyecto, pendientes y contexto; a 150k pide el traspaso', async ($, on) => {
  const submitted: string[] = []
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', readFile)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [] }) as never)
  on('prompt.submit', (_, e) => (submitted.push(e.text), { text: e.text }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const measure = (t: number) =>
    $.session.measure({ context: { tokens: t, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await measure(75_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  const all = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('50%') // 2 de 4 tareas
  expect(all).toContain('75%') // sesión: 3 de 4 pasos, sin mezclarse con el proyecto
  expect(all).not.toContain('Falta') // la banda es de 1 línea
  expect(all).not.toContain('\r')
  await ui.unmount()

  expect(submitted.length).toBe(0)
  await measure(151_000)
  await measure(152_000) // no repite el aviso
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain('Contexto lleno')

  // /panel limite 200k sube el umbral: 152k ya no está lleno
  const r = await $.command.run({ command: 'whatnow', args: 'limite 200k' } as never)
  expect(r.text).toContain('200k')
  await measure(160_000)
  expect(submitted.length).toBe(1)
})

const PANE = {
  plugin: 'whatnow',
  component: 'Pane',
  requestId: 'whatnow',
  props: { title: 'Panel', isFocused: false, bodyColumns: 36, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('/panel lateral pone el panel al lado, quita la banda y avisa si la ventana es estrecha', async ($, on) => {
  const opened: string[] = []
  const stored: Record<string, unknown> = {}
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', readFile)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', (_, e: any) => ((stored[e.key] = e.value), { value: undefined }) as never)
  on('ui.open', (_, e: any) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>motor</Text> }) // el motor

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ command: 'whatnow', args: 'lateral', presentation: { isFullscreen: true, columns: 80 } } as never)
  expect(opened).toEqual(['whatnow'])
  expect(stored.sitio).toBe('lateral')
  expect(r.text).toContain('80 columnas')

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const texts = (await pane.findAll({ type: 'Text' })).map(t => t.text)
  expect(texts).toContain('• Probar el traspaso\n• Usarlo en un proyecto')
  await pane.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await band.findAll({ type: 'Text' })).map(x => x.text)).toEqual(['motor']) // la banda cede: no dibuja nada suyo
  await band.unmount()

  const r2 = await $.command.run({ command: 'whatnow', args: 'banda', presentation: { isFullscreen: true, columns: 200 } } as never)
  expect(stored.sitio).toBe('banda')
  expect(r2.text).toContain('Encima del prompt')
})

test('/whatnow language cambia el idioma de la banda y se guarda; auto lo toma de los ajustes', async ($, on) => {
  const stored: Record<string, unknown> = {}
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', readFile)
  on('settings.read', () => LANG('English'))
  on('fs.list', () => ({ value: [{ name: 'en.json' }, { name: 'es.json' }] }) as never)
  on('store.get', (_, e: any) => ({ value: stored[e.key] }) as never)
  on('store.set', (_, e: any) => ((stored[e.key] = e.value), { value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const texts = async () => {
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    const all = (await band.findAll({ type: 'Text' })).map(x => x.text).join('\n')
    await band.unmount()
    return all
  }

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await texts()).toContain('Session') // auto + ajuste "English" => en
  const r = await $.command.run({ command: 'whatnow', args: 'language es' } as never)
  expect(r.text).toContain('Idioma: es')
  expect(stored.lang).toBe('es')
  expect(await texts()).toContain('Sesión')
  // la palabra suelta es el idioma: /whatnow en
  const r2 = await $.command.run({ command: 'whatnow', args: 'en' } as never)
  expect(r2.text).toContain('Language: en')
  expect(stored.lang).toBe('en')
})

test('al cambiar de idioma PROGRESS.md se traduce con una llamada al modelo; si se pierden casillas no se escribe', async ($, on) => {
  const written: string[] = []
  let reply = ''
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', readFile)
  on('fs.write', (_, e: any) => (/whatnow-live/.test(e.path ?? '') || written.push(e.content ?? e.text ?? e.data), { value: undefined }) as never)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [{ name: 'en.json' }, { name: 'es.json' }] }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: reply, usage: {} } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const wait = () => new Promise(r => setTimeout(r, 50))

  reply = MD.replace('Estado:', 'Status:').replace('## Esta sesión', '## This session')
  await $.command.run({ command: 'whatnow', args: 'en' } as never)
  await wait()
  expect(written.join('')).toContain('## This session')

  written.length = 0
  reply = '# only a title'
  await $.command.run({ command: 'whatnow', args: 'es' } as never)
  await wait()
  expect(written.length).toBe(0)
})

test('el lateral muestra uso 5h/semana, la sesión principal con su tarea, las paralelas y el proyecto, con colores', async ($, on) => {
  const PAR = ['## Esta sesión [whatnow-bbbbbbbb]', 'Tarea: arreglar el login', '- [x] a', '- [ ] b', '- [ ] c', '- [ ] d'].join('\n')
  const MAIN = MD.replace('## Esta sesión', '## Esta sesión\nTarea: probar el traspaso')
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  const win = (p: string) => p.split('/').join(String.fromCharCode(92))
  const SES: Record<string, string> = {
    'a.json': JSON.stringify({ kind: 'interactive', cwd: win('C:/proj'), name: 'proj-1', status: 'idle', sessionId: 'a' }),
    'b.json': JSON.stringify({ kind: 'interactive', cwd: win('C:/proj/.claude/worktrees/uno'), name: 'proj-2', status: 'busy', sessionId: 'b' }),
  }
  on('fs.read', (_, e: any) => (e.path.includes('sessions') ? { value: SES[Object.keys(SES).find(k => e.path.endsWith(k)) ?? ''] } : /\.jsonl$/.test(e.path) ? { value: e.path.endsWith('b.jsonl') ? 'x\\n(whatnow-bbbbbbbb)' : '' } : /lang/.test(e.path) ? readFile(_, e) : { value: MAIN + '\n' + PAR }) as never) // una sola PROGRESS.md: la -w escribe en su sección
  on('settings.read', () => LANG('es'))
  on('fs.list', (_, e: any) => ({ value: /sessions$/.test(e.path ?? '') ? Object.keys(SES).map(name => ({ name, kind: 'file' })) : [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: win('C:/proj'), surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 140_000, window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }, { kind: 'seven_day', percentUsed: 75 }], changed: ['context'] } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const nodes = await pane.findAll({ type: 'Text' })
  const all = nodes.map(t => t.text).join('\n')
  expect(all).toContain('24%') // 23.5 redondeado
  expect(all).toContain('75%') // semana (y sesión principal)
  expect(all).toContain('SESIÓN PRINCIPAL')
  expect(all).toContain('Probar el traspaso') // tarea de la sesión principal
  expect(all).toContain('SESIONES PARALELAS (1)')
  expect(all).toContain('Uno · trabajando')
  expect(all).toContain('Arreglar el login')
  expect(all).toContain('25%') // paralela: 1 de 4
  expect(all).not.toContain('nota.txt') // solo carpetas
  expect(all.indexOf('USO 5 HORAS')).toBeLessThan(all.indexOf('SESIÓN PRINCIPAL'))
  expect(all.indexOf('SESIÓN PARALELA')).toBeLessThan(all.indexOf('PROYECTO'))
  const colorOf = (txt: string) => (nodes.find(t => t.text.includes(txt)) as any)?.props?.color
  expect(colorOf('93%')).toBe('red') // contexto 140k/150k
  expect(colorOf('25%')).toBe('red') // paralela casi sin avanzar
  expect(colorOf('75%')).toBe('yellow') // uso semanal: 75% gastado ya es aviso
  expect((nodes.filter(t => t.text.includes('75%'))[1] as any)?.props?.color).toBe('green') // sesión principal: 75% hecho
  await pane.unmount()
})

test('los subagentes en marcha salen en el lateral con su tarea; los terminados no', async ($, on) => {
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', readFile)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('agent.list', () => ({ value: [
    { id: 'a1', description: 'buscar usos de agent.list', type: 'Explore', status: 'running' },
    { id: 'a2', description: 'ya terminado', type: 'general-purpose', status: 'completed' },
  ] }) as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const all = (await pane.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('SUBAGENTES (1)')
  expect(all).toContain('Buscar usos de agent.list (Explore)')
  expect(all).not.toContain('ya terminado')
  await pane.unmount()
})

test('al acabar un turno haiku escribe solo su sección "## Haiku [marca]"; el panel cuenta sus marcas y tareas nuevas; lo inventado se descarta', async ($, on) => {
  const written: string[] = []
  let reply = ''
  let file = MD
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('turn.complete', (_, e) => ({ text: e.answer }) as never)
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : { value: file }) as never)
  on('fs.write', (_, e: any) => (/whatnow-live/.test(e.path ?? '') || (written.push(e.content ?? e.text ?? e.data), file = e.content ?? e.text ?? e.data), { value: undefined }) as never)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [] }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: reply, usage: {} } }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const wait = () => new Promise(r => setTimeout(r, 50))
  const turn = { answer: 'hecho', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never

  // marca una tarea existente, propone una nueva e intenta marcar una que no existe
  reply = ['Estado: ignorado', 'Tarea: probando', '- [x] paso cuatro', '- [x] probar el traspaso', '- [x] tarea inventada', '- [ ] cosa nueva'].join('\n')
  await $.turn.complete(turn)
  await wait()
  expect(written.length).toBe(1)
  expect(written[0]).toContain('## Haiku [whatnow-')
  expect(written[0]).toContain('- [x] paso cuatro') // un paso de la sesión
  expect(written[0]).not.toContain('- [x] probar el traspaso') // una tarea del proyecto no es de Haiku
  expect(written[0]).not.toContain('Estado: ignorado')
  expect(written[0]).toContain('- [ ] cosa nueva')
  expect(written[0]).toContain("tarea inventada") // a new done step is now kept: it is how the session bar shows progress
  expect(written[0].startsWith(MD.slice(0, 200))).toBe(true) // el resto del archivo queda intacto

  // misma respuesta otra vez: no se reescribe
  written.length = 0
  await $.turn.complete(turn)
  await wait()
  expect(written.length).toBe(0)

  // una respuesta sin líneas válidas no toca el archivo
  reply = 'no sé'
  await $.turn.complete(turn)
  await wait()
  expect(written.length).toBe(0)
})

test('tras un /clear (sin session.start) el panel se rellena solo: etiquetas traducidas, no nombres internos', async ($, on) => {
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : { value: MD }) as never)
  on('settings.read', () => LANG('es'))
  on('fs.list', () => ({ value: [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const all = (await pane.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('USO 5 HORAS')
  expect(all).not.toContain('USAGE5H')
})

test('el lateral lista las sesiones abiertas del proyecto, también las -w sin PROGRESS.md, y no las de otras carpetas', async ($, on) => {
  let mark = ''
  const win = (p: string) => p.split('/').join(String.fromCharCode(92)) // Windows paths, as Claude Code writes them
  const S = (cwd: string, name: string, status: string) => JSON.stringify({ kind: 'interactive', cwd, name, status, sessionId: name })
  const files: Record<string, string> = {
    'a.json': S(win('C:/proj'), 'proj-83', 'idle'),
    'b.json': S(win('C:/proj'), 'proj-9f', 'busy'),
    'c.json': S(win('C:/proj/.claude/worktrees/estructura'), 'proj-aa', 'busy'),
    'd.json': S(win('C:/otro'), 'otro-1', 'idle'),
  }
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (e.path.includes('projects') ? { value: e.path.endsWith('proj-9f.jsonl') ? mark : 'sin marca' } : e.path.includes('sessions') ? { value: files[Object.keys(files).find(k => e.path.endsWith(k)) ?? ''] } : readFile(_, e)) as never)
  on('fs.list', (_, e: any) => ({ value: /sessions$/.test(e.path ?? '') ? Object.keys(files).map(name => ({ name, kind: 'file' })) : [] }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.write', () => ({ value: undefined }) as never)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }) as never)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: win('C:/proj'), surface: 'terminal', isInteractive: true })
  mark = /whatnow-[a-z0-9]+/.exec(JSON.stringify(await $.prompt.context({ blocks: [] } as never)))?.[0] ?? 'no-mark' // the mark the mod leaves in the conversation
  await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  const all = (await (await $.ui.mount({ ...PANE, surface: 'terminal' } as never)).findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('SESIONES PARALELAS (2)') // solo las otras: la propia no se repite
  expect(all).toContain('Estructura · trabajando')
  expect(all).toContain('Proj-83 · esperando')
  expect(all).not.toContain('proj-9f') // found itself by the mark: it is the main one, not listed again
  expect(all).not.toContain('otro-1')
  expect(all.indexOf('SESIÓN PRINCIPAL')).toBeLessThan(all.indexOf('SESIONES PARALELAS'))
})

test('cada sesión abierta sale con un nombre corto y una frase de lo que hace (de su último mensaje si no hay PROGRESS.md); los subagentes con nombre', async ($, on) => {
  const win = (p: string) => p.split('/').join(String.fromCharCode(92))
  const files: Record<string, string> = { 'a.json': JSON.stringify({ kind: 'interactive', cwd: win('C:/proj'), name: 'proj-83', status: 'busy', sessionId: 'proj-83' }), 'b.json': JSON.stringify({ kind: 'interactive', cwd: win('C:/proj'), name: 'proj-9f', status: 'idle', sessionId: 'proj-9f' }) }
  const msg = JSON.stringify({ type: 'user', message: { content: 'arregla el informe de ventas' } })
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : /\.jsonl$/.test(e.path) ? { value: e.path.endsWith('proj-83.jsonl') ? msg + '\n' + JSON.stringify({ x: '\n(whatnow-aaaaaaaa)' }) : msg } : /sessions/.test(e.path) ? { value: files[Object.keys(files).find(k => e.path.endsWith(k)) ?? ''] } : { value: MD }) as never)
  on('fs.list', (_, e: any) => ({ value: /sessions$/.test(e.path ?? '') ? Object.keys(files).map(name => ({ name, kind: 'file' })) : [] }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: 'informe-ventas\nArregla el informe de ventas.', usage: {} } }) as never)
  on('agent.list', () => ({ value: [{ id: 'a1', name: 'buscador', description: 'buscar usos', type: 'Explore', status: 'running' }] }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: win('C:/proj'), surface: 'terminal', isInteractive: true })
  const wait = () => new Promise(r => setTimeout(r, 50))
  await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  await wait()
  await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  const all = (await (await $.ui.mount({ ...PANE, surface: 'terminal' } as never)).findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('Informe-ventas')
  expect(all).toContain('Arregla el informe de ventas.')
  expect(all).toContain('Buscador: buscar usos (Explore)')
})

test('dos sesiones en la misma carpeta: cada una lee solo su sección de PROGRESS.md (por su marca)', async ($, on) => {
  const win = (p: string) => p.split('/').join(String.fromCharCode(92))
  const MDS = ['# x', 'Estado: bien', '- [ ] global', '', '## Esta sesión [whatnow-aaaaaaaa]', 'Tarea: tarea del vecino', '- [x] v1', '', '## Esta sesión [whatnow-bbbbbbbb]', 'Tarea: tarea ajena', '- [ ] z1'].join('\n')
  const SES: Record<string, string> = { 'a.json': JSON.stringify({ kind: 'interactive', cwd: win('C:/proj'), name: 'proj-a', status: 'idle', sessionId: 'a' }) }
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : /\.jsonl$/.test(e.path) ? { value: 'x\\n(whatnow-aaaaaaaa)' } : /sessions/.test(e.path) ? { value: SES['a.json'] } : { value: MDS }) as never)
  on('fs.list', (_, e: any) => ({ value: /sessions$/.test(e.path ?? '') ? [{ name: 'a.json', kind: 'file' }] : [] }) as never)
  on('model.complete', () => ({ value: { isAnswered: false, usage: {} } }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: win('C:/proj'), surface: 'terminal', isInteractive: true })
  for (let n = 0; n < 2; n++) { await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never); await new Promise(r => setTimeout(r, 50)) }
  const all = (await (await $.ui.mount({ ...PANE, surface: 'terminal' } as never)).findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('Tarea del vecino')
  expect(all).not.toContain('Tarea ajena')
  expect(all).not.toContain('Z1')
})

test('una sesión recién abierta (sin marca aún) no se ve a sí misma como paralela', async ($, on) => {
  const win = (p: string) => p.split('/').join(String.fromCharCode(92))
  const ses = JSON.stringify({ kind: 'interactive', cwd: win('C:/proj'), name: 'proj-a', status: 'idle', sessionId: 'a' })
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : /\.jsonl$/.test(e.path) ? { value: '' } : /sessions/.test(e.path) ? { value: ses } : { value: MD }) as never)
  on('fs.list', (_, e: any) => ({ value: /sessions$/.test(e.path ?? '') ? [{ name: 'a.json', kind: 'file' }] : [] }) as never)
  on('model.complete', () => ({ value: { isAnswered: false, usage: {} } }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: win('C:/proj'), surface: 'terminal', isInteractive: true })
  for (let n = 0; n < 2; n++) { await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never); await new Promise(r => setTimeout(r, 50)) }
  const all = (await (await $.ui.mount({ ...PANE, surface: 'terminal' } as never)).findAll({ type: 'Text' })).map(t => t.text).join('\n')
  expect(all).toContain('SESIÓN PRINCIPAL')
  expect(all).not.toContain('PARALELA')
})

test('el panel cuenta lo que haiku marca y añade en la SESIÓN; el proyecto no se mueve', async ($, on) => {
  let file = MD
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('turn.complete', (_, e) => ({ text: e.answer }) as never)
  on('fs.read', (_, e: any) => (/lang[\/]\w+\.json$/.test(e.path) ? readFile(_, e) : { value: file }) as never)
  on('fs.write', (_, e: any) => (/whatnow-live/.test(e.path ?? '') || (file = e.content ?? e.text ?? e.data), { value: undefined }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Tarea: frase de haiku\n- [x] paso cuatro\n- [ ] tarea propuesta', usage: {} } }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 1000, window: 200_000 }, rateLimits: [], changed: ['context'] } as never)
  await $.turn.complete({ answer: 'hecho', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 80))
  const all = (await (await $.ui.mount({ ...PANE, surface: 'terminal' } as never)).findAll({ type: 'Text' })).map(x => x.text).join('\n')
  expect(all).toContain('Frase de haiku') // la tarea de la sesión la escribe haiku
  expect(all).toContain('80%') // sesión: 4 pasos hechos de 5 (paso cuatro marcado y una tarea nueva)
  expect(all).toContain('Tarea propuesta') // pendiente de la sesión
  expect(all).toContain('Probar el traspaso') // el proyecto sigue como estaba
  expect(all).toContain('50%') // proyecto: 2 de 4
})

test('una sesión -w lee y escribe el PROGRESS.md de la carpeta principal, no el de su copia', async ($, on) => {
  const win = (p: string) => p.split('/').join(String.fromCharCode(92))
  const paths: string[] = []
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (paths.push(e.path), /lang[\/]\w+\.json$/.test(e.path) ? readFile(_, e) : { value: MD }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('settings.read', () => LANG('es'))
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: win('C:/proj/.claude/worktrees/uno'), surface: 'terminal', isInteractive: true })
  const prog = paths.filter(p => p.endsWith('PROGRESS.md'))
  expect(prog.length).toBeGreaterThan(0)
  expect(prog.every(p => p.split(String.fromCharCode(92)).join('/') === 'C:/proj/PROGRESS.md')).toBe(true)
})
