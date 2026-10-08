import { ARMS, FEET, SPRITE_COLUMNS, SWEAT, SWEAT_COLOR, mascot } from '../lib/body'
import type { Gaze } from '../lib/body'
import { frameIn, layRow } from '../lib/frame'
import type { Animation, Director, Params, Row, Span, Stage, Triggers } from '../lib/frame'
import { STRIDE, ahead } from './walk'

const FRAME_MS = 125

// It paces slowly at first, picks up after five seconds, and is sweating after fifteen.
const HURRIED_AFTER_FRAMES = 40
const WORRIED_AFTER_FRAMES = 120
const CALM_STEP_FRAMES = 3
const HURRIED_STEP_FRAMES = 2

// A lap: a few steps out, a stop to ponder, the same steps back, another stop.
const PACE_STEPS = 6
const PONDER_STEPS = 3
const LEG_STEPS = PACE_STEPS + PONDER_STEPS
const GLANCE_STEP = 3
const BLINK_EVERY = 16

const THOUGHTS = ['.', '. o', '. o O', '. o O'] as const
const THOUGHT_FRAMES = 3
const THOUGHT_COLUMNS = Math.max(...THOUGHTS.map(thought => thought.length))
const THOUGHT_COLOR = 'inactive'
const BESIDE_GAP = 2
const FLUSHED = '#e5533d'

// The idea: it stops where it is, hands up, a mark where the thought was.
const AHA_FRAMES = 8
const FLASH_FRAMES = 2
const AHA = '!'
// A thought shorter than two seconds ends without one.
const AHA_AFTER_FRAMES = 16
const CHEAT_SECONDS = 8
const LONGEST_CHEAT_SECONDS = 60

type Extra = { row: number; at: number; span: Span }
type Spot = { at: number; side: 'left' | 'right' }

// How many steps it has taken by `frame`.
const stepsAt = (frame: number) => {
  const calm = Math.min(frame, HURRIED_AFTER_FRAMES)

  return Math.floor(calm / CALM_STEP_FRAMES) + Math.floor((frame - calm) / HURRIED_STEP_FRAMES)
}

// Where a step count puts it in its lap: how far out along the walk, which leg, and which beat of a stop.
const paceAt = (steps: number) => {
  const lap = steps % (LEG_STEPS * 2)
  const isSecondLeg = lap >= LEG_STEPS
  const leg = lap % LEG_STEPS
  const walked = Math.min(leg, PACE_STEPS)

  return {
    out: isSecondLeg ? PACE_STEPS - walked : walked,
    isSecondLeg,
    leg,
    pondering: leg < PACE_STEPS ? undefined : leg - PACE_STEPS,
  }
}

// A thought that has been told when to stop holds the pace it had reached.
const pacedAt = (frame: number, params: Params) =>
  paceAt(stepsAt(Math.min(frame, frameIn(params, 'until') ?? frame)))

const flip = (facing: Stage['facing']) => (facing === 'right' ? 'left' : 'right')

// Room for a thought beside the head: to the right while there is some, else to the left.
const spotAt = (x: number, columns: number): Spot | undefined => {
  const right = x + SPRITE_COLUMNS + BESIDE_GAP
  const left = x - BESIDE_GAP - THOUGHT_COLUMNS

  if (right + THOUGHT_COLUMNS <= columns) {
    return { at: right, side: 'right' }
  }

  return left >= 0 ? { at: left, side: 'left' } : undefined
}

// Whatever sits in the spot starts at the head and trails away from it.
const inSpot = (spot: Spot | undefined, text: string, look: Omit<Span, 'text'>): Extra[] => {
  if (spot === undefined) {
    return []
  }

  return spot.side === 'right'
    ? [{ row: 0, at: spot.at, span: { ...look, text } }]
    : [{ row: 0, at: spot.at + THOUGHT_COLUMNS - text.length, span: { ...look, text: [...text].reverse().join('') } }]
}

// The drop goes on the side the thought is not.
const sweatAt = (frame: number, x: number, columns: number, spot: Spot | undefined): Extra[] => {
  const drop = SWEAT[Math.floor(frame / HURRIED_STEP_FRAMES) % SWEAT.length] ?? SWEAT[0]
  const at = spot?.side === 'right' ? x - BESIDE_GAP : x + SPRITE_COLUMNS + 1

  return at >= 0 && at < columns ? [{ row: drop.row, at, span: { text: drop.glyph, color: SWEAT_COLOR } }] : []
}

