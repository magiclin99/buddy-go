import type { Animation, Triggers } from '../lib/frame'
import { edit, editTriggers } from './edit'
import { launch, launchTriggers } from './launch'
import { run, runTriggers } from './run'
import { wait, waitTriggers } from './wait'
import { walk } from './walk'

export const IDLE = walk

// An animation is a file beside these, a line here for it, and a line below for its triggers; its cheat comes with it.
export const ANIMATIONS: readonly Animation[] = [walk, launch, wait, edit, run]

export const registerTriggers: Triggers = (on, director) => {
  launchTriggers(on, director)
  editTriggers(on, director)
  runTriggers(on, director)
  waitTriggers(on, director)
}

export const CHEAT_PREFIX = 'buddy:'

export const byName = (name: string) => ANIMATIONS.find(animation => animation.name === name)

export const byCheat = (typed: string) => {
  const text = typed.trim()

  if (!text.startsWith(CHEAT_PREFIX)) {
    return undefined
  }

  const [name = '', ...rest] = text.slice(CHEAT_PREFIX.length).split(/\s+/)
  const animation = ANIMATIONS.find(candidate => candidate.cheat?.name === name)

  if (animation?.cheat === undefined) {
    return undefined
  }

  const params = animation.cheat.params?.(rest.join(' ')) ?? {}

  return { animation, params, reply: animation.cheat.reply(params) }
}
