import { ARMS, FEET, SPRITE_COLUMNS, mascot } from '../lib/body'
import type { Gaze } from '../lib/body'
import { width, withGap } from '../lib/frame'
import type { Animation, Params, Row, Span, Triggers } from '../lib/frame'

const FRAME_MS = 120
const LINE_FRAMES = 8
const REST_FRAMES = 4
const LOOK_AWAY_FRAMES = 2

const LINE_COLOR = 'success'
const CURSOR = '▌'
const FILE_MARK = '✎ '
const PAGE_GAP = 3

const LINES = ['▬▬▬ ▬▬▬▬▬ ▬▬ ▬▬▬▬', '▬▬ ▬▬▬ ▬▬▬▬▬▬ ▬'] as const

const TYPING_FRAMES = LINE_FRAMES * LINES.length
const PAGE_COLUMNS = Math.max(...LINES.map(line => line.length + CURSOR.length))

type Side = 'left' | 'right'

const nameOf = (file: string | undefined) => file?.split(/[\\/]/).pop() ?? ''

// The file's name, whole when there is room for it and cut where there is not.
const fileLabel = (name: string, room: number): Span[] => {
  const columns = room - FILE_MARK.length

  if (name === '' || columns < 1) {
    return []
  }

  const shown = name.length > columns ? `${name.slice(0, columns - 1)}…` : name

  return [{ text: `${FILE_MARK}${shown}`, color: 'inactive' }]
}

// The page goes where the whole name fits, to the right for choice; failing that, on the roomier side.
const sideFor = (rooms: Record<Side, number>, name: string): Side | 'none' => {
  const wanted = Math.max(PAGE_COLUMNS, FILE_MARK.length + name.length)
  const roomier: Side = rooms.right >= rooms.left ? 'right' : 'left'
  const whole = (['right', 'left'] as const).find(side => rooms[side] >= wanted)

  return whole ?? (rooms[roomier] >= PAGE_COLUMNS ? roomier : 'none')
}

// The page's three rows: the line before, the line being typed, and the file's name.
const page = (frame: number, label: Span[]): Span[][] => {
  const isTyping = frame < TYPING_FRAMES
  const lineIndex = isTyping ? Math.floor(frame / LINE_FRAMES) : LINES.length - 1
  const line = LINES[lineIndex] ?? LINES[0]
  const typed = isTyping ? Math.round((line.length * (frame % LINE_FRAMES)) / (LINE_FRAMES - 1)) : line.length
  const before = LINES[lineIndex - 1]
  const current: Span[] = typed === 0 ? [] : [{ text: line.slice(0, typed), color: LINE_COLOR }]

  if (isTyping) {
    current.push({ text: CURSOR, color: 'text' })
  }

  return [
    before === undefined ? [] : [{ text: before, color: LINE_COLOR, dimColor: true }],
    current,
    label,
  ]
}

export const edit: Animation = {
  name: 'edit',
  priority: 2,
  frames: TYPING_FRAMES + REST_FRAMES,
  frameMs: () => FRAME_MS,
  cheat: {
    name: 'edit',
    params: (typed): Params => (typed === '' ? {} : { file: typed }),
    reply: params => (params.file === undefined ? 'Buddy: editing.' : `Buddy: editing ${params.file}.`),
  },

  draw: (frame, { columns, x }, params) => {
    const isTyping = frame < TYPING_FRAMES
    const name = nameOf(params.file)
    const rightOf = x + SPRITE_COLUMNS + PAGE_GAP
    const rooms = { right: columns - rightOf, left: x - PAGE_GAP }
    const side = sideFor(rooms, name)
    const isLookingAway = frame < TYPING_FRAMES + REST_FRAMES - LOOK_AWAY_FRAMES
    const gaze: Gaze = side === 'none' || !isLookingAway ? 'ahead' : side
    const arms = !isTyping ? ARMS.down : frame % 2 === 0 ? ARMS.oneUp : ARMS.otherUp
    const body = mascot(x, arms, gaze, FEET.both)

    if (side === 'none') {
      return body
    }

    const pageRows = page(frame, fileLabel(name, rooms[side]))

    return body.map((row, index): Row => {
      const beside = pageRows[index] ?? []

      if (beside.length === 0) {
        return row
      }

      // On the left the lines keep their column, and a name longer than them reaches further out.
      const leftOf = x - PAGE_GAP - Math.max(PAGE_COLUMNS, width(beside))

      // A Text's own leading and trailing spaces are not kept everywhere, so every blank column is a gap.
      return side === 'right'
        ? { indent: row.indent, spans: [...row.spans, ...withGap(beside, rightOf - row.indent - width(row.spans))] }
        : { indent: leftOf, spans: [...beside, ...withGap(row.spans, row.indent - leftOf - width(beside))] }
    })
  },
}

export const editTriggers: Triggers = (on, director) => {
  on('tool.call', { tool: 'Edit' }, ($, e, next) => {
    director.play(edit, { file: e.file_path })

    return next(e)
  })

  on('tool.call', { tool: 'Write' }, ($, e, next) => {
    director.play(edit, { file: e.file_path })

    return next(e)
  })

  on('tool.call', { tool: 'NotebookEdit' }, ($, e, next) => {
    director.play(edit, { file: e.notebook_path })

    return next(e)
  })
}
