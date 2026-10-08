import { expect, mock, test } from 'claude-code/testing'

const BODY = '#d77757'
const STEP_MS = 300
const FRAME_MS = 100
const CHARGE_STAGE_FRAMES = 5
const RAISE_FRAMES = CHARGE_STAGE_FRAMES * 4
const WIND_UP_FRAMES = 5
const FLIGHT_FRAMES = 12
const CHEAT = 'buddy:send-pr'
const TORSO = '▝▜██████▀'
const TORSO_ARMS_UP = '▜██████▘'
const LOOKING_RIGHT = '█▟███▟'
const LOOKING_LEFT = '▟███▟█'
const SPARK = '∘'
const FULL_BALL = '│    PR    │'

// The boxes are the band, then a row each: the air over the head, the head, the torso.
const TORSO_BOX = 3

const band = (bodyColumns: number) =>
  ({
    plugin: 'buddy-go',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

test('draws the mascot in its body color on every surface that has the band', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...band(40), surface })

    const torso = await ui.find({ type: 'Text', text: TORSO })
    expect(torso?.props.color).toBe(BODY)

    const eyes = await ui.find({ type: 'Text', text: LOOKING_RIGHT })
    expect(eyes?.props.color).toBe(BODY)
    expect(eyes?.props.backgroundColor).toBe('#000000')

    await ui.unmount()
  }
})

test('keeps a row of air over the mascot', async $ => {
  const ui = await $.ui.mount({ ...band(40), surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)

  expect(await ui.findAll({ type: 'Box' })).toHaveLength(5)
  expect(texts[0]).toBe(' ')
  expect(texts.at(-1)).toBe('▝▝   ▝▝')

  await ui.unmount()
})

test('yields the band to a survey', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>survey</Text>
  })

  const quiet = band(40)
  const ui = await $.ui.mount({
    ...quiet,
    props: { ...quiet.props, hasSurvey: true },
    surface: 'terminal',
  })

  expect(await ui.find({ type: 'Text', text: TORSO })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'survey' })).toBeDefined()

  await ui.unmount()
})

test('paces to the far edge, turns, and comes back', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 12 columns leave the 9-column sprite 3 columns of travel.
  const ui = await $.ui.mount({ ...band(12), surface: 'terminal' })

  const torsoColumn = async () => {
    const boxes = await ui.findAll({ type: 'Box' })

    return boxes[TORSO_BOX]?.props.marginLeft
  }
  const isLooking = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  expect(await torsoColumn()).toBe(0)
  expect(await isLooking(LOOKING_RIGHT)).toBe(true)

  const seen: unknown[] = []
  for (let tick = 0; tick < 6; tick += 1) {
    await clock.advance(STEP_MS)
    seen.push(await torsoColumn())
  }
  expect(seen).toEqual([1, 2, 3, 2, 1, 0])

  await clock.advance(STEP_MS * 3)
  expect(await torsoColumn()).toBe(3)
  expect(await isLooking(LOOKING_LEFT)).toBe(true)

  await ui.unmount()
})

test('the cheat charges a growing ball above the hands, throws it off the right edge, then walks on', async ($, on) => {
  const clock = mock.clock(on)
  let entered = 0
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => {
    entered += 1

    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...band(60), surface })
    const has = async (glyphs: string) =>
      (await ui.find({ type: 'Text', text: glyphs })) !== undefined
    const rows = async () => (await ui.findAll({ type: 'Text' })).map(found => found.text)

    const answer = await $.prompt.submit({ text: CHEAT, wait: false, origin: { kind: 'composer' } })
    expect(answer.drop).toBeDefined()
    expect(entered).toBe(0)

    expect(await has(SPARK)).toBe(true)
    expect(await has(TORSO_ARMS_UP)).toBe(true)
    expect(await has('PR')).toBe(false)

    await clock.advance(FRAME_MS * CHARGE_STAGE_FRAMES)
    expect(await has('╭──╮')).toBe(true)

    await clock.advance(FRAME_MS * CHARGE_STAGE_FRAMES)
    expect(await has('│  PR  │')).toBe(true)

    await clock.advance(FRAME_MS * CHARGE_STAGE_FRAMES)
    expect(await has(FULL_BALL)).toBe(true)
    expect(await has(LOOKING_RIGHT)).toBe(false)

    // The row between the ball and the raised hands stays empty at full size.
    const drawn = await rows()
    expect(drawn[6]).toBe(' ')

    await clock.advance(FRAME_MS * CHARGE_STAGE_FRAMES)
    expect(await has(TORSO_ARMS_UP)).toBe(true)
    expect(await has(LOOKING_RIGHT)).toBe(true)
    expect(await has(FULL_BALL)).toBe(true)

    await clock.advance(FRAME_MS * (WIND_UP_FRAMES + FLIGHT_FRAMES / 2))
    expect(await has(TORSO)).toBe(true)
    expect(await has('━━━│    PR    │')).toBe(true)

    await clock.advance(FRAME_MS * FLIGHT_FRAMES)
    expect(await has('PR')).toBe(false)
    expect(await has(TORSO)).toBe(true)

    await ui.unmount()
  }
})

