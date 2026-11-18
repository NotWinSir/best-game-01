# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/NotWinSir/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/NotWinSir/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberwyrm** — a coil-and-crush survival game in seven nights. The dark ate the dawn, and
you are the last ember-wyrm of the Ashen Deep: a serpent of living cinder whose body is both
its weapon and its wealth. There is no gun. To kill, you fly a full loop around your prey and
close the coil — whatever the ring surrounds is crushed back into embers. Eat the embers to
grow longer, because every loop you close spends a piece of that length. Survive the night,
choose the scale you grow back with, and on the seventh night bind the Moon-Eater three
times to bring the dawn back.

- **One verb, honestly simulated** — loop-closing is geometry, not a script: when the head
  reaches its own body, the ring of points between becomes a polygon and everything inside
  it is judged. Empty loops cost nothing; full ones pay out in embers and cost body.
- **Prey with behaviour** — Hollow Moths flock into drifting knots that can be herded and
  ringed (and are safe to eat head-on: they are food that flies). Cinder Imps hunt your head
  and bite segments off your body. Ash Wasps telegraph and dive. The Gloom Hulk can only be
  killed by a coil. The Moon-Eater eats your embers, rushes you on a telegraph, and slips
  one binding at a time — bind it three times across one long night to win.
- **A run that bends toward your choices** — between nights the wyrm sheds and you pick one
  of three Scales from a pool of eight (Emberheart, Longcoil, Swiftfin, Magnetspine,
  Brightlure, Thickhide, Dashfins, Frugal Coil). Most stack, so no two hunts grow alike.
- **Complete game shape** — title screen over a living hunt, seven nights with quotas and a
  boss night, combo multiplier with a decay timer, dash with cooldown, pause, game-over and
  victory screens with full run stats, and a best score that persists.
- **Sound, synthesised live** — no audio files: WebAudio oscillators and filtered noise make
  the ember chimes (which rise with your combo), the crush, the hurt thud, the night-clear
  arpeggio, and a slow drone with a pentatonic pluck pattern underneath the hunt. M mutes.
- **Deterministic to the bone** — a fixed 120 Hz step and a seeded RNG (the simulation never
  calls `Math.random`), so a seed replays exactly. No build step, no dependencies, no network:
  plain static files and ES modules.

## Run it

```sh
node serve.ts            # then open http://localhost:8080
```

Steer with the mouse, or turn with A / D and the arrow keys. Shift or Space dashes, P pauses,
Enter starts and restarts. On a touch of strategy: grow first — a loop can only close once
your body is longer than the ring you mean to fly — then coil around the flock, not through it.

## How it is put together

One job per file, so the outline reads like a table of contents:

- `game/src/config.js` — every tuning number: the wyrm, the loop, the combo, each enemy,
  the seven nights, the palette.
- `game/src/world.js` — the whole simulation: movement and the follow-the-leader body, loop
  detection and crushing, five enemy behaviours, ember economy, damage, nights, the boss.
- `game/src/pilot.js` — an autopilot that plays the game properly (gather, then hold an
  orbit around the densest knot of prey with a tangent-plus-radial controller, dodge the
  Moon-Eater's rush). It drives the title backdrop and the screenshot scenes.
- `game/src/render.js` — all drawing: the ash field, the glowing coil, the five enemy kinds,
  particles, HUD, and the title / upgrade / pause / game-over / victory screens.
- `game/src/audio.js` — the WebAudio synth: effects and the night music.
- `game/src/upgrades.js` — the eight Scales and how a night's three offers are drawn.
- `game/src/input.js`, `game/src/random.js`, `game/src/shots.js`, `game/src/main.js` —
  keyboard and pointer as sampled state, the seeded RNG, the deterministic `?shot=` scenes,
  and the boot + screen flow that wires everything together.
- `main.ts` — the grader entrypoint: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json` with the kit's vendored library. Byte-identical on
  repeat runs.

Screenshots are real frames staged through the game's own `?shot=` routes (title, a coil
closing mid-hunt, the scale choice, a game over the hunters earned) — what they show is what
the code does.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9srkgwx7&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
