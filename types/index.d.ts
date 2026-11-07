export type ProgressText = string
export type Sitio = 'banda' | 'lateral'
export type Dict = Record<string, string>
export type Limite = { kind: string; percentUsed: number; resetsAt?: string }
export type Agente = { id: string; text: string; type: string; name?: string }
export type Abierta = { name: string; status: string; self: boolean; doing?: string }
export type Paralela = { name: string; md: string; mark?: string; status?: string; doing?: string }

declare module 'claude-code' {
  interface PluginState {
    whatnow: {
      tokens: Shaped<number>
      progress: Shaped<ProgressText>
      hidden: Shaped<boolean>
      limit: Shaped<number>
      sitio: Shaped<Sitio>
      strings: Shaped<Dict>
      limits: Shaped<Limite[]>
      parallels: Shaped<Paralela[]>
      agents: Shaped<Agente[]>
      peers: Shaped<Abierta[]>
    }
  }
}