test('standing in the right half, the mascot throws the ball to the left', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  await clock.advance(STEP_MS * 40)
  await $.prompt.submit({ text: CHEAT, wait: false, origin: { kind: 'composer' } })

  await clock.advance(FRAME_MS * RAISE_FRAMES)
  expect(await has(LOOKING_LEFT)).toBe(true)
  expect(await has(LOOKING_RIGHT)).toBe(false)

  await clock.advance(FRAME_MS * (WIND_UP_FRAMES + FLIGHT_FRAMES / 2))
  expect(await has('│    PR    │━━━')).toBe(true)
  expect(await has(LOOKING_LEFT)).toBe(true)

  await clock.advance(FRAME_MS * FLIGHT_FRAMES)
  expect(await has('PR')).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})

test('running gh pr create launches the banner', async ($, on) => {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const isLaunching = async () => (await ui.find({ type: 'Text', text: SPARK })) !== undefined

  await $.tool.call({ tool: 'Bash', command: 'git push -u origin HEAD' })
  expect(await isLaunching()).toBe(false)

  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title "t" --body "b"' })
  expect(await isLaunching()).toBe(true)

  await ui.unmount()
})

const EDIT_FRAME_MS = 120
const EDIT_FRAMES = 20

test('editing a file sets the mascot typing beside its name, then it walks on', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  await $.tool.call({ tool: 'Read', file_path: '/repo/hooks/walk.ts' })
  expect(await has('✎ walk.ts')).toBe(false)

  await $.tool.call({ tool: 'Edit', file_path: '/repo/hooks/walk.ts', old_string: 'a', new_string: 'b' })
  expect(await has('✎ walk.ts')).toBe(true)
  expect(await has(LOOKING_RIGHT)).toBe(true)

  // A second edit while it types only changes the name; the animation still ends on time.
  await clock.advance(EDIT_FRAME_MS * (EDIT_FRAMES / 2))
  await $.tool.call({ tool: 'Write', file_path: '/repo/README.md', content: 'hi' })
  expect(await has('✎ walk.ts')).toBe(false)
  expect(await has('✎ README.md')).toBe(true)

  await clock.advance(EDIT_FRAME_MS * (EDIT_FRAMES / 2))
  expect(await has('✎ README.md')).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})

test('the edit cheat types the name it was given', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  const answer = await $.prompt.submit({ text: 'buddy:edit launch.ts', wait: false, origin: { kind: 'composer' } })
  expect(answer.drop).toBe('Clawd: editing launch.ts.')
  expect(await has('✎ launch.ts')).toBe(true)

  await clock.advance(EDIT_FRAME_MS * EDIT_FRAMES)
  expect(await has('✎ launch.ts')).toBe(false)

  await ui.unmount()
})

const RUN_FRAME_MS = 80
const RUN_INTRO_MS = 100 * 16
const RUN_LINGER_MS = RUN_FRAME_MS * 38
const RUN_END_MS = RUN_FRAME_MS * 16
// It looks where it runs; it looks ahead only to cheer.
const LOOKING_AHEAD = '▛███▛█'
const ran = { result: { stdout: '', stderr: '', interrupted: false }, text: '' }

