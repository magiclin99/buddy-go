import { ARMS, FEET, GHOSTS, SPRITE_COLUMNS, SWEAT, SWEAT_COLOR, ghost, mascot } from '../lib/body'
import { frameIn, layRow } from '../lib/frame'
import type { Animation, Params, Piece, Row, Span, Stage, Triggers } from '../lib/frame'
import { opensPr } from './launch'
import { middle } from './walk'

const INTRO_FRAME_MS = 100
const FRAME_MS = 80

// The opening, in order: the world appears, the mascot fades out where it walked and in at the middle of the
// band, sets itself, pulls back, and only then runs.
const WORLD_FRAMES = 2
const VANISH_FRAMES = 3
const GAP_FRAMES = 2
const APPEAR_FRAMES = 3
const SET_FRAMES = 3
const WIND_UP_FRAMES = 3
const REAPPEAR_FRAME = WORLD_FRAMES + VANISH_FRAMES + GAP_FRAMES
const SET_FRAME = REAPPEAR_FRAME + APPEAR_FRAMES
const WIND_UP_FRAME = SET_FRAME + SET_FRAMES
const INTRO_FRAMES = WIND_UP_FRAME + WIND_UP_FRAMES

const STEP_FRAMES = 2
const TIRED_AFTER_FRAMES = 125
const GASP_EVERY = 8
const GASP_FRAMES = 2
// Once the last command is back it runs on this long: a command that comes in the meantime finds it running.
const LINGER_FRAMES = 38
// How long a command's result shows beside the head while it runs on.
const MARK_FRAMES = 10
const END_FRAMES = 16
const STUMBLE_FRAMES = 2
// Six seconds from the cheat to its cheer.
const CHEAT_FRAMES = INTRO_FRAMES + 55

const ROWS = 3
// The feet share their row with the ground.
const GROUND_ROW = 2
const GROUND_COLOR = 'inactive'
// Drawn through the middle of the row; the pebbles are what shows it moving.
const GROUND = '────────·──────────────·─────·───────────'
const COMMAND_COLUMNS = 24
const BANNER_COLOR = '#f2c94c'
const BANNER_INK = '#000000'
const ROPE_COLUMNS = 7
// The tail, and the cloth's two edges.
const BANNER_TRIM_COLUMNS = 3
const SHORTEST_BANNER = 4
const UNFURL_FRAMES = 6
const FLUTTER_FRAMES = 2
const MARK_GAP = 2
const PASSED: Span = { text: 'Finish!', color: 'success', bold: true }
const FAILED: Span = { text: 'Oops!', color: 'error', bold: true }

const LEAF = '#6aa84f'
const TRUNK = '#a47148'

type Thing = readonly { row: number; indent: number; glyphs: string; color: string }[]

// What stands on the ground and goes by at its speed. A trunk is a stem rising out of the ground's own line.
const THINGS: readonly Thing[] = [
  [
    { row: 0, indent: 1, glyphs: '▟█▙', color: LEAF },
    { row: 1, indent: 0, glyphs: '▟███▙', color: LEAF },
    { row: GROUND_ROW, indent: 2, glyphs: '╨', color: TRUNK },
  ],
  [
    { row: 1, indent: 0, glyphs: '▟█▙', color: LEAF },
    { row: GROUND_ROW, indent: 1, glyphs: '┴', color: TRUNK },
  ],
  [{ row: GROUND_ROW, indent: 0, glyphs: '▄▆▄', color: LEAF }],
]
const THING_SLOT = 14
const WIDEST_THING = 5

// Kicked up behind the feet as it sets off, by frames run.
const DUST = [
  { until: 2, behind: 2, glyph: '∘' },
  { until: 4, behind: 4, glyph: '·' },
] as const

type Cell = { glyph: string; color?: string; dimColor?: true } | undefined
type Extra = { row: number; at: number; span: Span }
// A stretch of a row the world is kept out of, beyond the mascot's own box.
type Cover = { row: number; at: number; columns: number }
type Actor = { box: number | null; rows: readonly Row[]; extras: readonly Extra[]; covers?: readonly Cover[] }

// The same answer for the same number every time it is drawn, and no pattern a person would notice.
const noise = (seed: number) => Math.imul(seed + 1, 0x9e3779b1) >>> 16

// A blank in what is stamped clears the cell: the command keeps a column of air on each side.
const stamp = (cells: Cell[] | undefined, column: number, glyphs: string, color: string) => {
  for (const [index, glyph] of [...glyphs].entries()) {
    const at = column + index

    if (cells !== undefined && at >= 0 && at < cells.length) {
      cells[at] = glyph === ' ' ? undefined : { glyph, color }
    }
  }
}

