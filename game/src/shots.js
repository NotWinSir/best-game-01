// Deterministic screenshot scenes. The page reads ?shot=<scene>&seed=<n>; main.js builds the
// world from that seed and hands it here; each scene then plays the real simulation forward
// with the autopilot — no state is faked, the frames are the game itself, caught at a good
// moment — and reports which screen to show. Same seed, same scene, every time.

import { STEP } from './config.js';
import { EV } from './world.js';
import { pilotSteer, recklessSteer } from './pilot.js';
import { offerThree } from './upgrades.js';

export function parseShot(location) {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot');
  if (!name) return null;
  const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
  return { name, seed };
}

function playSteps(world, steerOf, maxSeconds, until) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    const steer = steerOf(world.state);
    const events = world.step(STEP, steer, steer.dash);
    if (until(world.state, events)) return true;
  }
  return false;
}

/** Stage `name` on a freshly reset world. Returns { screen, offered } for main.js to show. */
export function stageShot(world, name, random) {
  world.reset();
  if (name === 'title') {
    world.state.attract = true;
    playSteps(world, pilotSteer, 16, () => world.state.time >= 14);
    return { screen: 'title', offered: [] };
  }
  if (name === 'play') {
    // Freeze not on the crush itself but a breath later, when the wyrm is visibly coiling
    // again: the frame should show the verb of the game, not just its aftermath.
    let crushes = 0;
    playSteps(world, pilotSteer, 240, (state, events) => {
      if (events & EV.CRUSH) crushes += 1;
      return crushes >= 1 && state.time >= 14;
    });
    playSteps(world, pilotSteer, 30, (state) => {
      const h = state.points[0];
      for (let j = 22; j < state.points.length; j += 1) {
        if (Math.hypot(h.x - state.points[j].x, h.y - state.points[j].y) < 58) return true;
      }
      return false;
    });
    return { screen: 'play', offered: [] };
  }
  if (name === 'upgrade') {
    const cleared = playSteps(world, pilotSteer, 420, (state, events) => Boolean(events & EV.NIGHT_CLEAR));
    if (cleared) return { screen: 'upgrade', offered: offerThree(random) };
    return { screen: 'play', offered: [] };
  }
  if (name === 'over') {
    // Night 1 holds only moths, and moths are food — an honest death needs the hunters, so
    // this scene plays the third night. First the pilot hunts properly for a while, so the
    // final tally is a real run's; then it turns reckless, and the hunters finish it.
    world.startNight(2);
    playSteps(world, pilotSteer, 90, (state) => state.kills >= 6 || state.dead);
    if (!world.state.dead) {
      playSteps(world, recklessSteer, 240, (state) => state.dead);
    }
    return { screen: 'over', offered: [] };
  }
  return { screen: 'title', offered: [] };
}
