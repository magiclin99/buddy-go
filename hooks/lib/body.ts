import type { Row, Span } from './frame'

export const BODY = '#d77757'
export const EYE_SOCKET = '#000000'
export const SPRITE_COLUMNS = 9
const EYES_COLUMNS = 6
const BUBBLE_COLUMN = 11

export const SWEAT_COLOR = '#9be7ff'

// A drop beside the head that slides down a row as it alternates.
export const SWEAT = [
  { row: 0, glyph: '˙' },
  { row: 1, glyph: "'" },
] as const

export type Gaze = 'ahead' | 'left' | 'right' | 'closed'

// A lid swaps the two colors, so the eye reads as a thin dark line on the body.
const EYES: Record<Gaze, readonly { glyphs: string; isLid?: true }[]> = {
  ahead: [{ glyphs: '▛███▛█' }],
  left: [{ glyphs: '▟███▟█' }],
  right: [{ glyphs: '█▟███▟' }],
  closed: [{ glyphs: '▂', isLid: true }, { glyphs: '███' }, { glyphs: '▂', isLid: true }, { glyphs: '█' }],
}

export const ARMS = {
  down: { topIndent: 1, topLeft: '▐', topRight: '', torsoIndent: 0, torso: '▝▜██████▀' },
  up: { topIndent: 0, topLeft: '▗▟', topRight: '▄', torsoIndent: 1, torso: '▜██████▘' },
  oneUp: { topIndent: 1, topLeft: '▐', topRight: '▄', torsoIndent: 0, torso: '▝▜██████▘' },
  otherUp: { topIndent: 0, topLeft: '▗▟', topRight: '', torsoIndent: 1, torso: '▜██████▀' },
} as const

export const FEET = {
  both: { indent: 1, glyphs: '▝▝   ▝▝' },
  left: { indent: 1, glyphs: '▝▝' },
  right: { indent: 6, glyphs: '▝▝' },
} as const

export type Arms = (typeof ARMS)[keyof typeof ARMS]
export type Feet = (typeof FEET)[keyof typeof FEET]

export const bubbleFits = (columns: number, says: string) => columns >= BUBBLE_COLUMN + says.length

export const mascot = (
  at: number,
  arms: Arms,
  gaze: Gaze,
  feet: Feet,
  look: { tint?: string; says?: string } = {},
): Row[] => {
  const tint = look.tint ?? BODY
  const top: Span[] = [{ text: arms.topLeft, color: tint }]

  for (const part of EYES[gaze]) {
    top.push(
      part.isLid
        ? { text: part.glyphs, color: EYE_SOCKET, backgroundColor: tint }
        : { text: part.glyphs, color: tint, backgroundColor: EYE_SOCKET },
    )
  }

  if (arms.topRight !== '') {
    top.push({ text: arms.topRight, color: tint })
  }

  if (look.says !== undefined) {
    const topEnd = arms.topIndent + arms.topLeft.length + EYES_COLUMNS + arms.topRight.length

    top.push({ text: look.says, color: 'text', gap: BUBBLE_COLUMN - topEnd })
  }

  return [
    { indent: at + arms.topIndent, spans: top },
    { indent: at + arms.torsoIndent, spans: [{ text: arms.torso, color: tint }] },
    { indent: at + feet.indent, spans: [{ text: feet.glyphs, color: tint }] },
  ]
}

// Densest first: played forward the mascot fades out, backward it fades in.
export const GHOSTS = [
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

export const ghost = (at: number, rows: (typeof GHOSTS)[number]): Row[] =>
  rows.map(row => ({ indent: at + row.indent, spans: [{ text: row.glyphs, color: BODY, dimColor: true }] }))