// Lays spans over what is there, a blank in them leaving it be: the ground shows between the feet.
const overlay = (cells: Cell[], column: number, spans: readonly Span[]) => {
  let at = column

  for (const span of spans) {
    at += span.gap ?? 0

    for (const glyph of span.text) {
      if (glyph !== ' ' && at >= 0 && at < cells.length) {
        cells[at] = {
          glyph,
          ...(span.color === undefined ? {} : { color: span.color }),
          ...(span.dimColor === true ? { dimColor: true } : {}),
        }
      }

      at += 1
    }
  }
}

// Every other slot of a tape holds one thing, somewhere inside the slot; `scroll` is the column the band starts at.
const scatter = (rows: Cell[][], columns: number, scroll: number, slot: number, things: readonly Thing[]) => {
  for (let index = Math.floor(scroll / slot); index * slot < scroll + columns; index += 1) {
    const thing = things[noise(index * 2) % (things.length * 2)]
    const column = index * slot + (noise(index * 2 + 1) % (slot - WIDEST_THING)) - scroll

    for (const part of thing ?? []) {
      stamp(rows[part.row], column + part.indent, part.glyphs, part.color)
    }
  }
}

// A Text's own leading and trailing spaces are not kept everywhere, so a row is runs of one look with gaps between.
const piecesOf = (cells: readonly Cell[]): Piece[] => {
  const pieces: { at: number; text: string; color?: string; dimColor?: true }[] = []

  for (const [column, cell] of cells.entries()) {
    const last = pieces.at(-1)

    if (cell === undefined) {
      continue
    }

    if (
      last !== undefined &&
      last.color === cell.color &&
      last.dimColor === cell.dimColor &&
      last.at + last.text.length === column
    ) {
      last.text += cell.glyph
    } else {
      pieces.push({ ...cell, at: column, text: cell.glyph })
    }
  }

  return pieces.map(({ at, text, color, dimColor }) => ({
    at,
    spans: [{ text, ...(color === undefined ? {} : { color }), ...(dimColor === true ? { dimColor } : {}) }],
  }))
}

// One line of plain characters: anything wider than a column would push the banner out of shape.
const brief = (command: string | undefined) => {
  const line = (command ?? '').trim().split('\n')[0] ?? ''
  const plain = /^[\x20-\x7e]*/.exec(line)?.[0] ?? ''
  const text = plain.replace(/ +/g, ' ').trim()

  return text.length > COMMAND_COLUMNS || plain.length < line.length
    ? `${text.slice(0, COMMAND_COLUMNS - 1)}…`
    : text
}

// The ground is one long tape the band looks at through a window that moves a column a frame.
const ground = (columns: number, scroll: number): Cell[] =>
  Array.from({ length: columns }, (_, column) => ({
    glyph: GROUND[(scroll + column) % GROUND.length] ?? '─',
    color: GROUND_COLOR,
  }))

// The whole picture: what goes by, with the mascot in front of it. Only the world scrolls. The ground runs
// along the row the feet are on, and gives way only to the feet themselves.
const scene = ({ columns }: Stage, scroll: number, actor: Actor): Row[] => {
  const world: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: columns }, () => undefined))

  scatter(world, columns, scroll, THING_SLOT, THINGS)

  const extras = actor.extras.filter(extra => extra.at >= 0 && extra.at + extra.span.text.length <= columns)

  // Nothing of the world shows through the mascot, or through what is drawn around it.
  for (const cells of world) {
    if (actor.box !== null) {
      stamp(cells, actor.box, ' '.repeat(SPRITE_COLUMNS), '')
    }
  }

  for (const extra of extras) {
    stamp(world[extra.row], extra.at, ' '.repeat(extra.span.text.length), '')
  }

  for (const cover of actor.covers ?? []) {
    stamp(world[cover.row], cover.at, ' '.repeat(cover.columns), '')
  }

  return world.map((cells, index) => {
    const body = actor.rows[index]
    const beside = extras.filter(extra => extra.row === index)

    if (index !== GROUND_ROW) {
      return layRow([
        ...piecesOf(cells),
        ...(body === undefined ? [] : [{ at: body.indent, spans: body.spans }]),
        ...beside.map(extra => ({ at: extra.at, spans: [extra.span] })),
      ])
    }

    const floor = ground(columns, scroll)

    for (const [column, cell] of cells.entries()) {
      if (cell !== undefined) {
        floor[column] = cell
      }
    }

    if (body !== undefined) {
      overlay(floor, body.indent, body.spans)
    }

    for (const extra of beside) {
      overlay(floor, extra.at, [extra.span])
    }

    return layRow(piecesOf(floor))
  })
}

