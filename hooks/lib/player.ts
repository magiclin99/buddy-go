import type { Animation, IdleFrom, Params } from './frame'

export type Show = {
  name: string
  frame: number
  params: Record<string, string>
  idleFrame: number
  idleFrom?: IdleFrom
}

type Act = { animation: Animation; params: Params }

// What is on stage, what waits behind it, and where the mascot stands. No timers, no state, no `$`:
// the caller ticks it and draws what `show()` says.
export const createPlayer = (idle: Animation, find: (name: string) => Animation | undefined) => {
  let act: Act | undefined
  let frame = 0
  let idleFrame = 0
  let idleFrom: IdleFrom = 'left-edge'
  let waiting: Act[] = []

  const framesOf = (held: Act) =>
    held.animation.framesFor === undefined ? held.animation.frames : held.animation.framesFor(held.params)

  const begin = (next: Act) => {
    act = next
    frame = 0
  }

  const leave = () => {
    const left = act?.animation.exit?.(frame) ?? 'in-place'

    if (left !== 'in-place') {
      idleFrame = 0
      idleFrom = left
    }
  }

  const enqueue = (next: Act) => {
    waiting = [...waiting.filter(held => held.animation.name !== next.animation.name), next]
  }

  const finish = () => {
    leave()
    act = undefined
    frame = 0

    // The highest priority goes next; among equals, the one that has waited longest.
    const next = waiting.reduce<Act | undefined>(
      (best, held) => (best === undefined || held.animation.priority > best.animation.priority ? held : best),
      undefined,
    )

    if (next !== undefined) {
      waiting = waiting.filter(held => held !== next)
      begin(next)
    }
  }

  return {
    play: (animation: Animation, params: Params = {}) => {
      if (animation.name === idle.name) {
        return
      }

      if (act === undefined) {
        begin({ animation, params })

        return
      }

      if (act.animation.name === animation.name) {
        // Asked again while playing: it carries on from where it is with the new params.
        act = { animation, params }

        return
      }

      if (act.animation.priority > animation.priority) {
        enqueue({ animation, params })

        return
      }

      if (framesOf(act) === null) {
        enqueue(act)
      }

      leave()
      begin({ animation, params })
    },

    stop: (animation: Animation) => {
      waiting = waiting.filter(held => held.animation.name !== animation.name)

      if (act?.animation.name === animation.name) {
        finish()
      }
    },

    frameOf: (animation: Animation) => (act?.animation.name === animation.name ? frame : undefined),

    tick: () => {
      if (act === undefined) {
        idleFrame += 1

        return
      }

      frame += 1

      const frames = framesOf(act)

      if (frames !== null && frame >= frames) {
        finish()
      }
    },

    delay: () => (act === undefined ? idle.frameMs(idleFrame) : act.animation.frameMs(frame)),

    show: (): Show =>
      act === undefined
        ? { name: idle.name, frame: idleFrame, params: {}, idleFrame, idleFrom }
        : { name: act.animation.name, frame, params: { ...act.params }, idleFrame, idleFrom },

    // Picks up a show a reload left in state; what was waiting behind it is gone.
    restore: (kept: Show) => {
      const animation = find(kept.name)
      idleFrame = kept.idleFrame
      idleFrom = kept.idleFrom ?? 'left-edge'
      waiting = []
      act = animation === undefined || animation.name === idle.name ? undefined : { animation, params: kept.params }
      frame = act === undefined ? 0 : kept.frame
    },
  }
}

export type Player = ReturnType<typeof createPlayer>
