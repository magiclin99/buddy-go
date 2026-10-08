import { ARMS, FEET, SPRITE_COLUMNS, mascot } from '../lib/body'
import type { Animation, IdleFrom, Stage } from '../lib/frame'

export const STEP_MS = 300

// The column that puts the mascot in the middle of the band.
export const middle = (columns: number) => Math.max(0, Math.floor((columns - SPRITE_COLUMNS) / 2))

export const STRIDE = [FEET.both, FEET.left, FEET.both, FEET.right] as const

// The band's width is known only while drawing, so the idle show counts steps and the draw folds them into a there-and-back walk.
export const stageAt = (idleFrame: number, columns: number, from: IdleFrom = 'left-edge'): Stage => {
  const range = Math.max(0, columns - SPRITE_COLUMNS)

  if (range === 0) {
    return { columns, x: 0, facing: 'right' }
  }

  const position = (idleFrame + (from === 'center' ? middle(columns) : 0)) % (range * 2)

  return position < range
    ? { columns, x: position, facing: 'right' }
    : { columns, x: range * 2 - position, facing: 'left' }
}

// Where the walk would be `steps` on from a stage it drew.
export const ahead = (stage: Stage, steps: number): Stage => {
  const range = Math.max(0, stage.columns - SPRITE_COLUMNS)

  return stageAt((stage.facing === 'right' ? stage.x : range * 2 - stage.x) + steps, stage.columns)
}

// What plays whenever nothing else does.
export const walk: Animation = {
  name: 'walk',
  priority: 0,
  frames: null,
  frameMs: () => STEP_MS,

  draw: (frame, stage) => mascot(stage.x, ARMS.down, stage.facing, STRIDE[frame % STRIDE.length] ?? FEET.both),
}
