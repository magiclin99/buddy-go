import { ARMS, FEET, SPRITE_COLUMNS, mascot } from '../lib/body'
import type { Gaze } from '../lib/body'
import { callsApi, hostOf } from '../lib/command'
import { frameIn, withExtras } from '../lib/frame'
import type { Animation, Director, Extra, Params, Row, Span, Stage, Triggers } from '../lib/frame'

const FRAME_MS = 70
// How long the ball takes from one paddle to the other; a rally is there and back.
const FLIGHT_FRAMES = 10
const RALLY_FRAMES = FLIGHT_FRAMES * 2
// A paddle comes down a frame before its hit, and is back up this many frames after it.
const SWING_FRAMES = 2
const WORD_FRAMES = 4
// Once the last call is back it plays on this long: a call that comes in the meantime finds the rally going.
const LINGER_FRAMES = RALLY_FRAMES
const SMASH_FRAMES = 5
const SMASH_PAST = 7
const GONE_FRAMES = 3
const END_FRAMES = FLIGHT_FRAMES + 8
// Four rallies from the cheat to its point.
const CHEAT_FRAMES = RALLY_FRAMES * 4

const SHORTEST_COURT = 12
const LONGEST_COURT = 26
// Room kept past the far paddle for the name of who is on it.
const NAME_COLUMNS = 14
const SHORTEST_NAME = 4
const LONGEST_NAME = 24
const NAME_GAP = 2
const WORD_GAP = 1

const BALL = 'o'
const TABLE_COLOR = '#3f8f6b'
const OURS_COLOR = '#e5533d'
const THEIRS_COLOR = '#5aa9e6'
const POINT: Span = { text: 'Point!', color: 'success', bold: true }
const MISS: Span = { text: 'Miss!', color: 'error', bold: true }

type Side = 1 | -1
// The court runs from the mascot's paddle at 0 to the far one at `length`, toward `side`.
type Court = { side: Side; origin: number; length: number; columns: number }
type Pose = 'ready' | 'swing' | 'cheer' | 'miss'
type Moment = {
  pose: Pose
  farPaddleRow: number
  ball?: { at: number; row: number }
  word?: 'ping' | 'pong'
  mark?: Span
}

// It plays across the longer stretch of the band.
const sideAt = ({ columns, x }: Stage): Side => (x + SPRITE_COLUMNS / 2 > columns / 2 ? -1 : 1)

const courtAt = (stage: Stage): Court | undefined => {
  const side = sideAt(stage)
  const room = side === 1 ? stage.columns - stage.x - SPRITE_COLUMNS : stage.x
  const wanted = Math.max(SHORTEST_COURT, Math.min(LONGEST_COURT, room - 1 - NAME_COLUMNS))
  // An even length puts the net on a column of its own.
  const length = wanted - (wanted % 2)

  return length > room - 1
    ? undefined
    : { side, origin: side === 1 ? stage.x + SPRITE_COLUMNS : stage.x - 1, length, columns: stage.columns }
}

const columnAt = (court: Court, at: number) => court.origin + court.side * at

// Where a word starts that reads outward from a place on the court.
const wordAt = (court: Court, at: number, text: string) =>
  court.side === 1 ? columnAt(court, at) : columnAt(court, at) - text.length + 1

// A paddle hugs the court, whichever end it is at.
const paddle = (side: Side) => (side === 1 ? '▐' : '▌')

// Whether a paddle is down for a hit it makes on `beat`.
const swings = (beat: number, hitOn: number) => (beat - hitOn + 1 + RALLY_FRAMES) % RALLY_FRAMES <= SWING_FRAMES

// The ball rises over the net and comes down to the paddle; `flown` is 0 at the mascot's and 1 at the far one.
const ballAt = (court: Court, flown: number) => ({
  at: 1 + Math.round((court.length - 2) * flown),
  row: Math.sin(Math.PI * flown) > 0.45 ? 0 : 1,
})