// What it tows: the command on a strip of cloth, on a rope from its waist. The rope and the cloth's tail
// flutter; the cloth itself holds still, so it can be read. Nothing of the world shows between the two.
const banner = (ran: number, at: number, command: string): { extras: Extra[]; covers: Cover[] } => {
  const room = at - ROPE_COLUMNS - BANNER_TRIM_COLUMNS

  if (command === '' || room < SHORTEST_BANNER) {
    return { extras: [], covers: [] }
  }

  const text = command.length > room ? `${command.slice(0, room - 1)}…` : command
  // It unrolls from the rope's end, so its last letters are out first.
  const out = Math.ceil((text.length * Math.min(UNFURL_FRAMES, ran + 1)) / UNFURL_FRAMES)
  const shown = text.slice(text.length - out).trimStart()
  const end = at - ROPE_COLUMNS
  const start = end - shown.length - BANNER_TRIM_COLUMNS
  const isFlapping = Math.floor(ran / FLUTTER_FRAMES) % 2 === 0
  const rope = Array.from({ length: ROPE_COLUMNS }, (_, column) => column)
    .filter(column => column % 2 === (isFlapping ? 0 : 1))
    .map(column => ({ row: 1, at: end + column, span: { text: '─', color: GROUND_COLOR } }))

  return {
    extras: [
      { row: 1, at: start, span: { text: isFlapping ? '≈' : '~', color: BANNER_COLOR } },
      { row: 1, at: start + 1, span: { text: '▐', color: BANNER_COLOR } },
      { row: 1, at: start + 2, span: { text: shown, color: BANNER_INK, backgroundColor: BANNER_COLOR } },
      { row: 1, at: end - 1, span: { text: '▌', color: BANNER_COLOR } },
      ...rope,
    ],
    covers: [{ row: 1, at: start, columns: at - start }],
  }
}

const runner = (ran: number, at: number, command: string): Actor => {
  const isTired = ran >= TIRED_AFTER_FRAMES
  const isLeftStep = Math.floor(ran / STEP_FRAMES) % 2 === 0
  const isGasping = isTired && ran % GASP_EVERY >= GASP_EVERY - GASP_FRAMES
  const sweat = SWEAT[Math.floor(ran / STEP_FRAMES) % SWEAT.length] ?? SWEAT[0]
  const dust = DUST.find(puff => ran < puff.until)
  const towed = banner(ran, at, command)

  return {
    covers: towed.covers,
    box: at,
    rows: mascot(
      at,
      isLeftStep ? ARMS.oneUp : ARMS.otherUp,
      isGasping ? 'closed' : 'right',
      isLeftStep ? FEET.left : FEET.right,
    ),
    extras: [
      ...towed.extras,
      ...(isTired ? [{ row: sweat.row, at: at + SPRITE_COLUMNS + 1, span: { text: sweat.glyph, color: SWEAT_COLOR } }] : []),
      ...(dust === undefined ? [] : [{ row: GROUND_ROW, at: at - dust.behind, span: { text: dust.glyph, color: GROUND_COLOR } }]),
    ],
  }
}

const actorAt = (frame: number, { columns, x }: Stage, command: string): Actor => {
  const center = middle(columns)

  // Already in the middle, it has nowhere to fade to.
  if (frame < WORLD_FRAMES || (x === center && frame < SET_FRAME)) {
    return { box: x, rows: mascot(x, ARMS.down, 'ahead', FEET.both), extras: [] }
  }

  if (frame < WORLD_FRAMES + VANISH_FRAMES) {
    return { box: x, rows: ghost(x, GHOSTS[frame - WORLD_FRAMES] ?? GHOSTS[0]), extras: [] }
  }

  if (frame < REAPPEAR_FRAME) {
    return { box: null, rows: [], extras: [] }
  }

  if (frame < SET_FRAME - 1) {
    return { box: center, rows: ghost(center, GHOSTS[GHOSTS.length - 1 - (frame - REAPPEAR_FRAME)] ?? GHOSTS[0]), extras: [] }
  }

  if (frame < SET_FRAME) {
    return { box: center, rows: mascot(center, ARMS.down, 'ahead', FEET.both, { tint: 'text' }), extras: [] }
  }

  if (frame < WIND_UP_FRAME) {
    return { box: center, rows: mascot(center, ARMS.down, 'right', FEET.both), extras: [] }
  }

  if (frame < INTRO_FRAMES) {
    const back = Math.max(0, center - 1)

    return { box: back, rows: mascot(back, ARMS.otherUp, 'right', FEET.left), extras: [] }
  }

  return runner(frame - INTRO_FRAMES, center, command)
}

