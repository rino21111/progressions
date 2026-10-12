# progressions

An interactive site for learning guitar theory by playing with it.

- **Inspector**: type a chord (Dm7) or a fingering (x02210) in the search field, or click frets, and it names the chord, colours every note by its role, shows a tone strip (how the chord sounds and why, then each tone's role and note, with the bass marked; hover a tone to find it on the neck, tap to hear it), or, behind the chevron, the chord's structure as a stack (extensions, 7th, triad, bass, with tones this shape leaves out shown dashed), lists other names for the same notes, and shows other ways to play it. You can also show every chord tone across the neck.
- **Progression** (a sidebar on desktop, a dock at the bottom on phones): the transport (Play, Loop, tempo, style and variant: strum whole/quarters/folk/rock/reggae, arpeggio up/up & down/classic/roll, Travis basic/thumb only/pinch/monotonic/muted bass, bossa basic/two-bar; settings for 4/4 or 3/4, bars per chord, tone and swing), then a chart with a diagram per chord. Click a card to select and hear it, drag it to move it (press and hold on phones), double-click to duplicate it. The dashed add card at the end adds the selected chord. The sounding card lights up as it plays. Under the chart (a tab on top of the dock on phones), Shared notes maps each chord's notes on the rows of the key, with bars for notes held into the next chord and a strip showing each chord's function (tonic, predominant, dominant).
- **Adding and shortcuts**: click any chord to select and hear it; double-click (or double-tap) to add it at the end (from the Inspector, with exactly that shape). The Inspector has its own Play and Loop for the chord on the fretboard. Keys: A adds the selection, Space plays and stops the progression, Delete removes the selected card, Left/Right select the next card, Alt/Option+Left/Right move it, / jumps to the search field, Cmd/Ctrl+Z undoes (Shift redoes). Undo steps back through what you built: adding, removing, moving and duplicating cards, and fretboard edits, not chords you only looked at.
- **Relationships**: the key's chords, each above its function (Dominant, Predominant, Tonic); what could follow the progression's last chord (Suggested, or Spice from outside the key), each drawn as how its notes move from the last chord, how the function changes, and what the move is called (Plagal cadence, From C minor, Leads to Am); and sixteen example progressions as small Shared notes maps, grouped Pop, Blues and rock, Jazz and Minor. Clicking an idea plays the change and shows it faded in the sidebar's Shared notes.

## Quick start

Open `progressions.html` in your browser. It's the whole site in one file, so it works without installing anything.

## Working on the code

You need Node.js 18 or newer.

```sh
npm install
npm run dev      # local dev server with live reload, usually http://localhost:5173
npm test         # theory engine tests
npm run build    # type-check, build to dist/, and regenerate progressions.html
```

## How it's organised

```
src/
  theory/          pure music theory, no browser code
    notes.ts         pitch classes, spelling (Eb vs D#), tuning
    chords.ts        chord formulas and naming a set of notes
    fingering.ts     fingering <-> notes, parsing "x32010"
    caged.ts         which CAGED shape a fingering uses
    voicings.ts      searches the neck for playable shapes of a chord
    keys.ts          scales, diatonic chords, Roman numerals, key guessing
    progressions.ts  next-chord ideas (Suggested, Spice) and their tags
    examples.ts      the sixteen example progressions
    voiceLeading.ts  how each voice moves from one chord to the next
    character.ts     how each chord sounds: a word or two, plus a line on why (in its note names)
    patterns.ts      strum / arpeggio / Travis / bossa patterns and variants for one bar (4/4 or 3/4)
    timing.ts        tempo limits, swing, bars per chord
    search.ts        reads a chord name or a fingering typed into the search field
    structure.ts     a chord's structure as a stack of slots, for the Inspector
    progressionMap.ts  the Shared notes map: rows, held notes, function lanes, the curve
  ui/              the two pages, fretboard and chord diagrams
  audio.ts         plays the recorded guitar notes (reverb, limiter, string cut-offs)
  sampleMap.ts     which recording plays each note, and how far to retune it
  samples/         recorded notes for the Steel, Nylon and Electric tones
  player.ts        schedules bars for the player (play, loop, stop)
  playback.ts      what the two Plays play (the progression; the Inspector's chord)
  key.ts           the key in use (picked, or the best guess)
  interaction.ts   click/double-click and keyboard shortcut rules
  history.ts       undo/redo stacks; undo.ts decides what counts as a step
  yourChords.ts    progression edits: append, duplicate, remove, move; the selected card
tests/             vitest tests for the theory engine, play patterns and sample mapping
```

## Sounds

The guitar is played from real recorded notes (every third semitone, retuned in between) for the Steel, Nylon and Electric tones. They live in `src/samples/` and are built into `progressions.html`, so it works offline. `node scripts/fetch-samples.mjs` downloads them again if needed.

## Credits

Guitar sounds: FluidR3_GM soundfont (acoustic_guitar_steel, acoustic_guitar_nylon,
electric_guitar_clean), rendered to MP3 by gleitz/midi-js-soundfonts.

FluidR3_GM - MIT License. Copyright (c) 2000-2002, 2008 Frank Wen.
midi-js-soundfonts - MIT License. Copyright (c) 2012 Benjamin Gleitzman.

The MIT licence for both:

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

The rendered sample set is credited as CC BY 3.0: "FluidR3_GM samples by Frank Wen,
rendered by Benjamin Gleitzman (midi-js-soundfonts),
https://creativecommons.org/licenses/by/3.0/".

If the site is ever published, add a visible credit line for the samples (for example in the footer).

Ideas for later: other tunings, a left-handed fretboard, scale and mode explorer, ear-training quizzes.
