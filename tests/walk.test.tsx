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
const PR_OPENED = 'https://github.com/acme/widgets/pull/42'

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

    return boxes[2]?.props.marginLeft
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
    expect(drawn[5]).toBe(' ')

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

test('a PR opened after /gary-pr launches the banner, once', async ($, on) => {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: { stdout: PR_OPENED, stderr: '', interrupted: false }, text: PR_OPENED }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })
  const isLaunching = async () => (await ui.find({ type: 'Text', text: TORSO_ARMS_UP })) !== undefined
  const openPr = () => $.tool.call({ tool: 'Bash', command: 'gh pr create --title "t" --body "b"' })

  await openPr()
  expect(await isLaunching()).toBe(false)

  await $.skill.prompt({ skill: 'gary-pr', text: 'open the PR' })
  await $.tool.call({ tool: 'Bash', command: 'git push -u origin HEAD' })
  expect(await isLaunching()).toBe(false)

  await openPr()
  expect(await isLaunching()).toBe(true)

  await ui.unmount()
})

test('a PR that failed to open launches nothing', async ($, on) => {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('tool.call', () => ({
    result: { stdout: '', stderr: 'pull request create failed', interrupted: false },
    text: 'pull request create failed',
    isError: true,
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(60), surface: 'terminal' })

  await $.skill.prompt({ skill: 'gary-pr', text: 'open the PR' })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' })
  expect(await ui.find({ type: 'Text', text: TORSO_ARMS_UP })).toBeUndefined()

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
