import { describe, expect, test } from 'claude-code/testing'

import type { Animation } from '../hooks/lib/frame'
import { createPlayer } from '../hooks/lib/player'

const make = (name: string, priority: number, frames: number | null, more: Partial<Animation> = {}): Animation => ({
  name,
  priority,
  frames,
  frameMs: () => 100,
  draw: () => [],
  ...more,
})

const idle = make('idle', 0, null, { frameMs: () => 300 })
const wave = make('wave', 1, null)
const typing = make('typing', 1, null)
const throwing = make('throwing', 2, 3)
const fanfare = make('fanfare', 3, 2)
const cast = [idle, wave, typing, throwing, fanfare]
const fresh = () => createPlayer(idle, name => cast.find(animation => animation.name === name))

const ticks = (player: ReturnType<typeof fresh>, count: number) => {
  for (let tick = 0; tick < count; tick += 1) {
    player.tick()
  }
}

describe('the player', () => {
  test('walks the idle show when nothing else is on, counting its steps', async () => {
    const player = fresh()

    ticks(player, 4)
    expect(player.show()).toEqual({ name: 'idle', frame: 4, params: {}, idleFrame: 4 })
    expect(player.delay()).toBe(300)
  })

  test('plays a finite animation to its last frame, then goes back to idle where it left off', async () => {
    const player = fresh()

    ticks(player, 2)
    player.play(throwing)
    expect(player.show()).toEqual({ name: 'throwing', frame: 0, params: {}, idleFrame: 2 })
    expect(player.delay()).toBe(100)

    ticks(player, 2)
    expect(player.show().frame).toBe(2)
    player.tick()
    expect(player.show()).toEqual({ name: 'idle', frame: 2, params: {}, idleFrame: 2 })
  })

  test('holds a lower priority request until the stage is free', async () => {
    const player = fresh()

    player.play(throwing)
    player.play(wave)
    expect(player.show().name).toBe('throwing')

    ticks(player, 3)
    expect(player.show().name).toBe('wave')
  })

  test('brings a looping animation back after something cut in, and not a finite one', async () => {
    const player = fresh()

    player.play(wave)
    ticks(player, 5)
    player.play(throwing)
    ticks(player, 3)
    expect(player.show()).toEqual({ name: 'wave', frame: 0, params: {}, idleFrame: 0 })

    player.stop(wave)
    player.play(throwing)
    player.play(fanfare)
    ticks(player, 2)
    expect(player.show().name).toBe('idle')
  })

  test('keeps everything that is waiting, however many cut in', async () => {
    const player = fresh()

    player.play(wave)
    player.play(throwing)
    player.play(fanfare)
    expect(player.show().name).toBe('fanfare')

    ticks(player, 2)
    expect(player.show().name).toBe('wave')
  })

  test('plays the highest priority of those waiting first, and the longest waiting among equals', async () => {
    const player = fresh()

    player.play(fanfare)
    player.play(wave)
    player.play(typing)
    player.play(throwing)
    ticks(player, 2)
    expect(player.show().name).toBe('throwing')

    ticks(player, 3)
    expect(player.show().name).toBe('wave')
  })

  test('a stop removes it whether it is playing or waiting', async () => {
    const player = fresh()

    player.play(throwing)
    player.play(wave)
    player.stop(wave)
    ticks(player, 3)
    expect(player.show().name).toBe('idle')

    player.play(wave)
    player.stop(wave)
    expect(player.show().name).toBe('idle')
  })

  test('asked again while playing, it carries on with the new params', async () => {
    const player = fresh()

    player.play(typing, { file: 'a.go' })
    ticks(player, 4)
    player.play(typing, { file: 'b.go' })
    expect(player.show()).toEqual({ name: 'typing', frame: 4, params: { file: 'b.go' }, idleFrame: 0 })
  })

  test('moves the mascot only when the animation says it left it elsewhere', async () => {
    const hop = make('hop', 1, null, { exit: frame => (frame < 2 ? 'in-place' : 'left-edge') })
    const player = createPlayer(idle, () => undefined)

    ticks(player, 7)
    player.play(hop)
    player.tick()
    player.stop(hop)
    expect(player.show().idleFrame).toBe(7)

    player.play(hop)
    ticks(player, 2)
    player.stop(hop)
    expect(player.show().idleFrame).toBe(0)
  })

  test('picks a show back up after a reload, and falls back to idle for one it does not know', async () => {
    const player = fresh()

    player.restore({ name: 'wave', frame: 9, params: {}, idleFrame: 12 })
    expect(player.show()).toEqual({ name: 'wave', frame: 9, params: {}, idleFrame: 12 })

    player.restore({ name: 'gone', frame: 3, params: {}, idleFrame: 5 })
    expect(player.show()).toEqual({ name: 'idle', frame: 5, params: {}, idleFrame: 5 })
  })

  test('ignores a request to play the idle show itself', async () => {
    const player = fresh()

    player.play(wave)
    player.play(idle)
    expect(player.show().name).toBe('wave')
  })
})
