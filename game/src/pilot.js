// The autopilot: it steers the wyrm when no player is driving — behind the title screen, and
// inside the deterministic screenshot scenes, which must show the real game playing itself.
// Its strategy is the game's own lesson, flown honestly: gather embers until the body is long
// enough, then orbit the densest knot of prey with a proper orbit controller — a tangent
// heading with a radial correction — because chasing a point on the ring only ever wobbles,
// while a held orbit closes the coil once a revolution, which is all a loop needs. If a coil
// catches nothing for a while it moves to a new knot. A second, reckless pilot charges
// head-first; the game-over scene uses it, and dies honestly.

import { FIELD, WYRM } from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearest(state, items) {
  const h = state.points[0];
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - h.x, item.y - h.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

/** The centre of the densest knot of prey: where a coil has something to catch. */
function densestKnot(state) {
  if (state.boss) return { x: state.boss.x, y: state.boss.y };
  if (state.enemies.length === 0) return { x: FIELD.width / 2, y: FIELD.height / 2 };
  let bestCluster = null;
  let bestCount = -1;
  for (const enemy of state.enemies) {
    const neighbours = state.enemies.filter(
      (other) => Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 150,
    );
    if (neighbours.length > bestCount) {
      bestCount = neighbours.length;
      bestCluster = neighbours;
    }
  }
  let cx = 0;
  let cy = 0;
  for (const enemy of bestCluster) {
    cx += enemy.x;
    cy += enemy.y;
  }
  return { x: cx / bestCluster.length, y: cy / bestCluster.length };
}

function pickCoil(state, mem) {
  const knot = densestKnot(state);
  const bodyUnits = state.points.length * WYRM.segmentSpacing;
  mem.radius = clamp((bodyUnits / (Math.PI * 2)) * 0.92, 56, 110);
  if (state.boss) {
    // The Moon-Eater is huge: its ring must clear the boss's own body, or the wyrm orbits
    // inside biting range. A three-quarter wrap still binds — the closing chord does the rest.
    mem.radius = clamp(Math.max(mem.radius, 104), 104, 124);
  }
  mem.cx = clamp(knot.x, mem.radius + 34, FIELD.width - mem.radius - 34);
  mem.cy = clamp(knot.y, mem.radius + 34, FIELD.height - mem.radius - 34);
  const h = state.points[0];
  const rx = h.x - mem.cx;
  const ry = h.y - mem.cy;
  const cross = rx * Math.sin(state.heading) - ry * Math.cos(state.heading);
  mem.dir = cross >= 0 ? 1 : -1;
  mem.calls = 0;
  mem.progressMark = state.kills * 1000 + state.embersEaten;
  mem.progressCalls = 0;
}

/** A steer for one step: gather while short, then hold an orbit around the densest knot. */
export function pilotSteer(state) {
  let mem = state.pilot;
  if (!mem || state.time < (mem.lastTime ?? 0)) {
    mem = {
      lastTime: 0, radius: 70, cx: FIELD.width / 2, cy: FIELD.height / 2, dir: 1,
      calls: 0, progressMark: 0, progressCalls: 0,
    };
    state.pilot = mem;
    pickCoil(state, mem);
  }
  mem.lastTime = state.time;
  mem.calls += 1;
  mem.progressCalls += 1;

  if (state.points.length < 46 && state.embers.length > 0) {
    const ember = nearest(state, state.embers);
    if (ember) return { target: { x: ember.x, y: ember.y }, dash: false };
  }

  // A coil that has caught nothing and eaten nothing for ~14 seconds is a coil around
  // nothing: move it. A coil older than ~20 seconds refreshes its knot regardless.
  const progress = state.kills * 1000 + state.embersEaten;
  if (progress !== mem.progressMark) {
    mem.progressMark = progress;
    mem.progressCalls = 0;
  }
  if (mem.progressCalls > 120 * 14 || mem.calls > 120 * 20) pickCoil(state, mem);

  if (state.boss) {
    mem.cx += (state.boss.x - mem.cx) * 0.01;
    mem.cy += (state.boss.y - mem.cy) * 0.01;
    if (state.boss.chargePhase === 'aim' || state.boss.chargePhase === 'charge') {
      // The Moon-Eater telegraphs, then rushes: break sideways and dash, like any hunted
      // thing — and like the player is taught to. Holding the orbit here is how wyrms die.
      const hb = state.points[0];
      const awayX = hb.x - state.boss.x;
      const awayY = hb.y - state.boss.y;
      const d = Math.max(1, Math.hypot(awayX, awayY));
      return {
        target: { x: hb.x + (awayX / d) * 220 - (awayY / d) * 120, y: hb.y + (awayY / d) * 220 + (awayX / d) * 120 },
        dash: true,
      };
    }
  }
  const h = state.points[0];
  const rx = h.x - mem.cx;
  const ry = h.y - mem.cy;
  const distC = Math.max(1, Math.hypot(rx, ry));
  const radialX = rx / distC;
  const radialY = ry / distC;
  // Orbit controller: fly the tangent, and lean in or out by how far the ring is off.
  const tangentX = -radialY * mem.dir;
  const tangentY = radialX * mem.dir;
  const radialError = clamp((distC - mem.radius) * 0.02, -0.85, 0.85);
  const steerX = tangentX - radialX * radialError;
  const steerY = tangentY - radialY * radialError;
  return { target: { x: h.x + steerX * 130, y: h.y + steerY * 130 }, dash: false };
}

/** A steer that wants to die: straight at the nearest hunter, no dash, no fear. */
export function recklessSteer(state) {
  const hunters = state.enemies.filter((enemy) => enemy.kind === 'imp' || enemy.kind === 'wasp');
  const prey = hunters.length > 0 ? nearest(state, hunters) : nearest(state, state.enemies);
  if (!prey) return { target: { x: FIELD.width / 2, y: FIELD.height / 2 }, dash: false };
  return { target: { x: prey.x, y: prey.y }, dash: false };
}
