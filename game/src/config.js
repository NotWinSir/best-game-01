// Emberwyrm tuning: every number that shapes how the game feels lives here, so the simulation
// (world.js), the renderer (render.js) and the screenshot scenes (shots.js) all read one truth.
// The field is a fixed 1280x720 stage; the renderer scales it to the window, so a position means
// the same thing on every screen and in every screenshot.

export const FIELD = { width: 1280, height: 720 };

/** The simulation advances in fixed steps of this many seconds; rendering only draws. */
export const STEP = 1 / 120;

export const WYRM = {
  startSegments: 38, // body points the wyrm hatches with
  minSegments: 14, // a loop may never spend the wyrm below this
  segmentSpacing: 8, // stage units between neighbouring body points
  radius: 13, // head and body thickness, for drawing and for touching
  baseSpeed: 225, // stage units a second before upgrades
  turnRate: 4.4, // radians a second the head may swing toward its steer target
  dashSpeed: 430, // speed while dashing
  dashSeconds: 0.42, // one dash lasts this long
  dashCooldown: 2.4, // seconds before the next dash, before upgrades
  neckGrace: 13, // body points behind the head that can never close a loop or bite
  hitInvulnerableSeconds: 2.2, // mercy window after losing a scale
  startScales: 3, // lives
};

export const EMBER = {
  radius: 7,
  magnetRadius: 74, // embers inside this ring drift to the head (before upgrades)
  magnetSpeed: 340,
  growthPerEmber: 1, // body points one ember buys
  score: 5,
};

export const LOOP = {
  minPoints: 22, // a closing loop must span at least this many body points to count
  costShare: 0.5, // share of the loop's points the wyrm spends when it crushes
  closeRadius: 32, // the head this close to an older body point closes the loop
  rearmDistance: 46, // the head must travel this far from a crossing before the next can close
};

export const COMBO = {
  windowSeconds: 3.2, // kills this close together keep the chain alive
  maxMultiplier: 8,
};

export const ENEMY = {
  moth: { radius: 15, speed: 62, score: 10, fleeRadius: 135 },
  imp: { radius: 13, speed: 118, score: 20, biteCooldown: 1.1 },
  wasp: { radius: 11, speed: 265, score: 25, burstSeconds: 0.9, restSeconds: 1.4 },
  hulk: { radius: 34, speed: 30, score: 120 },
  boss: { radius: 56, speed: 46, score: 1500, bindsNeeded: 3 },
};

/** What each night asks of the player and what it sends at them. Night 7 is the Moon-Eater. */
export const NIGHTS = [
  { quota: 6, spawnEvery: 2.6, kinds: ['moth'] },
  { quota: 9, spawnEvery: 2.3, kinds: ['moth', 'moth', 'imp'] },
  { quota: 12, spawnEvery: 2.0, kinds: ['moth', 'imp', 'wasp'] },
  { quota: 14, spawnEvery: 1.8, kinds: ['moth', 'imp', 'wasp', 'hulk'] },
  { quota: 17, spawnEvery: 1.6, kinds: ['imp', 'wasp', 'moth', 'hulk'] },
  { quota: 20, spawnEvery: 1.4, kinds: ['wasp', 'imp', 'hulk', 'moth'] },
  { quota: 0, spawnEvery: 3.1, kinds: ['moth', 'imp', 'wasp'], boss: true },
];

export const PALETTE = {
  ash: '#0d0b12', // the deep
  ashSoft: '#17131f',
  wall: '#2b2138',
  ember: '#ffb347',
  emberHot: '#ff7847',
  emberPale: '#ffe6b0',
  wyrm: '#ff9a3c',
  wyrmBelly: '#ffd9a0',
  wyrmSpine: '#c2512f',
  moth: '#b8a6d9',
  imp: '#e5484d',
  wasp: '#f5d90a',
  hulk: '#7d6ba8',
  boss: '#e8e3f5',
  bone: '#f2ead8',
  dim: '#8d84a0',
  teal: '#57d9c5',
};
