import { describe, expect, test } from 'claude-code/testing'

import { ANIMATIONS, byCheat, byName } from '../hooks/animations'
import { launch } from '../hooks/animations/launch'
import { wait } from '../hooks/animations/wait'
import { stageAt, walk } from '../hooks/animations/walk'
import type { Row } from '../hooks/lib/frame'

const text = (row: Row | undefined) => (row?.spans ?? []).map(span => span.text).join('')
const lines = (rows: readonly Row[]) => rows.map(text)

describe('the registry', () => {
  test('every animation has a unique name and a unique cheat', async () => {
    const names = ANIMATIONS.map(animation => animation.name)
    const cheats = ANIMATIONS.flatMap(animation => (animation.cheat ? [animation.cheat.name] : []))

    expect(new Set(names).size).toBe(names.length)
    expect(new Set(cheats).size).toBe(cheats.length)
    expect(byName('launch')).toBe(launch)
    expect(byName('nope')).toBeUndefined()
  })

  test('a cheat is the prefix, the name, then whatever the animation takes', async () => {
    expect(byCheat('buddy:send-pr')?.animation).toBe(launch)
    expect(byCheat('  buddy:your-turn  ')?.animation).toBe(wait)
    expect(byCheat('buddy:your-turn')?.reply).toBe('Clawd: your turn.')
    expect(byCheat('buddy:nope')).toBeUndefined()
    expect(byCheat('send-pr')).toBeUndefined()
    expect(byCheat('please run buddy:send-pr')).toBeUndefined()
    expect(byCheat('buddy:walk')).toBeUndefined()
  })

  test('every frame of every animation draws rows that stay inside the band', async () => {
    for (const animation of ANIMATIONS) {
      for (const columns of [9, 24, 80]) {
        for (const step of [0, 7, 60]) {
          const stage = stageAt(step, columns)

          for (let frame = 0; frame < (animation.frames ?? 40); frame += 1) {
            for (const row of animation.draw(frame, stage, {})) {
              expect(row.indent >= 0).toBe(true)
              expect(animation.frameMs(frame) > 0).toBe(true)
            }
          }
        }
      }
    }
  })
})

describe('walk', () => {
  test('folds the step count into a there-and-back position', async () => {
    expect([0, 1, 3, 4, 6].map(step => stageAt(step, 12).x)).toEqual([0, 1, 3, 2, 0])
    expect(stageAt(2, 12).facing).toBe('right')
    expect(stageAt(3, 12).facing).toBe('left')
    expect(stageAt(5, 9)).toEqual({ columns: 9, x: 0, facing: 'right' })
  })

  test('is three rows with the feet alternating', async () => {
    const stage = stageAt(0, 40)

    expect(walk.draw(0, stage, {})).toHaveLength(3)
    expect(text(walk.draw(0, stage, {})[2])).toBe('▝▝   ▝▝')
    expect(text(walk.draw(1, stage, {})[2])).toBe('▝▝')
  })
})

describe('launch', () => {
  const stage = stageAt(0, 60)
  const lastFrame = (launch.frames ?? 0) - 1

  test('keeps one height from the first frame to the last', async () => {
    for (let frame = 0; frame <= lastFrame; frame += 1) {
      expect(launch.draw(frame, stage, {})).toHaveLength(9)
    }
  })

  test('grows the ball in four stages and never lets it touch the hands', async () => {
    // A spark may share a row with the ball, so the row is searched, not matched whole.
    const drawn = (frame: number) => lines(launch.draw(frame, stage, {})).join('\n')

    expect(drawn(0)).toContain('∘')
    expect(drawn(5)).toContain('╭──╮')
    expect(drawn(10)).toContain('│  PR  │')
    expect(drawn(15)).toContain('│    PR    │')

    for (let frame = 0; frame <= lastFrame; frame += 1) {
      expect(text(launch.draw(frame, stage, {})[5])).toBe('')
    }
  })

  test('has thrown the ball clean off the band by the last frame, either way', async () => {
    const fromTheLeft = lines(launch.draw(lastFrame, stageAt(0, 60), {})).slice(0, 5)
    const fromTheRight = lines(launch.draw(lastFrame, stageAt(45, 60), {})).slice(0, 5)

    expect(fromTheLeft.join('').includes('PR')).toBe(false)
    expect(fromTheRight.join('').includes('PR')).toBe(false)
  })

  test('throws toward the farther edge and looks that way', async () => {
    const midFlight = lastFrame - 6
    const right = lines(launch.draw(midFlight, stageAt(0, 60), {}))
    const left = lines(launch.draw(midFlight, stageAt(45, 60), {}))

    expect(right[2]).toContain('━━━│    PR    │')
    expect(right[6]).toContain('█▟███▟')
    expect(left[2]).toContain('│    PR    │━━━')
    expect(left[6]).toContain('▟███▟█')
  })
})

describe('wait', () => {
  test('fades out where it stood, then fades in at the left edge', async () => {
    const stage = stageAt(20, 60)

    expect(wait.draw(0, stage, {})[1]).toEqual({
      indent: 20,
      spans: [{ text: '▒▒▒▒▒▒▒▒▒', color: '#d77757', dimColor: true }],
    })
    expect(lines(wait.draw(3, stage, {}))).toEqual(['', '', ''])
    expect(wait.draw(5, stage, {})[1]?.indent).toBe(4)
    expect(wait.draw(7, stage, {})[1]).toEqual({ indent: 0, spans: [{ text: '▝▜██████▀', color: 'text' }] })
  })

  test('waves with the bubble, blinks now and then, and drops the bubble when it cannot fit', async () => {
    const stage = stageAt(20, 60)

    expect(text(wait.draw(8, stage, {})[0])).toContain('< your turn')
    expect(text(wait.draw(8, stage, {})[1])).toBe('▝▜██████▀')
    expect(text(wait.draw(9, stage, {})[1])).toBe('▝▜██████▘')
    expect(text(wait.draw(18, stage, {})[0])).toContain('▂███▂█')
    expect(text(wait.draw(8, stageAt(0, 12), {})[0]).includes('your turn')).toBe(false)
  })

  test('is quick through the teleport and slow for the wave', async () => {
    expect(wait.frameMs(0)).toBe(150)
    expect(wait.frameMs(8)).toBe(300)
    expect(wait.frames).toBe(null)
  })
})

describe('wait, when it ends', () => {
  test('leaves the mascot where it stood until it has reappeared at the left edge', async () => {
    expect(wait.exit?.(0)).toBe('in-place')
    expect(wait.exit?.(4)).toBe('in-place')
    expect(wait.exit?.(5)).toBe('left-edge')
    expect(wait.exit?.(30)).toBe('left-edge')
  })
})