const rallyAt = (frame: number, court: Court): Moment => {
  const beat = frame % RALLY_FRAMES
  const flown = (beat < FLIGHT_FRAMES ? beat : RALLY_FRAMES - beat) / FLIGHT_FRAMES

  return {
    pose: swings(beat, 0) ? 'swing' : 'ready',
    farPaddleRow: swings(beat, FLIGHT_FRAMES) ? 1 : 0,
    ball: ballAt(court, flown),
    ...(beat < WORD_FRAMES
      ? { word: 'ping' as const }
      : beat >= FLIGHT_FRAMES && beat < FLIGHT_FRAMES + WORD_FRAMES
        ? { word: 'pong' as const }
        : {}),
  }
}

// A point: the mascot smashes the ball past the far paddle and off the court.
const pointAt = (frame: number, court: Court): Moment => {
  if (frame >= SMASH_FRAMES) {
    return { pose: 'cheer', farPaddleRow: 1, mark: POINT }
  }

  const at = 1 + Math.round(((court.length + SMASH_PAST) * frame) / (SMASH_FRAMES - 1))

  return { pose: 'swing', farPaddleRow: 1, ball: { at, row: at < court.length / 2 ? 1 : 0 } }
}

// A miss: the ball comes back as ever, and goes by under a paddle that stays up.
const missAt = (frame: number, court: Court): Moment => {
  if (frame < FLIGHT_FRAMES) {
    return {
      pose: 'ready',
      farPaddleRow: frame < SWING_FRAMES ? 1 : 0,
      ball: ballAt(court, 1 - frame / FLIGHT_FRAMES),
    }
  }

  const gone = frame - FLIGHT_FRAMES

  return {
    pose: 'miss',
    farPaddleRow: 0,
    mark: MISS,
    ...(gone < GONE_FRAMES ? { ball: { at: -(SPRITE_COLUMNS + 2 + gone * 2), row: 1 } } : {}),
  }
}

const buddy = (x: number, side: Side, pose: Pose): Row[] => {
  const toward: Gaze = side === 1 ? 'right' : 'left'
  const raised = side === 1 ? ARMS.oneUp : ARMS.otherUp

  return mascot(
    x,
    pose === 'cheer' ? ARMS.up : pose === 'ready' ? raised : ARMS.down,
    pose === 'cheer' ? 'ahead' : pose === 'miss' ? 'closed' : toward,
    FEET.both,
  )
}

// Who is on the far paddle, as much of the name as there is room for.
const named = (court: Court, name: string): Extra[] => {
  const from = court.length + NAME_GAP
  const room = court.side === 1 ? court.columns - columnAt(court, from) : columnAt(court, from) + 1

  if (name === '' || room < SHORTEST_NAME) {
    return []
  }

  const text = name.length > room ? `${name.slice(0, room - 1)}…` : name

  return [{ row: 1, at: wordAt(court, from, text), span: { text, color: 'inactive' } }]
}

const scene = (x: number, court: Court, moment: Moment, name: string): Row[] => {
  const { side, length, columns } = court
  const ourPaddleRow = moment.pose === 'swing' || moment.pose === 'miss' ? 1 : 0
  const behind = side === 1 ? x - WORD_GAP - 'ping'.length : x + SPRITE_COLUMNS + WORD_GAP

  const extras: Extra[] = [
    { row: 2, at: Math.min(columnAt(court, 2), columnAt(court, length - 2)), span: { text: '▀'.repeat(length - 3), color: TABLE_COLOR } },
    { row: 1, at: columnAt(court, length / 2), span: { text: '│', color: 'inactive' } },
    { row: ourPaddleRow, at: columnAt(court, 0), span: { text: paddle(side), color: OURS_COLOR } },
    { row: moment.farPaddleRow, at: columnAt(court, length), span: { text: paddle(side === 1 ? -1 : 1), color: THEIRS_COLOR } },
    ...named(court, name),
    ...(moment.ball === undefined
      ? []
      : [{ row: moment.ball.row, at: columnAt(court, moment.ball.at), span: { text: BALL, color: 'text' } }]),
    ...(moment.word === 'ping' ? [{ row: 0, at: behind, span: { text: 'ping', color: 'inactive' } }] : []),
    ...(moment.word === 'pong'
      ? [{ row: 0, at: wordAt(court, length + NAME_GAP, 'pong'), span: { text: 'pong', color: 'inactive' } }]
      : []),
    ...(moment.mark === undefined ? [] : [{ row: 0, at: wordAt(court, 2, moment.mark.text), span: moment.mark }]),
  ]

  return withExtras(
    buddy(x, side, moment.pose),
    extras.filter(extra => extra.at >= 0 && extra.at + extra.span.text.length <= columns),
  )
}

