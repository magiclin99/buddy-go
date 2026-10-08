import { ARMS, BODY, FEET, bubbleFits, mascot } from '../lib/body'
import { BLANK_ROW } from '../lib/frame'
import type { Animation, Row, Triggers } from '../lib/frame'
import { STEP_MS } from './walk'

const CLOSING_LINES = 3
const QUESTION_END = /[?？][\s*_`"'”」)）]*$/

// A reply often asks its question and then adds a closing line, so the last few lines count, not just the last.
export const asksThePerson = (answer: string) =>
  answer
    .split('\n')
    .filter(line => line.trim() !== '')
    .slice(-CLOSING_LINES)
    .some(line => QUESTION_END.test(line))

const TELEPORT_FRAME_MS = 150
const VANISH_FRAMES = 3
const GAP_FRAMES = 2
const APPEAR_FRAMES = 3
const TELEPORT_FRAMES = VANISH_FRAMES + GAP_FRAMES + APPEAR_FRAMES
const BLINK_EVERY = 12
const BUBBLE = '< your turn'

// Densest first: played forward the mascot fades out, backward it fades in.
const GHOSTS = [
  [
    { indent: 1, glyphs: '▒▒▒▒▒▒▒' },
    { indent: 0, glyphs: '▒▒▒▒▒▒▒▒▒' },
    { indent: 1, glyphs: '▒▒   ▒▒' },
  ],
  [
    { indent: 1, glyphs: '░ ░░ ░░' },
    { indent: 0, glyphs: '░░ ░░░ ░░' },
    { indent: 1, glyphs: '░░   ░░' },
  ],
  [
    { indent: 2, glyphs: '·   ·' },
    { indent: 4, glyphs: '·' },
    { indent: 2, glyphs: '·   ·' },
  ],
] as const

const ghost = (at: number, rows: (typeof GHOSTS)[number]): Row[] =>
  rows.map(row => ({ indent: at + row.indent, spans: [{ text: row.glyphs, color: BODY, dimColor: true }] }))

export const wait: Animation = {
  name: 'wait',
  priority: 1,
  frames: null,
  // The teleport is quick; the wave after it only needs the walk's slower beat.
  frameMs: frame => (frame < TELEPORT_FRAMES ? TELEPORT_FRAME_MS : STEP_MS),
  // Stopped before it reappears, the mascot never left; after, it stands at the left edge.
  exit: frame => (frame < VANISH_FRAMES + GAP_FRAMES ? 'in-place' : 'left-edge'),
  cheat: { name: 'your-turn', reply: () => 'Clawd: your turn.' },

  draw: (frame, { columns, x }) => {
    if (frame < VANISH_FRAMES) {
      return ghost(x, GHOSTS[frame] ?? GHOSTS[0])
    }

    const appearing = frame - VANISH_FRAMES - GAP_FRAMES

    if (appearing < 0) {
      return [BLANK_ROW, BLANK_ROW, BLANK_ROW]
    }

    if (appearing < APPEAR_FRAMES - 1) {
      return ghost(0, GHOSTS[GHOSTS.length - 1 - appearing] ?? GHOSTS[0])
    }

    if (appearing === APPEAR_FRAMES - 1) {
      return mascot(0, ARMS.down, 'ahead', FEET.both, { tint: 'text' })
    }

    const beat = frame - TELEPORT_FRAMES

    return mascot(
      0,
      beat % 2 === 1 ? ARMS.oneUp : ARMS.down,
      beat % BLINK_EVERY === BLINK_EVERY - 2 ? 'closed' : 'ahead',
      FEET.both,
      bubbleFits(columns, BUBBLE) ? { says: BUBBLE } : {},
    )
  },
}

export const waitTriggers: Triggers = (on, director) => {
  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined && asksThePerson(e.answer)) {
      director.play(wait)
    }

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    director.stop(wait)

    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    director.play(wait)

    try {
      return await next(e)
    } finally {
      director.stop(wait)
    }
  })
}
