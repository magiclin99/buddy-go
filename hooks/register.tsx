import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { IDLE, byCheat, byName, registerTriggers } from './animations'
import { stageAt } from './animations/walk'
import type { Director } from './lib/frame'
import { createPlayer } from './lib/player'
import { renderRows } from './lib/render'

// The one value the draw reads: the player's show, published after every change.
const show = atom({ plugin: 'buddy-go', key: 'show' } as const, null)

const player = createPlayer(IDLE, byName)

let timer: Timer | undefined
let writing: Promise<void> = Promise.resolve()
// Set once the session has a `$` to tick and publish with; until then a request only changes the player.
let wake: (() => void) | undefined

// Chained so a slow write can never land after a newer one and leave a stale frame on screen.
const publish = ($: EngineInterface) => {
  const snapshot = player.show()

  writing = writing
    .then(() => update($, show, () => snapshot))
    .then(
      () => undefined,
      () => undefined,
    )
}

const schedule = ($: EngineInterface) => {
  timer?.cancel()
  timer = $.clock.after(player.delay(), () => {
    player.tick()
    publish($)
    schedule($)
  })
}

const director: Director = {
  play: (animation, params) => {
    player.play(animation, params)
    wake?.()
  },
  stop: animation => {
    player.stop(animation)
    wake?.()
  },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Nothing draws the band without a person at a terminal, so nothing needs to tick.
    if (!e.isInteractive) {
      return next(e)
    }

    // A reload drops the timer and the player's memory; the show in state says where it was.
    const kept = await read($, show)

    if (kept !== null && wake === undefined) {
      player.restore(kept)
    }

    wake = () => {
      publish($)
      schedule($)
    }
    wake()

    return next(e)
  })

  registerTriggers(on, director)

  on('prompt.submit', ($, e, next) => {
    const cheat = byCheat(e.text)

    if (cheat === undefined) {
      return next(e)
    }

    director.play(cheat.animation, cheat.params)

    return { drop: cheat.reply }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const shown = (await read($, show)) ?? player.show()
    const animation = byName(shown.name) ?? IDLE

    return renderRows(
      $.ui.resolve(e),
      animation.draw(shown.frame, stageAt(shown.idleFrame, e.props.bodyColumns), shown.params),
    )
  })
}