const withExtras = (body: readonly Row[], extras: readonly Extra[]): Row[] =>
  body.map((row, index) =>
    layRow([
      { at: row.indent, spans: row.spans },
      ...extras.filter(extra => extra.row === index).map(extra => ({ at: extra.at, spans: [extra.span] })),
    ]),
  )

const aha = (frame: number, x: number, columns: number): Row[] =>
  withExtras(
    mascot(x, ARMS.up, 'ahead', FEET.both, frame < FLASH_FRAMES ? { tint: 'text' } : {}),
    inSpot(spotAt(x, columns), AHA, { color: 'warning', bold: true }),
  )

// While the model thinks it loops; `until` is set once the thought is over, and from there it has its idea and ends.
//   until  the frame the thought ended at
export const think: Animation = {
  name: 'think',
  priority: 1,
  frames: null,
  framesFor: params => {
    const until = frameIn(params, 'until')

    return until === undefined ? null : until + AHA_FRAMES
  },
  frameMs: () => FRAME_MS,
  // It has paced away from where it stood, and the walk carries on from there.
  exit: (frame, params) => ({ steps: pacedAt(frame, params).out }),
  cheat: {
    name: 'think',
    params: (typed): Params => {
      const asked = Number(typed)
      const seconds =
        typed !== '' && Number.isFinite(asked) ? Math.min(Math.max(asked, 1), LONGEST_CHEAT_SECONDS) : CHEAT_SECONDS

      return { until: String(Math.round((seconds * 1000) / FRAME_MS)) }
    },
    reply: () => 'Clawd: thinking.',
  },

  draw: (frame, stage, params) => {
    const until = frameIn(params, 'until')
    const { out, isSecondLeg, leg, pondering } = pacedAt(frame, params)
    const { x } = ahead(stage, out)

    if (until !== undefined && frame >= until) {
      return aha(frame - until, x, stage.columns)
    }

    const isPondering = pondering !== undefined
    // The second leg retraces the first, and a stop looks the way the next leg goes.
    const way =
      isSecondLeg === isPondering ? ahead(stage, out).facing : flip(ahead(stage, Math.max(0, out - 1)).facing)
    const isBlinking = frame % BLINK_EVERY === BLINK_EVERY - 1
    const gaze: Gaze = isPondering
      ? pondering === PONDER_STEPS - 1
        ? way
        : 'closed'
      : isBlinking
        ? 'closed'
        : leg === GLANCE_STEP
          ? 'ahead'
          : way
    const isWorried = frame >= WORRIED_AFTER_FRAMES
    const spot = spotAt(x, stage.columns)
    const thought = THOUGHTS[Math.floor(frame / THOUGHT_FRAMES) % THOUGHTS.length] ?? THOUGHTS[0]

    return withExtras(
      mascot(
        x,
        isPondering ? ARMS.oneUp : ARMS.down,
        gaze,
        isPondering ? FEET.both : (STRIDE[stepsAt(frame) % STRIDE.length] ?? FEET.both),
        isWorried ? { tint: FLUSHED } : {},
      ),
      [
        ...inSpot(spot, thought, { color: THOUGHT_COLOR }),
        ...(isWorried ? sweatAt(frame, x, stage.columns, spot) : []),
      ],
    )
  },
}

// A thought that was long enough ends on its idea; a short one just stops.
const conclude = (director: Director) => {
  const reached = director.frameOf(think)

  if (reached === undefined || reached < AHA_AFTER_FRAMES) {
    director.stop(think)

    return
  }

  director.play(think, { until: String(reached) })
}

export const thinkTriggers: Triggers = (on, director) => {
  on('turn.step', async function* ($, e, next) {
    // A subagent thinks out of sight.
    if (e.agentId !== undefined) {
      return yield* next(e)
    }

    let isThinking = false

    try {
      for await (const chunk of next(e)) {
        if (chunk.kind === 'thinking' && !isThinking) {
          isThinking = true
          // One that follows another starts over, from where the last one left the mascot.
          director.stop(think)
          director.play(think)
        } else if (isThinking && (chunk.kind === 'text' || chunk.kind === 'tool' || chunk.kind === 'stop')) {
          isThinking = false
          conclude(director)
        }

        yield chunk
      }
    } finally {
      // Interrupted mid-thought, nothing came of it.
      if (isThinking) {
        director.stop(think)
      }
    }
  })
}
