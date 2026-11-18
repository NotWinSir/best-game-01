// Emberwyrm's handover to the make.fun grader. The game is the game/ folder beside this
// file — plain static files a desktop browser runs offline, no build and no network — and
// this program delivers it: it copies game/ and screenshots/ into the output directory and
// writes the dossier the judge reads, using the kit's vendored library with the scorer's own
// caps. Run it twice and the output is byte-identical: the dossier is assembled only from
// what is on disk.
//
// Locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (In the grader, the output directory is /output and the env var is unset.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: at most 4 screenshots of at most 256 KiB each, at most 993 game files
// totalling 48 MiB with no path over 1000 bytes, and the dossier's text capped at 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
