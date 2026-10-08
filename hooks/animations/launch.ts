import { ARMS, FEET, SPRITE_COLUMNS, mascot } from '../lib/body'
import { BLANK_ROW } from '../lib/frame'
import type { Animation, Row, Triggers } from '../lib/frame'

const FRAME_MS = 100
const CHARGE_STAGE_FRAMES = 5
const WIND_UP_FRAMES = 5
const FLIGHT_FRAMES = 12

const BALL_COLOR = '#9be7ff'
const BALL_COLUMNS = 12
const BALL_ROWS = 5
const BALL_MIDDLE_ROW = 2
const SPARK_REACH = 3
const TRAIL = '─ ═ ━━━'

// Smallest first, each bottom-aligned in the ball's 12 by 5 box so it grows upward, away from the head.
const BALLS = [
  [{ row: 4, indent: 6, glyphs: '∘' }],
  [
    { row: 3, indent: 4, glyphs: '╭──╮' },
    { row: 4, indent: 4, glyphs: '╰──╯' },
  ],
  [
    { row: 2, indent: 3, glyphs: '╭────╮' },
    { row: 3, indent: 2, glyphs: '│  PR  │' },
    { row: 4, indent: 3, glyphs: '╰────╯' },
  ],
  [
    { row: 0, indent: 2, glyphs: '╭──────╮' },
    { row: 1, indent: 1, glyphs: '╱        ╲' },
    { row: 2, indent: 0, glyphs: '│    PR    │' },
    { row: 3, indent: 1, glyphs: '╲        ╱' },
    { row: 4, indent: 2, glyphs: '╰──────╯' },
  ],
] as const

const CHARGE_FRAMES = CHARGE_STAGE_FRAMES * BALLS.length

const PR_SKILL = 'gary-pr'
const PR_CREATE = /\bgh\s+pr\s+create\b/
const PR_URL = /https:\/\/\S+\/pull\/\d+/

// Set once the PR skill's prompt reaches the model; the skill may take several turns to open the PR.
let isArmed = false

export const launch: Animation = {
  name: 'launch',
  priority: 2,
  frames: CHARGE_FRAMES + WIND_UP_FRAMES + FLIGHT_FRAMES,
  frameMs: () => FRAME_MS,
  cheat: { name: 'send-pr', reply: () => 'Clawd: PR launched.' },

  draw: (frame, { columns, x }) => {
    const flightFrame = frame - CHARGE_FRAMES - WIND_UP_FRAMES
    const isFlying = flightFrame >= 0
    const isCharging = frame < CHARGE_FRAMES
    const flown = isFlying ? (flightFrame + 1) / FLIGHT_FRAMES : 0
    const restX = Math.max(0, Math.min(x - 2, columns - BALL_COLUMNS))
    // Thrown across the longer stretch of the band, so it always has room to fly.
    const isThrownLeft = x + SPRITE_COLUMNS / 2 > columns / 2
    const travel = isThrownLeft ? -(restX + BALL_COLUMNS) : columns - restX
    // Squared so the ball leaves slowly and is fully past the edge on the last frame.
    const ballX = restX + Math.round(travel * flown * flown)
    const ball = BALLS[Math.min(BALLS.length - 1, Math.floor(frame / CHARGE_STAGE_FRAMES))] ?? BALLS[0]

    // Drawn on a grid of the band's width so whatever passes an edge is simply not there.
    const grid = Array.from({ length: BALL_ROWS }, () => Array.from({ length: columns }, () => ' '))
    const put = (row: number, from: number, glyphs: string) => {
      const cells = grid[row]

      if (cells === undefined) {
        return
      }

      for (const [offset, glyph] of [...glyphs].entries()) {
        if (from + offset >= 0 && from + offset < columns) {
          cells[from + offset] = glyph
        }
      }
    }

    if (isCharging) {
      const reach = SPARK_REACH - (frame % SPARK_REACH)
      put(frame % BALL_ROWS, restX - reach, '·')
      put((frame + 2) % BALL_ROWS, restX + BALL_COLUMNS - 1 + reach, '·')
    }

    for (const line of ball) {
      put(line.row, ballX + line.indent, line.glyphs)
    }

    if (isFlying) {
      const length = Math.min(TRAIL.length, Math.abs(ballX - restX))

      if (isThrownLeft) {
        put(BALL_MIDDLE_ROW, ballX + BALL_COLUMNS, [...TRAIL].reverse().join('').slice(0, length))
      } else {
        put(BALL_MIDDLE_ROW, ballX - length, TRAIL.slice(TRAIL.length - length))
      }
    }

    const sky = grid.map((cells): Row => {
      const drawn = cells.join('').trimEnd()
      const glyphs = drawn.trimStart()

      return glyphs === ''
        ? BLANK_ROW
        : { indent: drawn.length - glyphs.length, spans: [{ text: glyphs, color: BALL_COLOR }] }
    })

    return [
      ...sky,
      BLANK_ROW,
      ...mascot(
        x,
        isFlying ? ARMS.down : ARMS.up,
        isCharging ? 'ahead' : isThrownLeft ? 'left' : 'right',
        FEET.both,
      ),
    ]
  },
}

export const launchTriggers: Triggers = (on, director) => {
  on('skill.prompt', { skill: PR_SKILL }, ($, e, next) => {
    isArmed = true

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!PR_CREATE.test(e.command)) {
      return next(e)
    }

    const ran = await next(e)
    const hasOpened = ran.deny === undefined && ran.isError !== true && PR_URL.test(ran.text ?? '')

    if (hasOpened && isArmed) {
      isArmed = false
      director.play(launch)
    }

    return ran
  })
}