// How a run ends, in the middle of a world that has stopped: a cheer, or a stumble a column on.
const finisher = (frame: number, hasPassed: boolean, { columns }: Stage): Actor => {
  const center = middle(columns)
  const isStumbling = !hasPassed && frame < STUMBLE_FRAMES
  const at = isStumbling ? Math.min(center + 1, Math.max(0, columns - SPRITE_COLUMNS)) : center

  return {
    box: at,
    rows: hasPassed
      ? mascot(at, ARMS.up, 'ahead', FEET.both)
      : mascot(at, ARMS.down, 'closed', isStumbling ? FEET.left : FEET.both),
    extras: [],
  }
}

// Before it has reappeared the mascot never left; after, the middle is where it is.
const leftAt = (frame: number) => (frame < REAPPEAR_FRAME ? 'in-place' : 'center')

// One run covers every command that starts before it is over. While a command is out it loops; `until` is
// set once the last one is back, and from there it runs on a while, then stops the world and ends.
//   command  what its banner says           until  the frame the run stops at
//   ok       how the last command went      ended  the frame that one came back at
export const run: Animation = {
  name: 'run',
  priority: 2,
  frames: null,
  framesFor: params => {
    const until = frameIn(params, 'until')

    return until === undefined ? null : until + END_FRAMES
  },
  frameMs: frame => (frame < INTRO_FRAMES ? INTRO_FRAME_MS : FRAME_MS),
  exit: leftAt,
  cheat: {
    name: 'run',
    params: (typed): Params => ({
      ...(typed === '' ? {} : { command: typed }),
      ok: 'true',
      ended: String(CHEAT_FRAMES),
      until: String(CHEAT_FRAMES),
    }),
    reply: params => (params.command === undefined ? 'Clawd: running.' : `Clawd: running ${params.command}.`),
  },

  draw: (frame, stage, params) => {
    const until = frameIn(params, 'until')
    const ended = frameIn(params, 'ended')
    const hasPassed = params.ok === 'true'
    const isOver = until !== undefined && frame >= until
    const scroll = Math.max(0, (isOver ? until : frame) - INTRO_FRAMES)
    const actor = isOver ? finisher(frame - until, hasPassed, stage) : actorAt(frame, stage, brief(params.command))
    const markedFrom = Math.max(ended ?? Number.POSITIVE_INFINITY, INTRO_FRAMES)
    const isMarked = isOver || (frame >= markedFrom && frame < markedFrom + MARK_FRAMES)
    const mark = hasPassed ? PASSED : FAILED

    const beside = middle(stage.columns) + SPRITE_COLUMNS

    return scene(stage, scroll, {
      ...actor,
      extras: [...actor.extras, ...(isMarked ? [{ row: 0, at: beside + MARK_GAP, span: mark }] : [])],
      // A blank on each side of the word, so nothing going by runs into it.
      covers: [
        ...(actor.covers ?? []),
        ...(isMarked ? [{ row: 0, at: beside, columns: MARK_GAP + mark.text.length + 1 }] : []),
      ],
    })
  },
}

// Commands can run side by side; the run is over only once the last of them is back.
let running = 0
let latest: Params = {}

export const runTriggers: Triggers = (on, director) => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // Opening a PR has an animation of its own.
    if (opensPr(e.command)) {
      return next(e)
    }

    let hasPassed = false
    running += 1
    // Asked again while it runs, it carries on from the frame it is on, with this command on its banner.
    latest = { command: e.command }
    director.play(run, latest)

    try {
      const ran = await next(e)
      hasPassed = ran.deny === undefined && ran.isError !== true

      return ran
    } finally {
      running -= 1

      if (running === 0) {
        const reached = director.frameOf(run) ?? 0

        director.play(run, {
          ...latest,
          ok: String(hasPassed),
          ended: String(reached),
          // A command that is back before the opening is over still gets all of it.
          until: String(Math.max(reached, INTRO_FRAMES) + LINGER_FRAMES),
        })
      }
    }
  })
}
