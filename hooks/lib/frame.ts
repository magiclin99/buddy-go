import type { On } from 'claude-code'

export type Span = {
  text: string
  color?: string
  backgroundColor?: string
  dimColor?: true
  // Blank columns before the span; a Text's own leading spaces are not kept everywhere.
  gap?: number
}

export type Row = { indent: number; spans: readonly Span[] }

export type Stage = { columns: number; x: number; facing: 'left' | 'right' }

export type Params = Readonly<Record<string, string>>

// What an animation's triggers hold: they say what to play and never touch timers, state or `$`.
export type Director = {
  play: (animation: Animation, params?: Params) => void
  stop: (animation: Animation) => void
}

export type Animation = {
  name: string
  // The higher one plays first; a looping one that gets pushed aside comes back afterwards.
  priority: number
  // null loops until something stops it.
  frames: number | null
  frameMs: (frame: number) => number
  // Where it leaves the mascot when it ends at `frame`; absent means where it stood.
  exit?: (frame: number) => 'in-place' | 'left-edge'
  cheat?: { name: string; reply: (params: Params) => string; params?: (typed: string) => Params }
  draw: (frame: number, stage: Stage, params: Params) => Row[]
}

// The events that start and stop an animation: a named function its file exports, since the engine only lets `on` be handed to one.
export type Triggers = (on: On, director: Director) => void

export const BLANK_ROW: Row = { indent: 0, spans: [] }
