import { describe, expect, test } from 'claude-code/testing'

import { ANIMATIONS, byCheat, byName } from '../hooks/animations'
import { edit } from '../hooks/animations/edit'
import { launch } from '../hooks/animations/launch'
import { run } from '../hooks/animations/run'
import { wait } from '../hooks/animations/wait'
import { stageAt, walk } from '../hooks/animations/walk'
import { width } from '../hooks/lib/frame'
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
    expect(byCheat('buddy:edit launch.ts')?.animation).toBe(edit)
    expect(byCheat('buddy:edit launch.ts')?.params).toEqual({ file: 'launch.ts' })
    expect(byCheat('buddy:edit launch.ts')?.reply).toBe('Clawd: editing launch.ts.')
    expect(byCheat('buddy:edit')?.params).toEqual({})
    expect(byCheat('buddy:run npm test')?.animation).toBe(run)
    expect(byCheat('buddy:run npm test')?.params).toEqual({ command: 'npm test', ok: 'true', ended: '71', until: '71' })
    expect(byCheat('buddy:run npm test')?.reply).toBe('Clawd: running npm test.')
    expect(byCheat('buddy:run')?.params).toEqual({ ok: 'true', ended: '71', until: '71' })
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
    expect(stageAt(0, 12, 'center')).toEqual({ columns: 12, x: 1, facing: 'right' })
    expect(stageAt(3, 12, 'center')).toEqual({ columns: 12, x: 2, facing: 'left' })
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

describe('edit', () => {
  const stage = stageAt(0, 60)
  const lastFrame = (edit.frames ?? 0) - 1
  const file = '/repo/hooks/launch.ts'

  test('stays as tall as the walk and types a line beside the hands', async () => {
    for (let frame = 0; frame <= lastFrame; frame += 1) {
      expect(edit.draw(frame, stage, { file })).toHaveLength(3)
    }

    expect(text(edit.draw(0, stage, { file })[1])).toBe('▝▜██████▘▌')
    expect(text(edit.draw(1, stage, { file })[1])).toBe('▜██████▀▬▬▌')
    expect(text(edit.draw(7, stage, { file })[1])).toContain('▬▬▬ ▬▬▬▬▬ ▬▬ ▬▬▬▬▌')
    expect(edit.draw(7, stage, { file })[1]?.spans[1]).toEqual({ text: '▬▬▬ ▬▬▬▬▬ ▬▬ ▬▬▬▬', color: 'success', gap: 3 })
  })

  test('scrolls the finished line up, dimmed, and starts the next', async () => {
    const rows = edit.draw(8, stage, { file })

    expect(rows[0]?.spans.at(-1)).toEqual({ text: '▬▬▬ ▬▬▬▬▬ ▬▬ ▬▬▬▬', color: 'success', dimColor: true, gap: 3 })
    expect(text(rows[1])).toBe('▝▜██████▘▌')
    expect(text(edit.draw(15, stage, { file })[1])).toContain('▬▬ ▬▬▬ ▬▬▬▬▬▬ ▬▌')
  })

  test('names the file without its path, cut to fit', async () => {
    const longName = 'tests/a-very-long-file-name.test.tsx'

    expect(text(edit.draw(0, stage, { file })[2])).toBe('▝▝   ▝▝✎ launch.ts')
    expect(text(edit.draw(0, stage, { file: longName })[2])).toBe('▝▝   ▝▝✎ a-very-long-fil…')
    expect(text(edit.draw(0, stage, {})[2])).toBe('▝▝   ▝▝')
  })

  test('puts the page on the left when the right has no room, and drops it when neither side has', async () => {
    const left = edit.draw(4, stageAt(45, 60), { file })

    expect(left[1]?.indent).toBe(24)
    expect(text(left[0])).toContain('▟███▟█')
    expect(text(left[1])).toBe('▬▬▬ ▬▬▬▬▬ ▌▝▜██████▘')
    expect(text(left[2])).toBe('✎ launch.ts▝▝   ▝▝')

    const alone = lines(edit.draw(4, stageAt(3, 20), { file }))

    expect(alone).toEqual(['▐▛███▛█▄', '▝▜██████▘', '▝▝   ▝▝'])
  })

  test('ends with the hands down, looking ahead, the cursor gone', async () => {
    const rows = lines(edit.draw(lastFrame, stage, { file }))

    expect(rows[0]).toContain('▛███▛█')
    expect(rows[1]).toBe('▝▜██████▀▬▬ ▬▬▬ ▬▬▬▬▬▬ ▬')
  })
})

