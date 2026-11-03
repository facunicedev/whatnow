export type ProgressText = string
export type Sitio = 'banda' | 'lateral'
export type Dict = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    whatnow: {
      tokens: Shaped<number>
      progress: Shaped<ProgressText>
      hidden: Shaped<boolean>
      limit: Shaped<number>
      sitio: Shaped<Sitio>
      strings: Shaped<Dict>
    }
  }
}
