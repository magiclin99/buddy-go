# buddy-go

**Give your Claude Code prompt a tiny coworker.**

Buddy (you may know it as Clawd, the Claude Code mascot) moves in right above your input box and reacts to whatever Claude is up to. It paces when Claude thinks, sprints when your commands run, types when files change, and hurls your pull requests into orbit.

![Buddy sprinting while a command runs](demo/run.gif)

## Install

Type this into the Claude Code prompt:

```
/plugin install buddy-go --marketplace magiclin99/buddy-go
```

That's it. Buddy shows up above the prompt and starts wandering.

## What Buddy does

### Paces while Claude thinks

![Buddy pacing under a thought bubble](demo/think.gif)

A few steps out, a few steps back, a `. o O` bubble beside its head, and a pause now and then to shut its eyes and really think. Five seconds in, the pacing gets quicker. Fifteen seconds in, Buddy goes red and starts to sweat. When the answer finally lands, both hands go up: `!`

### Sprints while your commands run

![Buddy running with the command on a banner](demo/run.gif)

Every Bash command is a race. The ground rolls in, trees fly past, and Buddy tows your command behind it on a banner. Commands that follow each other are one long run. It ends with a green `Finish!` and a cheer, or a red `Oops!` and a stumble. Run for more than ten seconds and Buddy starts gasping.

### Types along when files change

![Buddy typing beside a file name](demo/edit.gif)

Whenever Claude edits or writes a file, Buddy stops and hammers out a few lines of code, with the file's name underneath.

### Launches your PR

![Buddy charging a ball and throwing it](demo/send-pr.gif)

`gh pr create` deserves a ceremony. Buddy raises its hands, charges up a ball with your PR inside, and throws it clean off the screen.

### Waves when it's your turn

![Buddy waving beside a "your turn" bubble](demo/your-turn.gif)

When Claude ends on a question, Buddy vanishes, pops up at the left edge, and waves until you answer. No more staring at a prompt that was waiting for you.

### Wanders the rest of the time

![Buddy walking above the prompt](demo/walk.gif)

Back and forth, above the prompt, minding its own business.

## Cheat codes

You don't have to wait for Claude. Type a cheat straight into the prompt, with no slash, and Buddy performs on demand. Buddy catches cheats before they are sent, so they never reach the model.

| Type this | Buddy will |
|---|---|
| `buddy:think 20` | pace and think for 20 seconds (8 if you leave the number out) |
| `buddy:run npm test` | sprint for six seconds with `npm test` on the banner |
| `buddy:edit main.ts` | type into `main.ts` |
| `buddy:send-pr` | launch a PR |
| `buddy:your-turn` | wave at you |

## Update

```bash
claude plugin marketplace update buddy-go
claude plugin update buddy-go@buddy-go
```

Then type `/reload-plugins` in any session that is already open.

## Teach Buddy a new trick

Every animation is one small file, and drawing is plain math: given a frame number and where Buddy stands, return the characters and colors to draw. No timers, no engine calls.

1. Add a file to `hooks/animations/` that exports an `Animation`: a name, a priority, how many frames, how long each lasts, and a `draw` function. Export a trigger function and a cheat name if it needs them.
2. Add it to `ANIMATIONS` in `hooks/animations/index.ts`, and its trigger to `registerTriggers`.

Run it from your folder while you work:

```bash
claude --plugin-dir /path/to/buddy-go
claude plugin validate .
claude plugin test .
```

<details>
<summary>Where things live</summary>

```
hooks/
├── register.tsx        wiring: the clock, the published state, cheats, drawing
├── animations/         one file per animation, plus the registry in index.ts
│   ├── walk.ts
│   ├── wait.ts
│   ├── think.ts
│   ├── edit.ts
│   ├── run.ts
│   └── launch.ts
└── lib/
    ├── player.ts       what is playing, what is queued, where Buddy stands
    ├── body.ts         Buddy's body parts
    ├── render.tsx      turns an animation's rows into elements
    └── frame.ts        shared types
tests/
├── player.test.ts      the player's rules
├── animations.test.ts  what each animation draws, frame by frame
└── walk.test.tsx       events in, pixels out
demo/
├── record.sh           records every animation as a GIF
├── settings.json       recording only: load this folder's copy alone
└── *.gif               the GIFs on this page
```

</details>

<details>
<summary>Re-recording the GIFs</summary>

The GIFs are recorded in a real Claude Code session by typing each cheat. You need `vhs` and `ffmpeg` (`brew install vhs ffmpeg`).

```bash
demo/record.sh          # all of them
demo/record.sh think    # just one
```

To record a new animation, add a line at the bottom of `demo/record.sh`: `record <name> "<cheat>" <seconds>`.

</details>

---

buddy-go is an unofficial fan mod and is not affiliated with Anthropic.