// Where on its row a span with this text starts, counting the gaps before it.
const columnOf = (row: Row | undefined, glyphs: string) => {
  let column = row?.indent ?? 0

  for (const span of row?.spans ?? []) {
    column += span.gap ?? 0

    if (span.text === glyphs) {
      return column
    }

    column += span.text.length
  }

  return undefined
}

// What a row draws in every column, by one of a span's fields.
const columnsOf = <T,>(row: Row | undefined, pick: (span: Row['spans'][number], glyph: string) => T) => {
  const drawn = new Map<number, T>()
  let column = row?.indent ?? 0

  for (const span of row?.spans ?? []) {
    column += span.gap ?? 0

    for (const glyph of span.text) {
      drawn.set(column, pick(span, glyph))
      column += 1
    }
  }

  return drawn
}

const colorsOf = (row: Row | undefined) => columnsOf(row, span => span.color)
const glyphsOf = (row: Row | undefined) => columnsOf(row, (_, glyph) => glyph)

describe('run', () => {
  const stage = stageAt(4, 72)
  const command = 'npm test'
  const intro = 16
  const middle = 31
  const groundRow = 2
  const draw = (frame: number, params: Record<string, string> = { command }) => run.draw(frame, stage, params)
  const ground = (frame: number, params?: Record<string, string>) => draw(frame, params)[groundRow]
  const onTheBanner = (frame: number, params?: Record<string, string>) =>
    draw(frame, params)[1]?.spans.find(span => span.backgroundColor === '#f2c94c')?.text

  test('is as tall as the walk, its last row a ground as wide as the band', async () => {
    expect(run.frames).toBe(null)

    for (const frame of [0, 5, intro, 300]) {
      expect(draw(frame)).toHaveLength(3)
      expect(ground(frame)?.indent).toBe(0)
      expect(width(ground(frame)?.spans ?? [])).toBe(72)
    }
  })

  test('runs the ground along the row the feet are on, giving way only to the feet', async () => {
    const standing = glyphsOf(ground(10))
    const stepping = glyphsOf(ground(intro))

    expect([...Array(9).keys()].map(column => standing.get(middle + column)).join('')).toBe('─▝▝───▝▝─')
    expect([...Array(9).keys()].map(column => stepping.get(middle + column)).join('')).toBe('─▝▝──────')
    expect(colorsOf(ground(10)).get(middle + 1)).toBe('#d77757')
    expect(colorsOf(ground(10)).get(middle + 4)).toBe('inactive')
  })

  test('opens on the world, then fades the mascot out where it walked and in at the middle', async () => {
    expect(columnOf(draw(0)[1], '▝▜██████▀')).toBe(4)
    expect(columnOf(draw(2)[1], '▒▒▒▒▒▒▒▒▒')).toBe(4)

    for (const frame of [5, 6]) {
      const colors = draw(frame).flatMap(row => [...colorsOf(row).values()])

      expect(colors.includes('#d77757')).toBe(false)
    }

    expect(columnOf(draw(7)[1], '·')).toBe(middle + 4)
    expect(columnOf(draw(8)[1], '░░ ░░░ ░░')).toBe(middle)
    expect(draw(9)[1]?.spans.find(span => span.text === '▝▜██████▀')?.color).toBe('text')
    expect(columnOf(draw(9)[1], '▝▜██████▀')).toBe(middle)
  })

  test('sets itself, pulls back a column, then runs without leaving the middle', async () => {
    expect(columnOf(draw(10)[1], '▝▜██████▀')).toBe(middle)
    expect(text(draw(10)[0])).toContain('█▟███▟')
    expect(columnOf(draw(13)[0], '▗▟')).toBe(middle - 1)
    expect(columnOf(draw(15)[groundRow], '▝▝')).toBe(middle)

    // The left foot is a column into the sprite, the right one six.
    const feet = new Set<number | undefined>()

    for (let frame = intro; frame < 400; frame += 1) {
      feet.add(columnOf(draw(frame)[groundRow], '▝▝'))
    }

    expect([...feet].sort()).toEqual([middle + 1, middle + 6])
  })

  test('holds the world still until it runs, then moves the ground a column a frame', async () => {
    const before = glyphsOf(ground(intro))
    const after = glyphsOf(ground(intro + 1))

    expect(draw(intro - 1).slice(0, 2)).not.toEqual(draw(0).slice(0, 2))
    expect(columnOf(ground(0), '▄▆▄')).toBe(columnOf(ground(intro), '▄▆▄'))
    expect([...Array(25).keys()].every(column => after.get(column) === before.get(column + 1))).toBe(true)
  })

  test('moves what stands on the ground at its speed, under an empty sky', async () => {
    expect(columnOf(ground(intro), '▄▆▄')).toBe(50)
    expect(columnOf(ground(intro + 5), '▄▆▄')).toBe(45)
    // A tree's crown is over its trunk, which rises out of the ground's own line.
    expect(columnOf(draw(0)[0], '▟█▙')).toBe(23)
    expect(columnOf(draw(0)[1], '▟███▙')).toBe(22)
    expect(glyphsOf(ground(0)).get(24)).toBe('╨')

    // The shades only the fade at the opening is drawn in.
    for (let frame = intro; frame < 400; frame += 1) {
      expect(/[░▒▂▃✿]/.test(lines(draw(frame).slice(1)).join(''))).toBe(false)
    }
  })

  test('lets nothing show through the mascot but the ground between its feet', async () => {
    const scenery = new Set(['#6aa84f', '#a47148', 'inactive'])
    const standing = new Set(['╨', '┴', '▄', '▆'])

    for (let frame = intro; frame < 200; frame += 1) {
      const rows = draw(frame)

      for (let column = middle; column < middle + 9; column += 1) {
        expect(scenery.has(colorsOf(rows[0]).get(column) ?? '')).toBe(false)
        expect(scenery.has(colorsOf(rows[1]).get(column) ?? '')).toBe(false)
        expect(standing.has(glyphsOf(rows[groundRow]).get(column) ?? '')).toBe(false)
      }
    }
  })

  test('tows the command on a banner behind it, from the frame it sets off', async () => {
    const row = draw(intro + 10)[1]

    expect(onTheBanner(intro - 1)).toBeUndefined()
    expect(onTheBanner(intro + 10)).toBe('npm test')
    expect(row?.spans.find(span => span.text === 'npm test')).toEqual({
      text: 'npm test',
      color: '#000000',
      backgroundColor: '#f2c94c',
    })
    // The cloth, its edges and tail, then seven columns of rope up to the mascot.
    expect(columnOf(row, '▐')).toBe(middle - 7 - 10)
    expect(columnOf(row, 'npm test')).toBe(middle - 7 - 9)
    expect(columnOf(row, '▌')).toBe(middle - 7 - 1)
    expect([...colorsOf(ground(intro + 10)).values()].includes('#000000')).toBe(false)
  })

  test('unrolls the banner from the rope end, then holds the cloth still while rope and tail flutter', async () => {
    expect([0, 1, 2, 4, 5, 6].map(ran => onTheBanner(intro + ran))).toEqual([
      'st',
      'est',
      'test',
      'pm test',
      'npm test',
      'npm test',
    ])

    const flapping = glyphsOf(draw(intro + 20)[1])
    const flapped = glyphsOf(draw(intro + 22)[1])
    const rope = (drawn: Map<number, string>) =>
      [...Array(7).keys()].map(column => drawn.get(middle - 7 + column) ?? ' ').join('')

    expect(columnOf(draw(intro + 22)[1], 'npm test')).toBe(columnOf(draw(intro + 20)[1], 'npm test'))
    expect([rope(flapping), rope(flapped)]).toEqual(['─ ─ ─ ─', ' ─ ─ ─ '])
    expect([flapping.get(middle - 18), flapped.get(middle - 18)]).toEqual(['≈', '~'])
  })

  test('shows one plain line of the command, cut to fit the room behind it', async () => {
    const shown = (typed: string, on = stage) => run.draw(intro + 30, on, { command: typed })[1]?.spans
      .find(span => span.backgroundColor === '#f2c94c')?.text

    expect(shown('cd /Users/someone/Projects/thing && npm run build')).toBe('cd /Users/someone/Pr…')
    expect(shown('git commit -m "修正"')).toBe('git commit -m "…')
    expect(shown('echo one\necho two')).toBe('echo one')
    expect(onTheBanner(intro + 30, {})).toBeUndefined()
    expect(shown('cd /Users/someone/Projects/thing', stageAt(0, 40))).toBe('cd /…')
    expect(shown('npm test', stageAt(0, 24))).toBeUndefined()
  })

  test('keeps the world out from behind the banner and its rope', async () => {
    const scenery = new Set(['#6aa84f', '#a47148'])

    for (let frame = intro + 6; frame < 200; frame += 1) {
      const colors = colorsOf(draw(frame)[1])

      for (let column = middle - 18; column < middle; column += 1) {
        expect(scenery.has(colors.get(column) ?? '')).toBe(false)
      }
    }
  })

  test('kicks up dust as it sets off', async () => {
    expect(glyphsOf(ground(intro)).get(middle - 2)).toBe('∘')
    expect(glyphsOf(ground(intro + 2)).get(middle - 4)).toBe('·')
    expect(glyphsOf(ground(intro + 6)).get(middle - 2)).toBe('─')
  })

  test('sweats and gasps once it has run ten seconds', async () => {
    const fresh = lines(draw(intro + 60).slice(0, 2)).join('')
    const tired = [125, 126, 127, 128].map(ran => lines(draw(intro + ran)))

    expect(run.frameMs(0)).toBe(100)
    expect(run.frameMs(intro) * 125).toBe(10000)
    expect(fresh.includes('▂███▂█') || fresh.includes("'") || fresh.includes('˙')).toBe(false)
    expect(tired[0]?.[0]).toContain('˙')
    expect(tired[1]?.[1]).toContain("'")
    expect(tired[1]?.[0]).toContain('▂███▂█')
    expect(tired[2]?.[0]).toContain('▂███▂█')
    expect(tired[3]?.[0]).toContain('█▟███▟')
  })

  test('stays put through the opening when it is in the middle already', async () => {
    const there = { ...stage, x: middle }

    for (const frame of [2, 5, 8]) {
      expect(columnOf(run.draw(frame, there, { command })[1], '▝▜██████▀')).toBe(middle)
    }

    expect(columnOf(run.draw(13, there, { command })[0], '▗▟')).toBe(middle - 1)
  })

  test('carries on with the next command on its banner when one is asked for mid-run', async () => {
    const next = { command: 'ls -la' }

    expect(draw(intro + 100, next)[0]).toEqual(draw(intro + 100)[0])
    expect(draw(intro + 100, next)[2]).toEqual(draw(intro + 100)[2])
    expect(onTheBanner(intro + 100, next)).toBe('ls -la')
  })

  test('leaves the mascot in the middle once it has reappeared there, and where it was before that', async () => {
    expect(run.exit?.(6)).toBe('in-place')
    expect(run.exit?.(7)).toBe('center')
    expect(run.exit?.(500)).toBe('center')
  })
})

