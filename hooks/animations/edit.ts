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
const FILE_COLUMNS = 16
const PAGE_GAP = 3

const LINES = ['▬▬▬ ▬▬▬▬▬ ▬▬ ▬▬▬▬', '▬▬ ▬▬▬ ▬▬▬▬▬▬ ▬'] as const

const TYPING_FRAMES = LINE_FRAMES * LINES.length
const PAGE_COLUMNS = Math.max(...LINES.map(line => line.length + CURSOR.length), FILE_MARK.length + FILE_COLUMNS)

const fileLabel = (file: string | undefined): Span[] => {
  const name = file?.split(/[\\/]/).pop() ?? ''

  if (name === '') {
    return []
  }

  const shown = name.length > FILE_COLUMNS ? `${name.slice(0, FILE_COLUMNS - 1)}…` : name

  return [{ text: `${FILE_MARK}${shown}`, color: 'inactive' }]
}

// The page's three rows: the line before, the line being typed, and the file's name.
const page = (frame: number, file: string | undefined): Span[][] => {
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
    fileLabel(file),
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
    reply: params => (params.file === undefined ? 'Clawd: editing.' : `Clawd: editing ${params.file}.`),
  },

  draw: (frame, { columns, x }, params) => {
    const isTyping = frame < TYPING_FRAMES
    const rightOf = x + SPRITE_COLUMNS + PAGE_GAP
    const leftOf = x - PAGE_GAP - PAGE_COLUMNS
    const side = rightOf + PAGE_COLUMNS <= columns ? 'right' : leftOf >= 0 ? 'left' : 'none'
    const isLookingAway = frame < TYPING_FRAMES + REST_FRAMES - LOOK_AWAY_FRAMES
    const gaze: Gaze = side === 'none' || !isLookingAway ? 'ahead' : side
    const arms = !isTyping ? ARMS.down : frame % 2 === 0 ? ARMS.oneUp : ARMS.otherUp
    const body = mascot(x, arms, gaze, FEET.both)

    if (side === 'none') {
      return body
    }

    const pageRows = page(frame, params.file)

    return body.map((row, index): Row => {
      const beside = pageRows[index] ?? []

      if (beside.length === 0) {
        return row
      }

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
