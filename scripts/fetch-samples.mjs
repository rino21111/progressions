// Download the sampled guitar notes the synth plays back (run once; the files are kept in the repo).
// Source: FluidR3_GM rendered to MP3 by gleitz/midi-js-soundfonts. See "Credits" in README.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM';
const TONES = {
  steel: 'acoustic_guitar_steel',
  nylon: 'acoustic_guitar_nylon',
  electric: 'electric_guitar_clean',
};
// Every third semitone from low E (MIDI 40) to Bb5 (82); playback pitch-shifts the rest.
const NOTES = Array.from({ length: 15 }, (_, i) => 40 + i * 3);
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
}

let total = 0;
for (const [tone, instrument] of Object.entries(TONES)) {
  const dir = join('src', 'samples', tone);
  mkdirSync(dir, { recursive: true });
  for (const midi of NOTES) {
    const data = await download(`${BASE}/${instrument}-mp3/${noteName(midi)}.mp3`);
    writeFileSync(join(dir, `${midi}.mp3`), data);
    total += data.length;
  }
  console.log(`${tone}: ${NOTES.length} notes`);
}
console.log(`Done: ${(total / 1024).toFixed(0)} KB`);
