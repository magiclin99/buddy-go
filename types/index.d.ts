export type Show = {
  name: string
  frame: number
  params: Record<string, string>
  idleFrame: number
  idleFrom?: 'left-edge' | 'center'
}

declare module 'claude-code' {
  interface PluginState {
    'buddy-go': {
      show: Show | null
    }
  }
}
