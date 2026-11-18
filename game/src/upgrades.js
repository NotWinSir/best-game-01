// The Scales: between nights the wyrm sheds and regrows, and the player chooses one of three.
// Each scale is a small, permanent change to the run, and most stack, so a long run bends toward
// the player's choices. upgrades.js owns the pool and what each one does; world.js owns the
// numbers they bend (state.mods), and main.js owns showing the three cards.

export const UPGRADES = [
  {
    id: 'emberheart',
    name: 'Emberheart',
    text: 'Gain a scale (a life), up to five. A warm heart beats in the ash.',
    apply(state) {
      state.scales = Math.min(5, state.scales + 1);
    },
  },
  {
    id: 'longcoil',
    name: 'Longcoil',
    text: 'Grow 10 segments now, and every ember after grows you a little more.',
    apply(state) {
      state.targetSegments += 10;
      state.mods.growthBonus += 0.34;
    },
  },
  {
    id: 'swiftfin',
    name: 'Swiftfin',
    text: 'Swim the ash 8% faster, and turn 12% keener.',
    apply(state) {
      state.mods.speedMul *= 1.08;
      state.mods.turnMul *= 1.12;
    },
  },
  {
    id: 'magnetspine',
    name: 'Magnetspine',
    text: 'Your spine pulls embers in from 60% farther away.',
    apply(state) {
      state.mods.magnetMul *= 1.6;
    },
  },
  {
    id: 'brightlure',
    name: 'Brightlure',
    text: 'Everything you win from the dark scores 30% more.',
    apply(state) {
      state.mods.scoreMul *= 1.3;
    },
  },
  {
    id: 'thickhide',
    name: 'Thickhide',
    text: 'After a hit, you are untouchable for over a second longer.',
    apply(state) {
      state.mods.invulnBonus += 1.2;
    },
  },
  {
    id: 'dashfins',
    name: 'Dashfins',
    text: 'Dash again 35% sooner, and hold each dash a little longer.',
    apply(state) {
      state.mods.dashCooldownMul *= 0.65;
      state.mods.dashTimeMul *= 1.3;
    },
  },
  {
    id: 'frugalcoil',
    name: 'Frugal Coil',
    text: 'A crushing loop spends 35% less of your body.',
    apply(state) {
      state.mods.loopCostMul *= 0.65;
    },
  },
];

/** Three distinct scales, drawn with the run's own random so a night always offers fairly. */
export function offerThree(random) {
  const pool = UPGRADES.slice();
  const offered = [];
  while (offered.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    offered.push(pool.splice(index, 1)[0]);
  }
  return offered;
}