describe('run, once the last command is back', () => {
  const stage = stageAt(4, 72)
  const command = 'npm test'
  const middle = 31
  const passed = { command, ok: 'true', ended: '40', until: '78' }
  const failed = { ...passed, ok: 'false' }
  const draw = (frame: number, params: Record<string, string>) => run.draw(frame, stage, params)
  // The ground as it lies outside the nine columns the mascot stands in.
  const groundAround = (frame: number, params: Record<string, string>) =>
    [...glyphsOf(draw(frame, params)[2])].filter(([column]) => column < middle || column >= middle + 9)

  test('loops while a command is out, and has an end once it is told when to stop', async () => {
    expect(run.framesFor?.({ command })).toBe(null)
    expect(run.framesFor?.(passed)).toBe(94)
  })

  test('runs on three seconds, the result beside its head for the first of them', async () => {
    expect((78 - 40) * run.frameMs(40)).toBe(3040)
    expect(columnOf(draw(39, { command })[0], 'Finish!')).toBeUndefined()
    expect(columnOf(draw(40, passed)[0], 'Finish!')).toBe(42)
    expect(columnOf(draw(49, passed)[0], 'Finish!')).toBe(42)
    expect(columnOf(draw(50, passed)[0], 'Finish!')).toBeUndefined()
    expect(draw(40, failed)[0]?.spans.find(span => span.text === 'Oops!')?.color).toBe('error')
    expect(draw(60, passed)).toEqual(draw(60, { command }))
    expect(groundAround(77, passed)).not.toEqual(groundAround(76, passed))
  })

  test('then stops the world and cheers a command that passed', async () => {
    const rows = draw(78, passed)

    expect(rows).toHaveLength(3)
    expect(columnOf(rows[1], '▜██████▘')).toBe(middle + 1)
    expect(columnOf(rows[0], 'Finish!')).toBe(42)
    expect(rows[0]?.spans.find(span => span.text === 'Finish!')?.color).toBe('success')
    expect(groundAround(78, passed)).toEqual(groundAround(78, { command }))
    expect(draw(93, passed)).toEqual(rows)
  })

  test('or stumbles a column on at one that failed, eyes shut', async () => {
    expect(columnOf(draw(78, failed)[1], '▝▜██████▀')).toBe(middle + 1)
    expect(columnOf(draw(80, failed)[1], '▝▜██████▀')).toBe(middle)
    expect(text(draw(80, failed)[0])).toContain('▂███▂█')
    expect(columnOf(draw(80, failed)[0], 'Oops!')).toBe(42)
  })

  test('gives a command that was back at once the whole opening, and its result once it runs', async () => {
    const atOnce = { command, ok: 'true', ended: '0', until: '54' }

    for (const frame of [0, 4, 9, 15]) {
      expect(draw(frame, atOnce)).toEqual(draw(frame, { command }))
    }

    expect(columnOf(draw(16, atOnce)[0], 'Finish!')).toBe(42)
    expect(columnOf(draw(26, atOnce)[0], 'Finish!')).toBeUndefined()
    expect(columnOf(draw(54, atOnce)[1], '▜██████▘')).toBe(middle + 1)
  })

  test('the cheat is six seconds to its cheer', async () => {
    const typed = byCheat('buddy:run npm test')?.params ?? {}
    const ms = Array.from({ length: 71 }, (_, frame) => run.frameMs(frame))

    expect(ms.reduce((sum, each) => sum + each, 0)).toBe(6000)
    expect(columnOf(draw(70, typed)[0], 'Finish!')).toBeUndefined()
    expect(columnOf(draw(71, typed)[1], '▜██████▘')).toBe(middle + 1)
    expect(run.framesFor?.(typed)).toBe(87)
    expect((87 - 71) * run.frameMs(71)).toBe(1280)
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
