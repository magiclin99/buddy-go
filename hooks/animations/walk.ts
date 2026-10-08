import { ARMS, FEET, SPRITE_COLUMNS, mascot } from '../lib/body'
import type { Animation, Stage } from '../lib/frame'

export const STEP_MS = 300

const STRIDE = [FEET.both, FEET.left, FEET.both, FEET.right] as const

// The band's width is known only while drawing, so the idle show counts steps and the draw folds them into a there-and-back walk.
export const stageAt = (idleFrame: number, columns: number): Stage => {
  const range = Math.max(0, columns - SPRITE_COLUMNS)

  if (range === 0) {
    return { columns, x: 0, facing: 'right' }
  }

  const position = idleFrame % (range * 2)

  return position < range
    ? { columns, x: position, facing: 'right' }
    : { columns, x: range * 2 - position, facing: 'left' }
}

// What plays whenever nothing else does.
export const walk: Animation = {
  name: 'walk',
  priority: 0,
  frames: null,
  frameMs: () => STEP_MS,

  draw: (frame, stage) => mascot(stage.x, ARMS.down, stage.facing, STRIDE[frame % STRIDE.length] ?? FEET.both),
}
