// Emberwyrm's simulation: the wyrm, its coil, the embers and everything that hunts in the ash.
// Fixed-step and free of rendering, sound and wall-clock time: main.js advances it, render.js
// only draws what it holds, and shots.js can replay it exactly from a seed. The one verb that
// matters is the loop: when the head crosses its own body, the ring of points between becomes a
// polygon, and anything caught inside is crushed back into embers — at the price of the body
// the loop was made of, so length is both weapon and wealth.

import { COMBO, EMBER, ENEMY, FIELD, LOOP, NIGHTS, WYRM } from './config.js';
import { pick, range } from './random.js';

export const EV = {
  EMBER: 1,
  CRUSH: 2,
  HURT: 4,
  NIGHT_CLEAR: 8,
  GAME_OVER: 16,
  VICTORY: 32,
  DASH: 64,
  BITE: 128,
  BIND: 256,
};

function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

function angleLerpTurn(heading, desired, maxTurn) {
  let diff = desired - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > maxTurn) return heading + maxTurn;
  if (diff < -maxTurn) return heading - maxTurn;
  return heading + diff;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}



export function createWorld(random) {
  const state = {
    time: 0,
    points: [],
    heading: 0,
    targetSegments: WYRM.startSegments,
    growthBank: 0,
    scales: WYRM.startScales,
    score: 0,
    embersEaten: 0,
    kills: 0,
    killsThisNight: 0,
    nightIndex: 0,
    quota: NIGHTS[0].quota,
    bossNight: false,
    boss: null,
    bossBinds: 0,
    enemies: [],
    embers: [],
    texts: [],
    bursts: [],
    combo: { chain: 0, timer: 0, multiplier: 1 },
    dash: { active: 0, cooldown: 0 },
    invulnTimer: 0,
    loopArmed: true,
    loopCooldown: 0,
    loopCross: null,
    spawnTimer: 1,
    emberTimer: 1,
    mods: {
      speedMul: 1,
      turnMul: 1,
      magnetMul: 1,
      scoreMul: 1,
      loopCostMul: 1,
      dashCooldownMul: 1,
      dashTimeMul: 1,
      growthBonus: 0,
      invulnBonus: 0,
    },
    dead: false,
    won: false,
    nightDone: false,
    attract: false,
  };

  function head() {
    return state.points[0];
  }

  function burst(x, y, color, count, speed = 190) {
    state.bursts.push({ x, y, color, count, speed });
  }

  function popup(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 1.15, maxLife: 1.15 });
  }

  function spawnEmber(x, y, vx = 0, vy = 0) {
    state.embers.push({ x, y, vx, vy, phase: random() * Math.PI * 2 });
  }

  function scatterEmbers(count) {
    for (let i = 0; i < count; i += 1) {
      spawnEmber(range(random, 90, FIELD.width - 90), range(random, 90, FIELD.height - 90));
    }
  }

  function spawnEnemy(kind, x, y) {
    const spec = ENEMY[kind];
    const enemy = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      heading: random() * Math.PI * 2,
      radius: spec.radius,
      age: 0,
      biteTimer: range(random, 0.4, 1),
      mode: 'rest',
      modeTimer: range(random, 0.5, ENEMY.wasp.restSeconds),
      aimX: 0,
      aimY: 0,
      bindStun: 0,
      bindImmune: 0,
      chargeTimer: 4.5,
      chargePhase: 'stalk',
      phase: random() * Math.PI * 2,
    };
    state.enemies.push(enemy);
    if (kind === 'boss') state.boss = enemy;
    return enemy;
  }

  function edgeSpawnPoint() {
    const h = head();
    for (let tries = 0; tries < 8; tries += 1) {
      const side = Math.floor(random() * 4);
      const x = side === 0 ? 40 : side === 1 ? FIELD.width - 40 : range(random, 60, FIELD.width - 60);
      const y = side === 2 ? 40 : side === 3 ? FIELD.height - 40 : range(random, 60, FIELD.height - 60);
      if (distance(x, y, h.x, h.y) > 300) return { x, y };
    }
    return { x: FIELD.width - 60, y: 60 };
  }

  function reset() {
    state.time = 0;
    state.points = [];
    const cx = FIELD.width / 2;
    const cy = FIELD.height / 2;
    for (let i = 0; i < WYRM.startSegments; i += 1) {
      state.points.push({ x: cx - i * WYRM.segmentSpacing, y: cy });
    }
    state.heading = 0;
    state.targetSegments = WYRM.startSegments;
    state.growthBank = 0;
    state.scales = WYRM.startScales;
    state.score = 0;
    state.embersEaten = 0;
    state.kills = 0;
    state.enemies = [];
    state.embers = [];
    state.texts = [];
    state.bursts = [];
    state.combo = { chain: 0, timer: 0, multiplier: 1 };
    state.dash = { active: 0, cooldown: 0 };
    state.invulnTimer = 0;
    state.loopArmed = true;
    state.loopCooldown = 0;
    state.loopCross = null;
    state.dead = false;
    state.won = false;
    state.attract = false;
    state.mods = {
      speedMul: 1, turnMul: 1, magnetMul: 1, scoreMul: 1, loopCostMul: 1,
      dashCooldownMul: 1, dashTimeMul: 1, growthBonus: 0, invulnBonus: 0,
    };
    scatterEmbers(10);
    startNight(0);
  }

  function startNight(index) {
    state.nightIndex = index;
    const night = NIGHTS[index];
    state.quota = night.quota;
    state.killsThisNight = 0;
    state.nightDone = false;
    state.bossNight = Boolean(night.boss);
    state.bossBinds = 0;
    state.spawnTimer = 0.8;
    state.enemies = [];
    state.boss = null;
    if (state.bossNight) {
      spawnEnemy('boss', FIELD.width / 2, 150);
      popup(FIELD.width / 2, 210, 'THE MOON-EATER COMES', '#e8e3f5');
    } else {
      popup(FIELD.width / 2, 120, `NIGHT ${index + 1}`, '#ffb347');
    }
  }

  function awardScore(base, x, y) {
    const value = Math.round(base * state.combo.multiplier * state.mods.scoreMul);
    state.score += value;
    popup(x, y, `+${value}`, '#ffe6b0');
    return value;
  }

  function registerKill() {
    state.combo.chain += 1;
    state.combo.timer = COMBO.windowSeconds;
    state.combo.multiplier = Math.min(1 + state.combo.chain, COMBO.maxMultiplier);
    state.kills += 1;
    state.killsThisNight += 1;
  }

  function dropEmbers(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = range(random, 30, 130);
      spawnEmber(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  function crushEnemy(enemy, events) {
    const spec = ENEMY[enemy.kind];
    registerKill();
    awardScore(spec.score, enemy.x, enemy.y);
    dropEmbers(enemy.x, enemy.y, enemy.kind === 'hulk' ? 5 : 2 + Math.floor(random() * 2));
    burst(enemy.x, enemy.y, '#ffb347', enemy.kind === 'hulk' ? 34 : 18);
    state.enemies.splice(state.enemies.indexOf(enemy), 1);
    return events | EV.CRUSH;
  }

  function hurt(events) {
    if (state.invulnTimer > 0 || state.attract) return events;
    state.scales -= 1;
    state.invulnTimer = WYRM.hitInvulnerableSeconds + state.mods.invulnBonus;
    state.combo.chain = 0;
    state.combo.multiplier = 1;
    const h = head();
    burst(h.x, h.y, '#e5484d', 22, 240);
    popup(h.x, h.y - 26, 'SCALE LOST', '#e5484d');
    if (state.scales <= 0) {
      state.dead = true;
      burst(h.x, h.y, '#ff7847', 60, 320);
      return events | EV.HURT | EV.GAME_OVER;
    }
    return events | EV.HURT;
  }

  /** The head just reached body point `closeIndex`: judge what the coil caught, if anything. */
  function closeLoopAt(closeIndex, events) {
    const points = state.points;
    const h = head();
    state.loopArmed = false;
    state.loopCross = { x: points[closeIndex].x, y: points[closeIndex].y };
    const polygon = points.slice(0, closeIndex + 1);
    const caught = state.enemies.filter((enemy) => pointInPolygon(enemy.x, enemy.y, polygon));
    if (caught.length === 0) return events;
    let crushed = 0;
    for (const enemy of caught) {
      if (enemy.kind === 'boss') {
        if (enemy.bindImmune > 0) continue;
        state.bossBinds += 1;
        enemy.bindStun = 1.2;
        enemy.bindImmune = 6;
        enemy.chargePhase = 'stalk';
        burst(enemy.x, enemy.y, '#e8e3f5', 46, 300);
        popup(enemy.x, enemy.y - 70, `BOUND ${state.bossBinds} OF ${ENEMY.boss.bindsNeeded}`, '#e8e3f5');
        events |= EV.BIND;
        if (state.bossBinds >= ENEMY.boss.bindsNeeded) {
          registerKill();
          awardScore(ENEMY.boss.score, enemy.x, enemy.y);
          dropEmbers(enemy.x, enemy.y, 14);
          burst(enemy.x, enemy.y, '#ffe6b0', 90, 380);
          state.enemies.splice(state.enemies.indexOf(enemy), 1);
          state.boss = null;
          state.won = true;
          events |= EV.VICTORY;
        }
      } else {
        events = crushEnemy(enemy, events);
        crushed += 1;
      }
    }
    if (crushed > 0) {
      const rawCost = Math.floor(closeIndex * LOOP.costShare * state.mods.loopCostMul);
      const cost = Math.min(rawCost, Math.max(0, state.targetSegments - WYRM.minSegments));
      state.targetSegments -= cost;
      state.loopCooldown = 0.4;
      if (crushed >= 3) popup(h.x, h.y - 30, `${crushed} IN ONE COIL!`, '#ffb347');
    }
    return events;
  }

  function stepEnemies(dt, events) {
    const h = head();
    const night = NIGHTS[state.nightIndex];
    state.spawnTimer -= dt;
    const cap = state.bossNight ? 5 : 10 + state.nightIndex;
    if (!state.nightDone && state.spawnTimer <= 0 && state.enemies.length < cap + (state.boss ? 1 : 0)) {
      state.spawnTimer = night.spawnEvery * range(random, 0.75, 1.25);
      const at = edgeSpawnPoint();
      spawnEnemy(pick(random, night.kinds), at.x, at.y);
    }
    for (const enemy of state.enemies) {
      enemy.age += dt;
      const spec = ENEMY[enemy.kind];
      if (enemy.kind === 'moth') {
        enemy.heading += (random() - 0.5) * 2.6 * dt;
        let vx = Math.cos(enemy.heading) * spec.speed;
        let vy = Math.sin(enemy.heading) * spec.speed;
        // Moths flock loosely: each drifts toward the local knot of the others, so the field
        // gathers into drifting flocks a coil can actually surround — and be herded.
        let flockX = 0;
        let flockY = 0;
        let flockCount = 0;
        for (const other of state.enemies) {
          if (other !== enemy && other.kind === 'moth') {
            const dd = distance(enemy.x, enemy.y, other.x, other.y);
            if (dd < 230 && dd > 1) {
              flockX += other.x;
              flockY += other.y;
              flockCount += 1;
            }
          }
        }
        if (flockCount > 0) {
          vx += (flockX / flockCount - enemy.x) * 0.22;
          vy += (flockY / flockCount - enemy.y) * 0.22;
        }
        const dHead = distance(enemy.x, enemy.y, h.x, h.y);
        if (dHead < spec.fleeRadius && dHead > 1) {
          const flee = ((enemy.x - h.x) / dHead) * 115;
          const fleeY = ((enemy.y - h.y) / dHead) * 115;
          vx += flee;
          vy += fleeY;
        }
        enemy.vx = vx;
        enemy.vy = vy;
      } else if (enemy.kind === 'imp') {
        const d = Math.max(1, distance(enemy.x, enemy.y, h.x, h.y));
        enemy.vx += (((h.x - enemy.x) / d) * spec.speed - enemy.vx) * Math.min(1, 3 * dt);
        enemy.vy += (((h.y - enemy.y) / d) * spec.speed - enemy.vy) * Math.min(1, 3 * dt);
        enemy.biteTimer -= dt;
        if (enemy.biteTimer <= 0) {
          enemy.biteTimer = spec.biteCooldown;
          for (let i = WYRM.neckGrace; i < state.points.length; i += 4) {
            const p = state.points[i];
            if (distance(enemy.x, enemy.y, p.x, p.y) < enemy.radius + WYRM.radius && state.targetSegments > WYRM.minSegments) {
              state.targetSegments -= 1;
              burst(p.x, p.y, '#e5484d', 7, 130);
              events |= EV.BITE;
              break;
            }
          }
        }
      } else if (enemy.kind === 'wasp') {
        enemy.modeTimer -= dt;
        if (enemy.mode === 'rest') {
          enemy.heading += (random() - 0.5) * 1.6 * dt;
          enemy.vx = Math.cos(enemy.heading) * 55;
          enemy.vy = Math.sin(enemy.heading) * 55;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 'aim';
            enemy.modeTimer = 0.45;
          }
        } else if (enemy.mode === 'aim') {
          enemy.vx *= 0.8;
          enemy.vy *= 0.8;
          enemy.aimX = h.x;
          enemy.aimY = h.y;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 'burst';
            enemy.modeTimer = spec.burstSeconds;
            const d = Math.max(1, distance(enemy.x, enemy.y, enemy.aimX, enemy.aimY));
            enemy.vx = ((enemy.aimX - enemy.x) / d) * spec.speed;
            enemy.vy = ((enemy.aimY - enemy.y) / d) * spec.speed;
          }
        } else {
          if (enemy.modeTimer <= 0) {
            enemy.mode = 'rest';
            enemy.modeTimer = spec.restSeconds * range(random, 0.8, 1.3);
          }
        }
      } else if (enemy.kind === 'hulk') {
        const mid = state.points[Math.floor(state.points.length / 2)] ?? h;
        const d = Math.max(1, distance(enemy.x, enemy.y, mid.x, mid.y));
        enemy.vx = ((mid.x - enemy.x) / d) * spec.speed;
        enemy.vy = ((mid.y - enemy.y) / d) * spec.speed;
      } else if (enemy.kind === 'boss') {
        if (enemy.bindImmune > 0) {
          // Freshly bound, the Moon-Eater slips its coil: for a few seconds no loop can bind
          // it again, and it flees the head instead of hunting embers.
          enemy.bindImmune -= dt;
          const d = Math.max(1, distance(enemy.x, enemy.y, h.x, h.y));
          enemy.vx = ((enemy.x - h.x) / d) * spec.speed * 1.7;
          enemy.vy = ((enemy.y - h.y) / d) * spec.speed * 1.7;
          if (enemy.bindStun > 0) enemy.bindStun -= dt;
        } else if (enemy.bindStun > 0) {
          enemy.bindStun -= dt;
          enemy.vx *= 0.9;
          enemy.vy *= 0.9;
        } else if (enemy.chargePhase === 'stalk') {
          let target = null;
          let best = Infinity;
          for (const ember of state.embers) {
            const d = distance(enemy.x, enemy.y, ember.x, ember.y);
            if (d < best) {
              best = d;
              target = ember;
            }
          }
          const tx = target ? target.x : h.x;
          const ty = target ? target.y : h.y;
          const d = Math.max(1, distance(enemy.x, enemy.y, tx, ty));
          const speedNow = spec.speed * (1 + state.bossBinds * 0.25);
          enemy.vx = ((tx - enemy.x) / d) * speedNow;
          enemy.vy = ((ty - enemy.y) / d) * speedNow;
          if (target && best < enemy.radius + EMBER.radius) {
            state.embers.splice(state.embers.indexOf(target), 1);
            burst(target.x, target.y, '#8d84a0', 8, 110);
          }
          enemy.chargeTimer -= dt;
          if (enemy.chargeTimer <= 0) {
            enemy.chargePhase = 'aim';
            enemy.modeTimer = 0.7;
          }
        } else if (enemy.chargePhase === 'aim') {
          enemy.vx *= 0.85;
          enemy.vy *= 0.85;
          enemy.aimX = h.x;
          enemy.aimY = h.y;
          enemy.modeTimer -= dt;
          if (enemy.modeTimer <= 0) {
            enemy.chargePhase = 'charge';
            enemy.modeTimer = 0.85;
            const d = Math.max(1, distance(enemy.x, enemy.y, enemy.aimX, enemy.aimY));
            enemy.vx = ((enemy.aimX - enemy.x) / d) * 305;
            enemy.vy = ((enemy.aimY - enemy.y) / d) * 305;
          }
        } else {
          enemy.modeTimer -= dt;
          if (enemy.modeTimer <= 0) {
            enemy.chargePhase = 'stalk';
            enemy.chargeTimer = Math.max(2.6, 5.2 - state.bossBinds * 0.8);
          }
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      const m = enemy.radius;
      if (enemy.x < m) { enemy.x = m; enemy.vx = Math.abs(enemy.vx); enemy.heading = 0; }
      if (enemy.x > FIELD.width - m) { enemy.x = FIELD.width - m; enemy.vx = -Math.abs(enemy.vx); enemy.heading = Math.PI; }
      if (enemy.y < m) { enemy.y = m; enemy.vy = Math.abs(enemy.vy); }
      if (enemy.y > FIELD.height - m) { enemy.y = FIELD.height - m; enemy.vy = -Math.abs(enemy.vy); }
    }
    // Gentle separation, so packs read as individuals instead of a single blob.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const d = distance(a.x, a.y, b.x, b.y);
        const min = a.radius + b.radius;
        if (d > 0.01 && d < min) {
          const push = ((min - d) / d) * 0.5;
          const px = (a.x - b.x) * push;
          const py = (a.y - b.y) * push;
          if (a.kind !== 'boss') { a.x += px; a.y += py; }
          if (b.kind !== 'boss') { b.x -= px; b.y -= py; }
        }
      }
    }
    return events;
  }

  function stepEmbers(dt, events) {
    const h = head();
    state.emberTimer -= dt;
    if (state.emberTimer <= 0) {
      state.emberTimer = 2.2;
      if (state.embers.length < 12) {
        spawnEmber(range(random, 80, FIELD.width - 80), range(random, 80, FIELD.height - 80));
      }
    }
    const magnet = EMBER.magnetRadius * state.mods.magnetMul;
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const ember = state.embers[i];
      ember.vx *= 0.92;
      ember.vy *= 0.92;
      const d = distance(ember.x, ember.y, h.x, h.y);
      if (d < magnet && d > 1) {
        ember.vx += ((h.x - ember.x) / d) * EMBER.magnetSpeed * dt * 8;
        ember.vy += ((h.y - ember.y) / d) * EMBER.magnetSpeed * dt * 8;
      }
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      if (d < WYRM.radius + EMBER.radius + 3) {
        state.embers.splice(i, 1);
        state.embersEaten += 1;
        state.growthBank += EMBER.growthPerEmber + state.mods.growthBonus;
        state.score += Math.round(EMBER.score * state.mods.scoreMul);
        events |= EV.EMBER;
      }
    }
    return events;
  }

  function stepContacts(events) {
    const h = head();
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      const d = distance(h.x, h.y, enemy.x, enemy.y);
      if (d >= WYRM.radius + enemy.radius * 0.82) continue;
      const dashing = state.dash.active > 0;
      if (enemy.kind === 'moth') {
        // A moth that meets the head is eaten, not a wound: moths are food that happens to
        // fly. The hunters — imps, wasps, the hulk and the Moon-Eater — are the danger.
        registerKill();
        awardScore(ENEMY.moth.score, enemy.x, enemy.y);
        burst(enemy.x, enemy.y, '#b8a6d9', 10);
        state.enemies.splice(i, 1);
      } else if ((enemy.kind === 'wasp' || enemy.kind === 'imp') && (dashing || state.invulnTimer <= 0)) {
        if (dashing) {
          registerKill();
          awardScore(Math.round(ENEMY[enemy.kind].score / 2), enemy.x, enemy.y);
          burst(enemy.x, enemy.y, '#ffd9a0', 12);
          state.enemies.splice(i, 1);
        } else {
          burst(enemy.x, enemy.y, '#b8a6d9', 10);
          state.enemies.splice(i, 1);
          events = hurt(events);
        }
      } else if (enemy.kind === 'hulk' || enemy.kind === 'boss') {
        const push = WYRM.radius + enemy.radius * 0.82 - d + 1;
        if (d > 0.01) {
          h.x += ((h.x - enemy.x) / d) * push;
          h.y += ((h.y - enemy.y) / d) * push;
        }
        if (!dashing) events = hurt(events);
      }
    }
    return events;
  }

  /** Advance the whole world one fixed step. `steer` is {target} or {turn}; `dash` a boolean. */
  function step(dt, steer, dash) {
    let events = 0;
    state.time += dt;
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];
      text.life -= dt;
      text.y -= 24 * dt;
      if (text.life <= 0) state.texts.splice(i, 1);
    }
    if (state.dead || state.won) return events;

    if (state.combo.timer > 0) {
      state.combo.timer -= dt;
      if (state.combo.timer <= 0) {
        state.combo.chain = 0;
        state.combo.multiplier = 1;
      }
    }
    if (state.invulnTimer > 0) state.invulnTimer -= dt;
    if (state.loopCooldown > 0) state.loopCooldown -= dt;
    state.dash.cooldown = Math.max(0, state.dash.cooldown - dt);
    state.dash.active = Math.max(0, state.dash.active - dt);
    if (dash && state.dash.cooldown <= 0 && state.dash.active <= 0) {
      state.dash.active = WYRM.dashSeconds * state.mods.dashTimeMul;
      state.dash.cooldown = WYRM.dashCooldown * state.mods.dashCooldownMul;
      events |= EV.DASH;
    }

    const h = head();
    if (steer && steer.target) {
      const desired = Math.atan2(steer.target.y - h.y, steer.target.x - h.x);
      state.heading = angleLerpTurn(state.heading, desired, WYRM.turnRate * state.mods.turnMul * dt);
    } else if (steer && steer.turn) {
      state.heading += steer.turn * WYRM.turnRate * state.mods.turnMul * dt;
    }
    const speed = state.dash.active > 0 ? WYRM.dashSpeed : WYRM.baseSpeed * state.mods.speedMul;
    h.x += Math.cos(state.heading) * speed * dt;
    h.y += Math.sin(state.heading) * speed * dt;
    h.x = Math.min(FIELD.width - WYRM.radius, Math.max(WYRM.radius, h.x));
    h.y = Math.min(FIELD.height - WYRM.radius, Math.max(WYRM.radius, h.y));

    const points = state.points;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const p = points[i];
      let dx = p.x - prev.x;
      let dy = p.y - prev.y;
      let d = Math.hypot(dx, dy);
      if (d < 0.0001) {
        dx = Math.cos(state.heading);
        dy = Math.sin(state.heading);
        d = 1;
      }
      p.x = prev.x + (dx / d) * WYRM.segmentSpacing;
      p.y = prev.y + (dy / d) * WYRM.segmentSpacing;
    }
    // Embers bank growth one segment at a time; the body then eases toward its target length,
    // adding at the tail as it grows and shedding from the tail as loops spend it.
    while (state.growthBank >= 1) {
      state.growthBank -= 1;
      state.targetSegments += 1;
    }
    if (points.length < state.targetSegments) {
      points.push({ ...points[points.length - 1] });
    }
    while (points.length > state.targetSegments && points.length > WYRM.minSegments) {
      points.pop();
    }

    // The coil closes when the head reaches a body point far enough behind the neck: at that
    // moment the ring of body between here and there is a loop, and whatever it surrounds is
    // judged. A loop that catches nothing costs nothing; one that catches prey spends body.
    if (state.loopCooldown <= 0) {
      if (state.loopArmed) {
        let closeIndex = -1;
        let closeDist = Infinity;
        for (let j = Math.max(WYRM.neckGrace, LOOP.minPoints); j < points.length; j += 1) {
          const d = distance(h.x, h.y, points[j].x, points[j].y);
          if (d < LOOP.closeRadius && d < closeDist) {
            closeDist = d;
            closeIndex = j;
          }
        }
        if (closeIndex !== -1) events = closeLoopAt(closeIndex, events);
      } else if (state.loopCross === null || distance(h.x, h.y, state.loopCross.x, state.loopCross.y) > LOOP.rearmDistance) {
        state.loopArmed = true;
        state.loopCross = null;
      }
    }

    events = stepEnemies(dt, events);
    events = stepEmbers(dt, events);
    events = stepContacts(events);

    if (!state.bossNight && !state.nightDone && state.killsThisNight >= state.quota) {
      state.nightDone = true;
      events |= EV.NIGHT_CLEAR;
    }
    return events;
  }

  return { state, reset, startNight, step };
}