test('commands one after another are one run: it runs on between them, and ends only after the last', async ($, on) => {
  const clock = mock.clock(on)
  let land = () => {}
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on(
    'tool.call',
    () =>
      new Promise<typeof ran>(resolve => {
        land = () => resolve(ran)
      }),
  )
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined
  const hasGround = async () =>
    (await ui.findAll({ type: 'Text' })).some(found => String(found.text).includes('──────'))
  const torsoColumn = async () => (await ui.findAll({ type: 'Box' }))[TORSO_BOX]?.props.marginLeft

  expect(await hasGround()).toBe(false)
  expect(await torsoColumn()).toBe(0)

  const first = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(RUN_INTRO_MS + RUN_FRAME_MS * 20)
  expect(await hasGround()).toBe(true)
  expect(await has('npm')).toBe(true)
  expect(await has('Finish!')).toBe(false)

  land()
  await first
  expect(await has('Finish!')).toBe(true)
  expect(await has(LOOKING_AHEAD)).toBe(false)

  // Most of the way through running on, a second command: no new opening, just its name coming in.
  await clock.advance(RUN_LINGER_MS - RUN_FRAME_MS * 4)
  const second = $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(RUN_FRAME_MS * 30)
  expect(await hasGround()).toBe(true)
  expect(await has(LOOKING_AHEAD)).toBe(false)
  expect(await has('Finish!')).toBe(false)
  expect(await has('ls')).toBe(true)
  expect(await has('npm')).toBe(false)
  expect(await has('▒▒▒▒▒▒▒▒▒')).toBe(false)

  land()
  await second
  await clock.advance(RUN_LINGER_MS)
  expect(await has('Finish!')).toBe(true)
  expect(await has(LOOKING_AHEAD)).toBe(true)
  expect(await has(TORSO_ARMS_UP)).toBe(true)
  expect(await hasGround()).toBe(true)

  await clock.advance(RUN_END_MS)
  expect(await has('Finish!')).toBe(false)
  expect(await hasGround()).toBe(false)
  expect(await has(TORSO)).toBe(true)
  // 60 columns leave the 9-column sprite 51 of travel, and the middle is half of that.
  expect(await torsoColumn()).toBe(25)

  await ui.unmount()
})

test('commands side by side are one run: nothing marks the first one back, only the last', async ($, on) => {
  const clock = mock.clock(on)
  const landings: (() => void)[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on(
    'tool.call',
    () =>
      new Promise<typeof ran>(resolve => {
        landings.push(() => resolve(ran))
      }),
  )
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  const short = $.tool.call({ tool: 'Bash', command: 'npm test' })
  const long = $.tool.call({ tool: 'Bash', command: 'npm run build' })
  await clock.advance(RUN_INTRO_MS + RUN_FRAME_MS * 20)
  expect(landings).toHaveLength(2)

  landings[0]?.()
  await short
  expect(await has('Finish!')).toBe(false)

  // Well past where a run would have ended had the first one back counted.
  await clock.advance(RUN_LINGER_MS + RUN_END_MS + RUN_FRAME_MS * 10)
  expect(await has('Finish!')).toBe(false)
  expect(await has(LOOKING_RIGHT)).toBe(true)

  landings[1]?.()
  await long
  expect(await has('Finish!')).toBe(true)

  await clock.advance(RUN_LINGER_MS + RUN_END_MS)
  expect(await has('Finish!')).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})

test('a command that failed at once still gets the whole opening, then the run ends on a stumble', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ ...ran, text: 'exit 1', isError: true }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await has('Oops!')).toBe(false)

  await clock.advance(RUN_INTRO_MS)
  expect(await has('Oops!')).toBe(true)
  expect(await has('Finish!')).toBe(false)

  await clock.advance(RUN_LINGER_MS)
  expect(await has('Oops!')).toBe(true)
  expect(await has(TORSO)).toBe(true)

  await clock.advance(RUN_END_MS)
  expect(await has('Oops!')).toBe(false)
  expect((await ui.findAll({ type: 'Box' }))[TORSO_BOX]?.props.marginLeft).toBe(25)

  await ui.unmount()
})

