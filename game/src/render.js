// Everything Emberwyrm looks like: the ash field, the glowing coil, the things that hunt in
// the dark, the HUD, and the screens between the action. Pure drawing — it reads world state
// and a small `ui` object from main.js, keeps its own particles and screen shake, and never
// touches the simulation. All animation derives from the world's clock, so a staged scene
// renders the same frame every time.

import { EMBER, ENEMY, FIELD, NIGHTS, PALETTE, WYRM } from './config.js';
import { makeRandom } from './random.js';

const W = FIELD.width;
const H = FIELD.height;

let cardRects = [];

export function upgradeCardRects() {
  return cardRects;
}

function lerpColor(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line !== '') ctx.fillText(line, x, yy);
  return yy;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const cosmetic = makeRandom(20261118);
  let shakeMag = 0;
  let shakeAge = 1;

  const backdrop = document.createElement('canvas');
  backdrop.width = W;
  backdrop.height = H;
  {
    const b = backdrop.getContext('2d');
    const grad = b.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 760);
    grad.addColorStop(0, PALETTE.ashSoft);
    grad.addColorStop(1, PALETTE.ash);
    b.fillStyle = grad;
    b.fillRect(0, 0, W, H);
    const speckles = makeRandom(4242);
    for (let i = 0; i < 900; i += 1) {
      const x = speckles() * W;
      const y = speckles() * H;
      const r = speckles() * 1.6 + 0.3;
      b.fillStyle = speckles() > 0.92 ? 'rgba(255,179,71,0.20)' : 'rgba(200,190,220,0.10)';
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
    }
  }

  function spawnParticles(burst) {
    for (let i = 0; i < burst.count; i += 1) {
      const angle = cosmetic() * Math.PI * 2;
      const speed = (0.3 + cosmetic() * 0.7) * burst.speed;
      particles.push({
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.55 + cosmetic() * 0.5,
        maxLife: 1,
        color: burst.color,
        size: 1.6 + cosmetic() * 2.6,
      });
    }
  }

  function drawEmber(ember, t) {
    const flicker = 1 + Math.sin(t * 3.1 + ember.phase) * 0.16;
    const glow = ctx.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, 16 * flicker);
    glow.addColorStop(0, 'rgba(255,230,176,0.95)');
    glow.addColorStop(0.35, 'rgba(255,179,71,0.55)');
    glow.addColorStop(1, 'rgba(255,120,71,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, 16 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.emberPale;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMoth(enemy, t, big, binds = 0) {
    const flap = Math.sin(t * 9 + enemy.phase) * 0.55;
    const s = big ? 2.6 : 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2);
    ctx.fillStyle = big ? 'rgba(232,227,245,0.9)' : 'rgba(184,166,217,0.85)';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + flap * 0.4));
      ctx.beginPath();
      ctx.ellipse(side * 10 * s, -4 * s, 13 * s, 6.5 * s, side * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = big ? '#4a3f66' : '#5d4d85';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = big ? '#e5484d' : PALETTE.emberPale;
    ctx.beginPath();
    ctx.arc(-2.6 * s, -5 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.arc(2.6 * s, -5 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (big) {
      ctx.strokeStyle = 'rgba(255,179,71,0.85)';
      ctx.lineWidth = 3;
      for (let i = 0; i < binds; i += 1) {
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 12 + i * 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawEnemy(enemy, t) {
    if (enemy.kind === 'moth') {
      drawMoth(enemy, t, false);
    } else if (enemy.kind === 'boss') {
      const halo = ctx.createRadialGradient(enemy.x, enemy.y, 10, enemy.x, enemy.y, 120);
      halo.addColorStop(0, 'rgba(232,227,245,0.20)');
      halo.addColorStop(1, 'rgba(232,227,245,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 120, 0, Math.PI * 2);
      ctx.fill();
      drawMoth(enemy, t, true, currentBossBinds);
      if (enemy.chargePhase === 'aim') {
        ctx.strokeStyle = 'rgba(229,72,77,0.5)';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.aimX, enemy.aimY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (enemy.kind === 'imp') {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = PALETTE.imp;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + enemy.phase;
        const r = i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b0d10';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (enemy.kind === 'wasp') {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(Math.atan2(enemy.vy, enemy.vx));
      if (enemy.mode === 'aim') {
        ctx.strokeStyle = 'rgba(245,217,10,0.45)';
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(enemy.aimX - enemy.x, enemy.aimY - enemy.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = PALETTE.wasp;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#191408';
      ctx.fillRect(-2, -6.5, 4, 13);
      ctx.fillRect(6, -5.5, 3, 11);
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-24, -3);
      ctx.lineTo(-24, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (enemy.kind === 'hulk') {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const pulse = 1 + Math.sin(t * 1.7 + enemy.phase) * 0.03;
      ctx.fillStyle = PALETTE.hulk;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,30,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.6, -enemy.radius * 0.3);
      ctx.lineTo(-enemy.radius * 0.1, enemy.radius * 0.1);
      ctx.lineTo(-enemy.radius * 0.4, enemy.radius * 0.55);
      ctx.moveTo(enemy.radius * 0.55, -enemy.radius * 0.5);
      ctx.lineTo(enemy.radius * 0.15, 0);
      ctx.lineTo(enemy.radius * 0.5, enemy.radius * 0.45);
      ctx.stroke();
      ctx.fillStyle = PALETTE.emberHot;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  let currentBossBinds = 0;

  function drawWyrm(state) {
    const points = state.points;
    const flickerOff = state.invulnTimer > 0 && Math.floor(state.time * 14) % 2 === 0;
    if (flickerOff) return;
    for (let i = points.length - 1; i >= 1; i -= 1) {
      const p = points[i];
      const f = i / points.length;
      const r = WYRM.radius * (1 - f * 0.55);
      ctx.fillStyle = lerpColor(PALETTE.wyrm, PALETTE.wyrmSpine, f);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (i % 4 === 0) {
        ctx.fillStyle = 'rgba(255,217,160,0.75)';
        ctx.beginPath();
        ctx.arc(p.x, p.y - r * 0.34, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const h = points[0];
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(state.heading);
    if (state.dash.active > 0) {
      ctx.shadowColor = PALETTE.ember;
      ctx.shadowBlur = 26;
    }
    ctx.fillStyle = PALETTE.wyrm;
    ctx.beginPath();
    ctx.arc(0, 0, WYRM.radius + 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.wyrmSpine;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-6, side * 9);
      ctx.lineTo(-15, side * 16);
      ctx.lineTo(-11, side * 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fff7e8';
    ctx.beginPath();
    ctx.arc(5, -6, 3.6, 0, Math.PI * 2);
    ctx.arc(5, 6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241108';
    ctx.beginPath();
    ctx.arc(6.6, -6, 1.9, 0, Math.PI * 2);
    ctx.arc(6.6, 6, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function flame(x, y, s, lit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(6, -2, 7, 3, 0, 9);
    ctx.bezierCurveTo(-7, 3, -6, -2, 0, -10);
    if (lit) {
      ctx.fillStyle = PALETTE.ember;
      ctx.shadowColor = PALETTE.emberHot;
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = 'rgba(141,132,160,0.35)';
    }
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, ui) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.bone;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${String(state.score).padStart(6, '0')}`, 22, 36);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`BEST ${String(Math.max(ui.best, state.score)).padStart(6, '0')}`, 22, 56);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText(`NIGHT ${state.nightIndex + 1} OF ${NIGHTS.length}`, W / 2, 34);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.bone;
    if (state.bossNight) {
      const pips = '●'.repeat(state.bossBinds) + '○'.repeat(Math.max(0, ENEMY.boss.bindsNeeded - state.bossBinds));
      ctx.fillText(`BIND THE MOON-EATER  ${pips}`, W / 2, 56);
    } else {
      ctx.fillText(`CRUSHED ${Math.min(state.killsThisNight, state.quota)} / ${state.quota}`, W / 2, 56);
      ctx.fillStyle = 'rgba(255,179,71,0.25)';
      ctx.fillRect(W / 2 - 90, 64, 180, 4);
      ctx.fillStyle = PALETTE.ember;
      ctx.fillRect(W / 2 - 90, 64, 180 * Math.min(1, state.killsThisNight / state.quota), 4);
    }

    const slots = Math.max(WYRM.startScales, state.scales);
    for (let i = 0; i < slots; i += 1) {
      flame(W - 30 - i * 26, 30, 1, i < state.scales);
    }

    if (state.combo.chain >= 2) {
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.emberPale;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(`COMBO ×${state.combo.multiplier}`, 22, H - 44);
      ctx.fillStyle = 'rgba(255,230,176,0.3)';
      ctx.fillRect(22, H - 36, 110, 4);
      ctx.fillStyle = PALETTE.emberPale;
      ctx.fillRect(22, H - 36, 110 * Math.max(0, state.combo.timer / 3.2), 4);
    }
    ctx.textAlign = 'right';
    ctx.font = '600 13px system-ui, sans-serif';
    const dashReady = state.dash.cooldown <= 0;
    ctx.fillStyle = dashReady ? PALETTE.teal : PALETTE.dim;
    ctx.fillText(dashReady ? 'DASH READY (SHIFT)' : 'DASH …', W - 22, H - 44);
    if (state.nightIndex === 0 && ui.screen === 'play') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(242,234,216,0.66)';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText('Steer with the mouse or A / D — coil all the way around a moth to crush it — eat embers to grow', W / 2, H - 16);
    }
  }

  function veil(alpha, color = '13,11,18') {
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(state, ui) {
    veil(0.55);
    ctx.textAlign = 'center';
    const glowPulse = 0.75 + Math.sin(state.time * 1.6) * 0.25;
    ctx.save();
    ctx.shadowColor = `rgba(255,140,60,${glowPulse})`;
    ctx.shadowBlur = 44;
    ctx.fillStyle = PALETTE.emberPale;
    ctx.font = '700 96px Georgia, "Times New Roman", serif';
    ctx.fillText('EMBERWYRM', W / 2, 218);
    ctx.restore();
    ctx.fillStyle = PALETTE.bone;
    ctx.font = 'italic 21px Georgia, serif';
    ctx.fillText('The dark ate the dawn. Coil around it. Crush it. Gather the embers. Bring the dawn back.', W / 2, 262);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('A coil-and-crush survival game in seven nights. Your body is the weapon — and the price.', W / 2, 296);
    ctx.fillStyle = PALETTE.bone;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText('STEER  mouse, or A / D and arrow keys        DASH  Shift or Space        PAUSE  P        MUTE  M', W / 2, 356);
    ctx.fillText('Close a full loop around moths, imps and wasps to crush them into embers.', W / 2, 386);
    ctx.fillText('Eat embers to grow longer. Every loop you close spends a piece of that length.', W / 2, 412);
    ctx.fillText('On the seventh night, bind the Moon-Eater three times — or the dark keeps the dawn.', W / 2, 438);
    ctx.save();
    ctx.shadowColor = PALETTE.emberHot;
    ctx.shadowBlur = 18 + Math.sin(state.time * 3) * 6;
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO HUNT', W / 2, 512);
    ctx.restore();
    if (ui.best > 0) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(`Best hunt so far: ${ui.best}`, W / 2, 552);
    }
  }

  function drawUpgrade(state, ui) {
    veil(0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.emberPale;
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText(`NIGHT ${state.nightIndex + 1} CLEARED`, W / 2, 148);
    ctx.fillStyle = PALETTE.bone;
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText('The wyrm sheds in the quiet. Choose the scale it grows back with.', W / 2, 184);
    cardRects = [];
    const cardW = 348;
    const cardH = 216;
    const gap = 28;
    const totalW = cardW * 3 + gap * 2;
    const x0 = (W - totalW) / 2;
    const y0 = 240;
    ui.offered.forEach((upgrade, i) => {
      const x = x0 + i * (cardW + gap);
      cardRects.push({ x, y: y0, w: cardW, h: cardH, index: i });
      ctx.fillStyle = 'rgba(23,19,31,0.96)';
      ctx.strokeStyle = PALETTE.ember;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y0, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.ember;
      ctx.font = '700 25px Georgia, serif';
      ctx.fillText(upgrade.name, x + cardW / 2, y0 + 56);
      ctx.fillStyle = PALETTE.bone;
      ctx.font = '16px system-ui, sans-serif';
      wrapText(ctx, upgrade.text, x + cardW / 2, y0 + 96, cardW - 44, 23);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(`PRESS ${i + 1}`, x + cardW / 2, y0 + cardH - 22);
    });
  }

  function drawEnd(state, ui, victory) {
    if (victory) {
      const grad = ctx.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, 'rgba(255,150,70,0.34)');
      grad.addColorStop(1, 'rgba(13,11,18,0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      veil(0.66, '26,8,10');
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = victory ? PALETTE.emberPale : '#ff9a8a';
    ctx.font = '700 58px Georgia, serif';
    ctx.fillText(victory ? 'DAWN BREAKS' : 'THE ASH TAKES YOU', W / 2, 190);
    ctx.fillStyle = PALETTE.bone;
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText(
      victory
        ? 'The Moon-Eater is bound in coils of ember. Above the ash, the first morning in an age.'
        : 'The coil goes dark, scale by scale. The embers remember the way home.',
      W / 2,
      232,
    );
    ctx.font = '600 19px system-ui, sans-serif';
    const rows = [
      `SCORE  ${state.score}${ui.isBest ? '   — NEW BEST' : `   (best ${ui.best})`}`,
      `NIGHTS SURVIVED  ${victory ? NIGHTS.length : state.nightIndex} OF ${NIGHTS.length}`,
      `CRUSHED AND FELLED  ${state.kills}`,
      `EMBERS EATEN  ${state.embersEaten}`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, W / 2, 300 + i * 34));
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 23px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO HUNT AGAIN', W / 2, 486);
  }

  function draw(state, ui, dt) {
    currentBossBinds = state.bossBinds;
    for (const burst of state.bursts) spawnParticles(burst);
    state.bursts.length = 0;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) particles.splice(i, 1);
    }
    shakeAge += dt;
    ctx.save();
    if (shakeMag > 0 && shakeAge < 0.45) {
      const m = shakeMag * (1 - shakeAge / 0.45);
      ctx.translate(Math.sin(state.time * 91) * m, Math.cos(state.time * 83) * m);
    }
    ctx.drawImage(backdrop, 0, 0);
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    for (const ember of state.embers) drawEmber(ember, state.time);
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    drawWyrm(state);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (ui.screen !== 'title' && ui.screen !== 'over' && ui.screen !== 'victory') {
      ctx.textAlign = 'center';
      for (const text of state.texts) {
        ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
        ctx.fillStyle = text.color;
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.fillText(text.text, text.x, text.y);
      }
      ctx.globalAlpha = 1;
    }
    if (ui.screen !== 'title') drawHud(state, ui);
    if (ui.screen === 'title') drawTitle(state, ui);
    if (ui.screen === 'upgrade') drawUpgrade(state, ui);
    if (ui.screen === 'pause') {
      veil(0.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.bone;
      ctx.font = '700 44px Georgia, serif';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText('P to resume — the ash waits', W / 2, H / 2 + 36);
    }
    if (ui.screen === 'over') drawEnd(state, ui, false);
    if (ui.screen === 'victory') drawEnd(state, ui, true);
    ctx.restore();
  }

  return {
    draw,
    shake(magnitude) {
      shakeMag = magnitude;
      shakeAge = 0;
    },
  };
}
