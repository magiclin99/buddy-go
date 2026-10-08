import type { On } from 'claude-code'

export type Span = {
  text: string
  color?: string
  backgroundColor?: string
  dimColor?: true
  bold?: true
  // Blank columns before the span; a Text's own leading spaces are not kept everywhere.
  gap?: number
}

export type Row = { indent: number; spans: readonly Span[] }

export type Stage = { columns: number; x: number; facing: 'left' | 'right' }

// Where the walk starts counting its steps from.
export type IdleFrom = 'left-edge' | 'center'

export type Params = Readonly<Record<string, string>>

// What an animation's triggers hold: they say what to play and never touch timers, state or `$`.
export type Director = {
  play: (animation: Animation, params?: Params) => void
  stop: (animation: Animation) => void
  // The frame it is on, when it is the one on stage.
  frameOf: (animation: Animation) => number | undefined
}

export type Animation = {
  name: string
  // The higher one plays first; a looping one that gets pushed aside comes back afterwards.
  priority: number
  // null loops until something stops it.
  frames: number | null
  // How long this play of it is, where that depends on what it was asked to play; without it, `frames`.
  framesFor?: (params: Params) => number | null
  frameMs: (frame: number) => number
  // Where it leaves the mascot when it ends at `frame`; absent means where it stood.
  exit?: (frame: number) => 'in-place' | IdleFrom
  cheat?: { name: string; reply: (params: Params) => string; params?: (typed: string) => Params }
  draw: (frame: number, stage: Stage, params: Params) => Row[]
}

// The events that start and stop an animation: a named function its file exports, since the engine only lets `on` be handed to one.
export type Triggers = (on: On, director: Director) => void

export const BLANK_ROW: Row = { indent: 0, spans: [] }

export const width = (spans: readonly Span[]) =>
  spans.reduce((sum, span) => sum + (span.gap ?? 0) + span.text.length, 0)

// Moves a run of spans right by `gap` columns: the blank goes before its first span.
export const withGap = (spans: readonly Span[], gap: number): Span[] =>
  gap === 0 ? [...spans] : spans.map((span, index) => (index === 0 ? { ...span, gap: (span.gap ?? 0) + gap } : span))

export type Piece = { at: number; spans: readonly Span[] }

// One row from pieces that each say which column they start at; they must not overlap.
export const layRow = (pieces: readonly Piece[]): Row => {
  const laid = pieces.filter(piece => piece.spans.length > 0).sort((a, b) => a.at - b.at)
  const indent = laid[0]?.at ?? 0
  const spans: Span[] = []
  let end = indent

  for (const piece of laid) {
    spans.push(...withGap(piece.spans, piece.at - end))
    end = piece.at + width(piece.spans)
  }

  return { indent, spans }
}