test('the run cheat runs six seconds, then cheers', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  const answer = await $.prompt.submit({ text: 'buddy:run npm test', wait: false, origin: { kind: 'composer' } })
  expect(answer.drop).toBe('Clawd: running npm test.')

  await clock.advance(6000 - RUN_FRAME_MS)
  expect(await has('Finish!')).toBe(false)

  await clock.advance(RUN_FRAME_MS)
  expect(await has('Finish!')).toBe(true)

  const mark = await ui.find({ type: 'Text', text: 'Finish!' })
  expect(mark?.props.color).toBe('success')
  expect(mark?.props.bold).toBe(true)

  await clock.advance(RUN_END_MS)
  expect(await has('Finish!')).toBe(false)
  expect((await ui.findAll({ type: 'Box' }))[TORSO_BOX]?.props.marginLeft).toBe(25)

  await ui.unmount()
})

const TELEPORT_FRAME_MS = 150
const TELEPORT_FRAMES = 8
const BUBBLE = '< your turn'
const turnEnded = { durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('only a reply that ends by asking the person starts the wave', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(40), surface: 'terminal' })
  const isWaving = async () => (await ui.find({ type: 'Text', text: BUBBLE })) !== undefined
  const endTurn = async (answer: string, agentId?: string) => {
    await $.turn.complete(agentId === undefined ? { ...turnEnded, answer } : { ...turnEnded, answer, agentId })
    await clock.advance(TELEPORT_FRAME_MS * TELEPORT_FRAMES)
  }

  await endTurn('All six tests pass.')
  expect(await isWaving()).toBe(false)

  await endTurn('Why did it fail? Because the path was wrong.\n\nFixed now.\n\nDone.\n\nresult: fixed')
  expect(await isWaving()).toBe(false)

  await endTurn('Which one do you want?', 'sub-1')
  expect(await isWaving()).toBe(false)

  await endTurn('改好了。\n\n要我把測試補上嗎？\n\nresult: done')
  expect(await isWaving()).toBe(true)

  await $.turn.start({ text: 'yes', turnId: 't2' })
  expect(await isWaving()).toBe(false)

  await ui.unmount()
})

const TELEPORT_MS = 150 * 8
const LAUNCH_MS = FRAME_MS * (RAISE_FRAMES + WIND_UP_FRAMES + FLIGHT_FRAMES)

test('the player lets a launch cut into the wave, then brings the wave back', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined
  const cheat = (typed: string) =>
    $.prompt.submit({ text: typed, wait: false, origin: { kind: 'composer' } })

  await cheat('buddy:your-turn')
  await clock.advance(TELEPORT_MS)
  expect(await has(BUBBLE)).toBe(true)

  await cheat('buddy:send-pr')
  expect(await has(SPARK)).toBe(true)
  expect(await has(BUBBLE)).toBe(false)

  await clock.advance(LAUNCH_MS)
  expect(await has('PR')).toBe(false)
  await clock.advance(TELEPORT_MS)
  expect(await has(BUBBLE)).toBe(true)

  await $.turn.start({ text: 'next', turnId: 't2' })
  expect(await has(BUBBLE)).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})

test('the player holds a wave asked for mid-launch until the ball is gone, and drops it if the person replies first', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined
  const cheat = (typed: string) =>
    $.prompt.submit({ text: typed, wait: false, origin: { kind: 'composer' } })

  await cheat('buddy:send-pr')
  await cheat('buddy:your-turn')
  expect(await has(SPARK)).toBe(true)
  await clock.advance(LAUNCH_MS + TELEPORT_MS)
  expect(await has(BUBBLE)).toBe(true)
  await $.turn.start({ text: 'next', turnId: 't2' })

  await cheat('buddy:send-pr')
  await cheat('buddy:your-turn')
  await $.turn.start({ text: 'again', turnId: 't3' })
  await clock.advance(LAUNCH_MS + TELEPORT_MS)
  expect(await has(BUBBLE)).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})

const THINK_FRAME_MS = 125
const AHA_AFTER_FRAMES = 16
const AHA_FRAMES = 8
const IDEA = '!'
const stepped = { turnId: 't1', index: 0, answer: 'Done.', toolUses: [], stopReason: 'end_turn', usage: null } as const

