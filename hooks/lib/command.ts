// Reading a shell command for what it is about, without running a shell over it.

const VALUE = String.raw`(?:"[^"]*"|'[^']*'|\$\([^)]*\)|[^\s;&|"'])`
const SETS = String.raw`[A-Za-z_]\w*=${VALUE}*\s+`

// What a command says before it gets to the point: the folders it steps into, and the variables it sets.
export const PREAMBLE = new RegExp(String.raw`^(?:cd\s+${VALUE}+\s*(?:&&|;)\s*|${SETS})+`)

// A program that talks to a server, where a command starts: at the line's start, or after what chains commands.
const API_CALL = new RegExp(String.raw`(?:^|[;&|(\n])\s*(?:${SETS})*(?:(?:curl|wget|https?|xh|grpcurl)\s|gh\s+api\b)`)

export const callsApi = (command: string) => API_CALL.test(command)

const URL_HOST = /https?:\/\/([A-Za-z0-9.-]+(?::\d+)?)/
const BARE_HOST = /(?:^|\s)((?:localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?)(?:[\s/]|$)/
const GH_API = /(?:^|[;&|(\s])gh\s+api\b/

// Who the command is talking to, as far as it says.
export const hostOf = (command: string) =>
  URL_HOST.exec(command)?.[1] ?? BARE_HOST.exec(command)?.[1] ?? (GH_API.test(command) ? 'api.github.com' : undefined)
