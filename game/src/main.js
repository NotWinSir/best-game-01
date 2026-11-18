// Emberwyrm's boot and screen flow. Owns the fixed-step clock, the screens (title, play,
// upgrade, pause, over, victory), the wiring between input edges, world events, sound and
// screen shake, and the saved best score. The simulation itself lives in world.js; nothing
// here knows how a loop crushes, and world.js knows nothing of screens.

import { FIELD, STEP } from './config.js';
import { makeRandom } from './random.js';
import { createInput, steerFrom, dashHeld } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, EV } from './world.js';
import { offerThree } from './upgrades.js';
import { createRenderer, upgradeCardRects } from './render.js';
import { parseShot, stageShot } from './shots.js';
import { pilotSteer } from './pilot.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const shot = parseShot(window.location);
const seed = shot ? shot.seed : (Date.now() % 2147483646) + 1;
const random = makeRandom(seed);
const world = createWorld(random);
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem('emberwyrm-best') ?? '0', 10) || 0;
} catch {
  best = 0;
}

let screen = 'title';
let offered = [];
let isBest = false;
world.reset();
world.state.attract = true;

function saveBest() {
  if (world.state.score > best) {
    best = world.state.score;
    isBest = true;
    try {
      window.localStorage.setItem('emberwyrm-best', String(best));
    } catch {
      // A private window may refuse storage; the hunt goes on regardless.
    }
  }
}

function setStatus(text) {
  if (status) status.textContent = text;
}

function startRun() {
  world.reset();
  world.state.attract = false;
  isBest = false;
  offered = [];
  screen = 'play';
  audio.unlock();
  setStatus('Emberwyrm — night 1. Coil around the moths to crush them.');
}

function chooseUpgrade(index) {
  const upgrade = offered[index];
  if (!upgrade) return;
  upgrade.apply(world.state);
  audio.choose();
  world.startNight(world.state.nightIndex + 1);
  world.state.attract = false;
  offered = [];
  screen = 'play';
  setStatus(`Emberwyrm — night ${world.state.nightIndex + 1}. ${upgrade.name} grown.`);
}

function reactToEvents(events) {
  if (events & EV.EMBER) audio.ember(world.state.combo.chain);
  if (events & EV.CRUSH) {
    audio.crush(3);
    renderer.shake(5);
  }
  if (events & EV.BIND) {
    audio.crush(3);
    renderer.shake(7);
  }
  if (events & EV.BITE) renderer.shake(2);
  if (events & EV.DASH) audio.dash();
  if (events & EV.HURT) {
    audio.hurt();
    renderer.shake(9);
  }
  if (events & EV.NIGHT_CLEAR) {
    audio.nightClear();
    offered = offerThree(random);
    world.state.attract = true;
    screen = 'upgrade';
    setStatus(`Night ${world.state.nightIndex + 1} cleared. Choose a scale: 1, 2 or 3.`);
  }
  if (events & EV.GAME_OVER) {
    saveBest();
    audio.gameOver();
    screen = 'over';
    setStatus(`Game over. Score ${world.state.score}. Press Enter to hunt again.`);
  }
  if (events & EV.VICTORY) {
    saveBest();
    audio.victory();
    screen = 'victory';
    setStatus(`Dawn breaks! Score ${world.state.score}. Press Enter to hunt again.`);
  }
}

function handleEdges() {
  for (const code of input.takeEdges()) {
    if (code === 'KeyM') {
      audio.toggleMute();
      continue;
    }
    if (screen === 'title') {
      if (code === 'Enter' || code === 'Space' || code === 'PointerDown') startRun();
    } else if (screen === 'play') {
      if (code === 'KeyP' || code === 'Escape') {
        screen = 'pause';
        setStatus('Paused. Press P to resume.');
      }
    } else if (screen === 'pause') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Enter') screen = 'play';
    } else if (screen === 'upgrade') {
      if (code === 'Digit1') chooseUpgrade(0);
      else if (code === 'Digit2') chooseUpgrade(1);
      else if (code === 'Digit3') chooseUpgrade(2);
      else if (code === 'PointerDown') {
        const { x, y } = input.pointer;
        const rect = upgradeCardRects().find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (rect) chooseUpgrade(rect.index);
      }
    } else if (screen === 'over' || screen === 'victory') {
      if (code === 'Enter' || code === 'Space') startRun();
    }
  }
}

function stepWorld(dt) {
  let events = 0;
  if (screen === 'title' || screen === 'upgrade') {
    const steer = pilotSteer(world.state);
    events = world.step(dt, steer, false);
    if (screen === 'title') {
      events &= ~(EV.NIGHT_CLEAR | EV.GAME_OVER | EV.VICTORY);
      if (world.state.enemies.length === 0 && world.state.embers.length <= 2) {
        world.reset();
        world.state.attract = true;
      }
    }
  } else if (screen === 'play') {
    events = world.step(dt, steerFrom(input), dashHeld(input));
  } else if (screen === 'over' || screen === 'victory') {
    events = world.step(dt, { turn: 0, target: null }, false);
  }
  reactToEvents(events);
}

function ui() {
  return { screen, offered, best, isBest };
}

if (shot) {
  const staged = stageShot(world, shot.name, makeRandom(seed ^ 0x5eed));
  screen = staged.screen;
  offered = staged.offered;
  if (screen === 'over' || screen === 'victory') saveBest();
  for (let i = 0; i < 4; i += 1) renderer.draw(world.state, ui(), 1 / 60);
  window.__shotReady = true;
  setStatus(`Emberwyrm — screenshot scene ${shot.name}.`);
} else {
  setStatus('Emberwyrm — press Enter to hunt. Coil around the moths to crush them.');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    handleEdges();
    if (screen !== 'pause') {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
        if (screen === 'pause') break;
      }
    } else {
      input.takeEdges();
    }
    audio.update(dt);
    renderer.draw(world.state, ui(), dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.__emberwyrm = { world, startRun };
