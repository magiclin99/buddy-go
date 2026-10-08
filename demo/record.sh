#!/bin/sh
# Records each animation into demo/<name>.gif by typing its cheat into a real session.
# Needs vhs and ffmpeg. Run it from anywhere: demo/record.sh [name ...]
set -eu
cd "$(dirname "$0")/.."

# The band and the prompt under it sit at the bottom of the screen; everything above and below is cropped away.
# Heights are whole rows of 18 pixels, so no row is cut through. The screen is tall so the band has all the rows it asks for: on a short one the engine scrolls it.
SCREEN_WIDTH=1100
SCREEN_HEIGHT=900
BELOW_PROMPT=64
BAND_HEIGHT=166
# Where vhs leaves its frames; gone again once the last one is recorded.
FRAMES=demo/.frames

# The session is this folder's mod alone, in an environment that carries nothing of whoever records it.
SESSION='env -i HOME=$HOME USER=$USER PATH=$PATH TERM=xterm-256color COLORTERM=truecolor LANG=en_US.UTF-8 claude --plugin-dir . --settings demo/settings.json'

record() {
  name=$1 cheat=$2 seconds=$3 height=${4:-$BAND_HEIGHT}

  if [ -n "$WANTED" ] && ! echo " $WANTED " | grep -q " $name "; then
    return
  fi

  rm -rf "$FRAMES"
  {
    echo "Output $FRAMES/"
    echo 'Set Shell "bash"'
    echo 'Set FontSize 18'
    echo "Set Width $SCREEN_WIDTH"
    echo "Set Height $SCREEN_HEIGHT"
    echo 'Set Padding 20'
    echo 'Set Framerate 25'
    echo 'Set TypingSpeed 60ms'
    echo 'Hide'
    echo "Type \"clear && $SESSION\""
    echo 'Enter'
    echo 'Sleep 8s'
    echo 'Show'
    echo 'Sleep 1s'
    if [ -n "$cheat" ]; then
      echo "Type \"$cheat\""
      echo 'Sleep 400ms'
      echo 'Enter'
    fi
    echo "Sleep ${seconds}s"
  } > "$FRAMES.tape"

  echo "recording $name"
  vhs "$FRAMES.tape" > "$FRAMES.log" 2>&1 || { cat "$FRAMES.log"; exit 1; }
  # vhs draws the cursor on a layer of its own; the session draws its own, so the text layer is the picture.
  ffmpeg -v error -y -framerate 25 -i "$FRAMES/frame-text-%05d.png" \
    -vf "crop=in_w:$height:0:in_h-$BELOW_PROMPT-$height,fps=25/2,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none" \
    "demo/$name.gif"
}

WANTED="$*"
trap 'rm -rf "$FRAMES" "$FRAMES.tape" "$FRAMES.log"' EXIT

record walk "" 8
record your-turn "buddy:your-turn" 5
record think "buddy:think 18" 20
record edit "buddy:edit think.ts" 4
record run "buddy:run npm test" 9
record send-pr "buddy:send-pr" 5.5 292