test('thinking sets the mascot pacing under a thought, and one long enough ends on an idea', async ($, on) => {
  const clock = mock.clock(on)
  // The step beneath holds its answer back until the test lets it go.
  let answer = () => {}
  let answered = Promise.resolve()
  const think = () => {
    answered = new Promise<void>(resolve => {
      answer = resolve
    })

    return $.turn.step({ turnId: 't1', index: 0, model: 'claude', messageCount: 1 })
  }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* () {
    yield { kind: 'thinking', index: 0, text: 'hmm' }
    await answered
    yield { kind: 'text', index: 1, text: 'Done.' }

    return stepped
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined
  // The gap before a thought is a box of its own, ahead of the torso's.
  const torsoColumn = async (boxesAhead = 0) =>
    (await ui.findAll({ type: 'Box' }))[TORSO_BOX + boxesAhead]?.props.marginLeft

  expect(await has('.')).toBe(false)

  const step = think()
  await step.next()
  expect(await has('.')).toBe(true)
  expect(await torsoColumn(1)).toBe(0)

  await clock.advance(THINK_FRAME_MS * 6)
  expect(await has('. o O')).toBe(true)
  expect(await torsoColumn(1)).toBe(2)

  await clock.advance(THINK_FRAME_MS * (AHA_AFTER_FRAMES - 6))
  expect(await has(IDEA)).toBe(false)

  answer()
  await step.next()
  expect(await has(IDEA)).toBe(true)
  expect(await has('. o')).toBe(false)
  expect(await has(TORSO_ARMS_UP)).toBe(true)

  await step.next()
  await clock.advance(THINK_FRAME_MS * AHA_FRAMES)
  expect(await has(IDEA)).toBe(false)
  expect(await has(TORSO)).toBe(true)
  // It walks on from the five steps it had paced out.
  expect(await torsoColumn()).toBe(5)

  await ui.unmount()
})

test('a thought that is over at once, one cut short, and a subagent\'s leave no idea behind', async ($, on) => {
  const clock = mock.clock(on)
  // The step beneath holds its answer back until the test lets it go.
  let answer = () => {}
  let answered = Promise.resolve()
  const think = () => {
    answered = new Promise<void>(resolve => {
      answer = resolve
    })

    return $.turn.step({ turnId: 't1', index: 0, model: 'claude', messageCount: 1 })
  }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* () {
    yield { kind: 'thinking', index: 0, text: 'hmm' }
    await answered
    yield { kind: 'tool', index: 1, id: 'toolu_1', name: 'Read' }

    return stepped
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  const quick = think()
  await quick.next()
  await clock.advance(THINK_FRAME_MS * 4)
  expect(await has('.')).toBe(true)
  answer()
  await quick.next()
  expect(await has(IDEA)).toBe(false)
  expect(await has('.')).toBe(false)
  expect(await has(TORSO)).toBe(true)
  await quick.next()

  const cut = think()
  await cut.next()
  await clock.advance(THINK_FRAME_MS * (AHA_AFTER_FRAMES + 4))
  expect(await has('.')).toBe(true)
  await cut.return(stepped)
  expect(await has(IDEA)).toBe(false)
  expect(await has('.')).toBe(false)

  const unseen = $.turn.step({ turnId: 't1', index: 0, model: 'claude', messageCount: 1, agentId: 'sub-1' })
  expect((await unseen.next()).value).toMatchObject({ kind: 'thinking' })
  expect(await has('.')).toBe(false)
  await unseen.return(stepped)

  await ui.unmount()
})

test('an edit cuts into a thought, and the thought does not come back once it is over', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const has = async (glyphs: string) =>
    (await ui.find({ type: 'Text', text: glyphs })) !== undefined

  const answer = await $.prompt.submit({ text: 'buddy:think 2', wait: false, origin: { kind: 'composer' } })
  expect(answer.drop).toBe('Clawd: thinking.')
  expect(await has('.')).toBe(true)

  await clock.advance(THINK_FRAME_MS * AHA_AFTER_FRAMES)
  expect(await has(IDEA)).toBe(true)

  await $.tool.call({ tool: 'Edit', file_path: '/repo/hooks/walk.ts', old_string: 'a', new_string: 'b' })
  expect(await has(IDEA)).toBe(false)
  expect(await has('✎ walk.ts')).toBe(true)

  await clock.advance(EDIT_FRAME_MS * EDIT_FRAMES)
  expect(await has('✎ walk.ts')).toBe(false)
  expect(await has(IDEA)).toBe(false)
  expect(await has(TORSO)).toBe(true)

  await ui.unmount()
})
