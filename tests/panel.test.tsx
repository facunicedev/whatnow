import { expect, test } from 'claude-code/testing'

// Diccionarios mínimos: los tests no pueden importar los JSON reales (la paridad es/en se comprueba aparte).
const en = {
  context: 'Context', session: 'Session', project: 'Project', leftSession: 'Left in session', leftProject: 'Left in project',
  nothing: 'nothing', sessionHeading: 'This session', statusLabel: 'Status:', side: 'Shown at the side.', band: 'Shown above the prompt.',
  sideNarrow: ' Note: {columns} columns{noFs}', noFs: ', not fullscreen', limitSet: 'Context limit: {n}k', paneTitle: 'What now',
  agents: 'Subagents', usage: 'Usage', usage5h: 'Usage 5h', usage7d: 'Usage week', noUsage: 'no data', mainSession: 'Main session', parallel: 'Parallel session', left: 'Left', taskLabel: 'Task:',
  langSet: 'Language: {lang} (saved).', handoffPrompt: '{why} handoff in {handoff}', whyFull: 'Context is full ({n}k).', toastFull: 'Context full',
}
const es = {
  ...en, context: 'Contexto', session: 'Sesión', project: 'Proyecto', leftSession: 'Falta en la sesión', leftProject: 'Falta en el proyecto',
  nothing: 'nada', sessionHeading: 'Esta sesión', statusLabel: 'Estado:', side: 'En el lateral (se recuerda).', band: 'Encima del prompt (se recuerda).',
  agents: 'Subagentes', usage: 'Uso', usage5h: 'Uso 5 horas', usage7d: 'Uso semana', noUsage: 'sin datos', mainSession: 'Sesión principal', parallel: 'Sesión paralela', left: 'Falta', taskLabel: 'Tarea:',
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
  expect(texts).toContain('· probar el traspaso\n· usarlo en un proyecto')
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
  on('fs.write', (_, e: any) => (written.push(e.content ?? e.text ?? e.data), { value: undefined }) as never)
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
  const PAR = ['# x', '', '## Esta sesión', 'Tarea: arreglar el login', '- [x] a', '- [ ] b', '- [ ] c', '- [ ] d'].join('\n')
  const MAIN = MD.replace('## Esta sesión', '## Esta sesión\nTarea: probar el traspaso')
  on('command.register', () => ({ value: { command: 'whatnow' } }))
  on('fs.read', (_, e: any) => (/lang[\\/]\w+\.json$/.test(e.path) ? readFile(_, e) : { value: /worktrees[\\/]uno/.test(e.path) ? PAR : MAIN }) as never)
  on('settings.read', () => LANG('es'))
  on('fs.list', (_, e: any) => ({ value: /worktrees/.test(e.path ?? '') ? [{ name: 'uno', kind: 'dir' }, { name: 'nota.txt', kind: 'file' }] : [] }) as never)
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 140_000, window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }, { kind: 'seven_day', percentUsed: 75 }], changed: ['context'] } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const nodes = await pane.findAll({ type: 'Text' })
  const all = nodes.map(t => t.text).join('\n')
  expect(all).toContain('24%') // 23.5 redondeado
  expect(all).toContain('75%') // semana (y sesión principal)
  expect(all).toContain('Sesión principal')
  expect(all).toContain('probar el traspaso') // tarea de la sesión principal
  expect(all).toContain('Sesión paralela: uno')
  expect(all).toContain('arreglar el login')
  expect(all).toContain('25%') // paralela: 1 de 4
  expect(all).not.toContain('nota.txt') // solo carpetas
  expect(all.indexOf('Uso 5 horas')).toBeLessThan(all.indexOf('Sesión principal'))
  expect(all.indexOf('Sesión paralela')).toBeLessThan(all.indexOf('Proyecto'))
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
  expect(all).toContain('Subagentes (1)')
  expect(all).toContain('buscar usos de agent.list (Explore)')
  expect(all).not.toContain('ya terminado')
  await pane.unmount()
})