// The last rally ends where its result starts: on the mascot's paddle for a point, on the far one for a miss.
const endsAt = (reached: number, hasWon: boolean) => {
  const from = Math.max(reached, RALLY_FRAMES) + LINGER_FRAMES
  const beat = hasWon ? 0 : FLIGHT_FRAMES

  return from + ((beat - (from % RALLY_FRAMES) + RALLY_FRAMES) % RALLY_FRAMES)
}

// One printable word, short enough for the far end of the band.
const nameOf = (host: string | undefined) => (/^[\x21-\x7e]*/.exec(host ?? '')?.[0] ?? '').slice(0, LONGEST_NAME)

// One game covers every call that starts before it is over. While a call is out it rallies; `until` is set
// once the last one is back, and from there the rally plays out and ends on a point or a miss.
//   host   who is on the far paddle        until  the frame the rally stops at
//   ok     how the last call went
export const pong: Animation = {
  name: 'pong',
  priority: 2,
  frames: null,
  framesFor: params => {
    const until = frameIn(params, 'until')

    return until === undefined ? null : until + END_FRAMES
  },
  frameMs: () => FRAME_MS,
  cheat: {
    name: 'ping-pong',
    params: (typed): Params => {
      const host = nameOf(typed)

      return { ...(host === '' ? {} : { host }), ok: 'true', until: String(CHEAT_FRAMES) }
    },
    reply: params => (params.host === undefined ? 'Buddy: ping pong.' : `Buddy: ping pong with ${params.host}.`),
  },

  draw: (frame, stage, params) => {
    const until = frameIn(params, 'until')
    const hasWon = params.ok === 'true'
    const isOver = until !== undefined && frame >= until
    const court = courtAt(stage)

    // With no room for a table it swings at the air, and the result is all in how it stands.
    if (court === undefined) {
      const pose: Pose = isOver ? (hasWon ? 'cheer' : 'miss') : swings(frame % RALLY_FRAMES, 0) ? 'swing' : 'ready'

      return buddy(stage.x, sideAt(stage), pose)
    }

    const moment = !isOver
      ? rallyAt(frame, court)
      : hasWon
        ? pointAt(frame - until, court)
        : missAt(frame - until, court)

    return scene(stage.x, court, moment, nameOf(params.host))
  },
}

// Calls can be out side by side; the game is over only once the last of them is back.
let calling = 0
let latest: Params = {}

const serve = (director: Director, host: string | undefined) => {
  calling += 1
  // Asked again while it plays, it carries on from the frame it is on, with this host on the far paddle.
  latest = host === undefined ? {} : { host }
  director.play(pong, latest)
}

const settle = (director: Director, hasWon: boolean) => {
  calling -= 1

  if (calling === 0) {
    director.play(pong, {
      ...latest,
      ok: String(hasWon),
      until: String(endsAt(director.frameOf(pong) ?? 0, hasWon)),
    })
  }
}

export const pongTriggers: Triggers = (on, director) => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!callsApi(e.command)) {
      return next(e)
    }

    let hasWon = false
    serve(director, hostOf(e.command))

    try {
      const ran = await next(e)
      hasWon = ran.deny === undefined && ran.isError !== true

      return ran
    } finally {
      settle(director, hasWon)
    }
  })

  on('tool.call', { tool: 'WebFetch' }, async ($, e, next) => {
    let hasWon = false
    serve(director, hostOf(e.url))

    try {
      const ran = await next(e)
      hasWon = ran.deny === undefined && ran.isError !== true

      return ran
    } finally {
      settle(director, hasWon)
    }
  })
}
