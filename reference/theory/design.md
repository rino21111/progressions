# Relationships engine: design

The engine names no songs or artists. A library of 71 classic progressions and cadence modules, labelled by genre and mood, drives three outputs: After ideas (one next chord, each with an optional then line), Continuations (1 to 4 chords) and Starts (for an empty progression). Every number below is in engine.js; this file is the spec for the TypeScript port.

## Library (library.json)

- Fields: id, name, genre, mood, mode, numerals, kind (loop, cadence, turnaround, vamp), uses, optional repeat (bars per chord), optional core, note (at most 10 words). Loops, turnarounds and vamps wrap; cadences do not.
- uses: start puts the entry in Starts; continue lets then lines and continuations draw on it; end lets it close a phrase, and only when the phrase lands on the tonic.
- core (index range) must be visible, in its own order, before the name may be shown (Monte, Fonte, Andalusian, La Folia, I–V–vi–iii–IV, Ragtime). Without core, a cadence, vamp or loop of up to 4 chords must be shown whole, and a loop of 5 or more needs any 4 of its chords.
- Contents: 45 major and 26 minor entries; 31 loops, 25 cadences, 9 vamps, 6 turnarounds. Minor numerals use natural-minor degrees, so V, vii°7 and the Picardy I are written out.
- Numerals are realized in the user's key and spelled by degree. A double accidental is respelled (Bbb7 shows as A7) but keeps its numeral (bVII7). Held notes in the why use the key's letters plus the minor leading tone.
- Other-mode entries are realized on the relative key and admitted only when every chord is diatonic here or, in a major key, is the relative minor's harmonic V or vii° (Am G F E in C). They give n-gram support only, at weight 0.35 and only for 1- and 2-chord contexts, and are never named, cited, or used for then lines or continuations. One that is a rotation of a same-mode loop is dropped.

## Tokens, style and dressing

- Token = root (semitones above the tonic) + family (M, m, d, a); C, Cmaj7 and Cadd9 share one. A non-diatonic dominant 7th whose 7th changes its job is marked: I7 and bII7 in both modes, IV7 and bVII7 in major, III7 and VI7 in minor. Blues style keeps only bII7's mark. Secondary dominants share their triad's token (A and A7 are both V of ii).
- Repeated tokens collapse, in the user's context and in entries; a loop's last chord merges into its first.
- Style: sevenths when at least half the chords are 7th chords and not all are dominant 7ths. Blues (major only) when I7 and IV7 are both present, or one of them plus dominant 7ths on I, IV, V that number at least 2 and make up at least half the chords. Kind is blues, jazz (sevenths) or triad.
- Dressing a library chord to the player: blues turns I, IV, V into dominant 7ths and bVI into bVI7. Diatonic chords take the key's 7ths in 7th style (minor V7, vii°7) and triads in triad style, keeping m7b5. Borrowed triads take their 7ths in 7th style; borrowed maj7 or m7 become triads in triad style. Every other chromatic chord stays as written, because it defines its entry (a triad player still sees D7 G7 C in the Double dominant).

## Roles, lanes, expectations

- Roles: tonic7 (major I7); secondary (a major or dominant 7th a fifth above a non-tonic diatonic major or minor chord; also major I+ to IV and minor I7 to iv); picardy (minor-key I); dorian4 (minor-key IV); diatonic (minor includes harmonic V and vii°); tritone (bII7); neapolitan (bII triad); borrowed (parallel mode); leading (a diminished chord a semitone below a tonicizable degree); blues (major IV7 to I, minor VI7 to V); other. Pull roles: secondary, leading, tonic7, tritone, neapolitan.
- Lanes take the following chord into account (the first chord when the loop wraps). Major: I, iii, vi T; ii, IV PD; V, vii° D. Minor: i, III T; iv, ii°, VI PD; V, vii° D; v and VII are D only before i or III, else PD.
- Context lanes: tonic7 is T in a blues, else D only before IV. picardy is D only before minor iv. dorian4 is D only before VII, else PD ("From A major"). secondary and leading are D ("Leads to X"), except a secondary triad falling straight to I, which is PD (the Lydian II). tritone D, neapolitan PD, blues role PD. Major borrowed: bVII and v are D before I, else PD (the bVII reason is "Backdoor" only for bVII7); the chord a semitone below the tonic is D; i and bIII are T; the rest PD. Minor borrowed: a semitone below the tonic D, the parallel major's iii T, the rest PD.
- Expectations are (target, strength, family); a move scores only into the right family.
  - Roles: secondary or leading to target 1.4 (major I+ also to vi 0.6); tritone to I 1.4; neapolitan to major V 1.0; tonic7 to IV 1.0 (major also iv 0.7); blues: major I 0.6 and V 0.3, minor V 0.9; dorian4 to i 0.6, VII 0.5; picardy to iv 0.4.
  - Major diatonic: ii: V 0.8, vii° 0.3. iii: vi 0.4, IV 0.3. IV: V 0.5, I 0.4, ii 0.2. V: I 1.4. vi: ii 0.4, IV 0.4. vii°: I 1.2.
  - Major borrowed: i: IV 0.3, V 0.3. ii: V 0.8. bIII: IV 0.6, bVI 0.4. iv: I 0.9, V 0.5, bVII 0.5. v: I 0.5. bVI: bVII 0.8, V 0.6, iv 0.3. bVII: I 1.0, IV 0.5, bVI 0.4. vii: I 1.2.
  - Minor diatonic: ii°: V 0.8. III: VI 0.3, iv 0.3, VII 0.2. iv: V 0.7, v 0.4, i 0.4, VII 0.3, bII 0.3. V: i 1.4. v: i 0.5, VI 0.3. VI: VII 0.5, V 0.5, iv 0.3, bII 0.3. VII: i 0.7, III 0.6, VI 0.4. vii°: i 1.2. Minor borrowed: II: V 0.8; iii: vi 0.4; vi: ii 0.4.
- a leads into b when the expectation is at least 0.7, IV or iv goes to I, a diatonic non-diminished root falls a fifth, or the move is deceptive (major V to vi or bVI; minor V to VI).

## After: one next chord

- X is the chord before the insert point (the at option; by default the chord is appended); follow is the chord after it, or the first chord when appending. A lone appended chord is "open" (what follows is undecided).
- Natural pool: the key's chords in the player's style (triads; the 7th set; I7 ii7 IV7 V7 in a blues; minor adds V or V7). Spicy pool: VI7 III7 II7 VII7 I7 iv bVII bVI bIII bII7 #iv°7 #i°7 #v°7 in each style's form; minor V7 IV bII I vii°7 II7 III7 I7 bII7 #iv°7; plus chromatic chords that same-mode library contexts continue with.
- Never X itself; X's root only as I7, a secondary dominant, or IV to iv; when inserting, never the following chord.
- Score = ng + move + vl + close + pen + floor.
  - ng: for k = 1..3 (last k collapsed tokens), each k where entries continue with c adds (W × share + B) × the largest supporting entry weight (1, or 0.35 other-mode); W = 2.0, 2.5, 3.0; B = 0.4, 0.5, 0.8. In a blues, other-mode entries give nothing; entries in blues form support only a blues player.
  - move: lanes as above, except that outside a blues I7 counts as D (it acts as V7 of IV). Lane table T→T 0.25, T→PD 0.8, T→D 0.7, PD→T 0.4, PD→PD 0.3, PD→D 0.9, D→T 0.3, D→PD −0.5 (−1.0 in jazz style), D→D 0.1. Floor at 0.5 when X expects c at 0.7 or more or the move is deceptive; then add the expectation, and 0.7 more if deceptive. A pull chord to its own root in another family with no expectation is capped at −0.3 (A7 to Am). Add root motion by semitones up 0..11: 0, 0.05, 0.1, 0.1, 0.1, 0.25, −0.3, 0.15, 0.1, 0.15, 0.1, 0.05. The same chord scores −1.
  - vl: −0.1 × cost (total semitones under nearest-note pairing, each move −6..+6, +1 per added voice).
  - close: posW × the move from c into follow, clamped to −1..2.5; if c equals follow, +0.4 at a phrase end on the tonic, else −0.6. posW: 1.0 when the new length is a multiple of 8, 0.9 of 4, 0.3 even, 0.15 odd; 0.8 when inserting.
  - pen: −0.6 when c repeats the chord before X, unless c is the tonic reached by a resolution of 0.9 or more, from IV or iv, or from bII7; −0.25 per earlier use of c beyond the first; minor after major V: v −1.0, III −0.5, VII −0.8; I+ to V −0.5.
  - floor: when X expects c at 1.2 or more, + 0.6 × (best candidate ng − c's ng), so the expected resolution is never buried.
- Natural: diminished chords −4 unless a 3-chord context asks for them. Up to 4 rows with distinct tokens; rows 3 and 4 need a total of 0.5, rows 1 and 2 may go down to −0.5 when something speaks for them (library support, X's expectation, deceptive, or move 0.5 or more, and no −0.6 ping-pong penalty). So Natural can hold 0 to 4 rows.
- Spicy keeps chromatic chords whose token is not in Natural (I7 and secondary dominants excepted) and adds:
  - −0.08 × vl cost. Pull chords (and minor VI7): dropped when aimed at X; +0.2; when not open they must fit follow (follow is the target, expected at 1.0 or more; or #iv°7 after I or IV going to I), else they are dropped unless the move into follow is 0.5 or more, a same-mode entry plays c straight into follow, or a then line of 0.6 or more carries it. A fitting dim7 +0.4. After an X outside the key, no fit, support, expectation or shared root: −0.5 and the row is "astray".
  - I7 only before IV (or open). Picardy +0.4 when appended after V or vii°, otherwise only as V of iv. Dorian IV −0.25. Triad style: dim7 −0.4, bII7 dropped. Borrowed with no support, expectation or deceptive role −0.8. A pull X into its target's root in the wrong family −0.5. Blues #iv°7 after IV7 +1.0. +1.0 when same-mode entries continue this exact context with c: 3 chords; 2 when the last two leave the key; 1 when X does.
  - Pick greedily up to 4: one per token and per root plus family (Bb or Bb7); at most 3 pull chords (secondary, leading, I7) and 2 per other role; −0.6 for a second chord aimed at the same target. Stop below 0.3; until 2 rows are picked go down to −0.25, but only for vouched rows (support, X's expectation, deceptive, same root as X, target is follow with move 0.5 or more, or a carried then line with move 0.5 or more), never astray ones.
- A list holds 0 to 4 rows: chord, numeral, lane (against follow), tag, why, then, score.

## Tags (first match wins) and why

1. Completes ii–V–I (ii–V–i): X is a major V or bII7 after a non-major ii, and c is the tonic.
2. Completes ii–V: X is a major chord a fifth above c and expects it (1.0 or more), after a non-major chord a step above c.
3. Andalusian cadence: minor V after i–VII–VI; major III after vi–V–IV.
4. After a major V: the tonic is Authentic cadence; the minor-key major I is Picardy third (when appending only; also after vii°).
5. Plagal cadence: the tonic after a non-diminished IV other than the Dorian IV; Minor plagal after iv in major.
6. Deceptive cadence. 7. Backdoor: the tonic after bVII7 or after iv–bVII; or the bVII idea itself going to I when it is bVII7 or follows iv. 8. Aeolian cadence: i after VI–VII.
9. Leads to X, lane D only: the target of a secondary, leading, tonic7 or picardy chord; the tonic for vii°, and for major #iv°7 before I.
10. The lane reason (From C minor, From A major, Neapolitan, Tritone sub). 11. Half cadence: V at a phrase end when the progression starts on the tonic. 12. Back to start: the first chord again at a phrase end.

The why joins the two strongest reasons: "As in (name)" 3 (a 2- or 3-chord context; same-mode source only, blues sources only for a blues player; ranked by style match +1.5, same quality +1, continue +0.5, −0.05 per chord; never a cadence entry under another cadence tag); "X resolves to c" 2.5 (expectation 1 or more); "Sidesteps the expected I" 2.4; "Points to T" 1.6 (lane D, pull role, no Leads-to tag); "Turns back to F at bar N" 1.5 (close 1 or more, appending, not open); "Leads into F" 1.5 (close 0.9 or more, inserting); "Keeps A and C" 1.2 (2 or more common tones), else "Moves N semitones in all" 1.0 (cost 2 or less); "Common after (numeral)" 0.8 (fewer than 2 reasons so far, same-mode source); else "Tonic to predominant" and the like 0.5.

## Then lines

The then line under idea y is 1 to 3 chords that follow y in a same-mode library phrase picked up from the user's chords, so idea + then is that classic continued from the progression.

- None for a Picardy idea, an idea equal to follow in root and family (unless open), or a pull idea aimed at X.
- Sources: same-mode entries with continue or end and no Picardy chord, through the style gate: blues forms only for blues players; a blues player gets other loops only from Blues, Funk, Rock, Jazz, Swing, Ragtime, Gospel, Soul or Country (cadences from any genre); bII7 entries need 7th style. Tokens are strict (F7 is never a hymn's IV).
- Window: at each entry position j holding y's token, m = how many of the user's collapsed chords, counting back from X, also precede j (limit L−2 for loops, j for cadences). For a loop named by numerals, m that reaches back past the loop's first chord is cut so the window starts there (C7 F7 C7 G7 still gets V–IV–I–V). Take t = 1..3 following chords: a loop may not pass its own start (m + 1 + t ≤ L), a cadence's chords stay inside it (j + t ≤ L−1). If a loop completes its cycle into follow and t < 3, follow is appended. Chords are dressed.
- Accept only if: the first chord is y's target or a dominant on its root (#iv°7 may also go to I; bVII7 must go to I); the last chord is ret (equals follow; shown as the user's own chord), home (the tonic, when appending or leading into follow) or lead (leads into follow); at least one chord is not ret; end-only entries close on the tonic; no diminished ending except a dim7 that leads; the core is covered and a numeral name starts at the entry's first chord; y plus the new chords does not replay a stretch of the user's loop (ii and IV equal, 7ths ignored).
- Score: 1.0 × min(m, 3); ending +1.0 for a ret on the tonic, +0.8 home or other ret, +0.5 lead; −0.15 per new chord; bars n + 1 + new: +0.2 for a multiple of 4, −0.1 odd; style fit (+0.3 same kind; blues player −0.2 for jazz, −0.3 for others; others −0.6 for a blues entry; triad player −0.4 for jazz; else −0.1); +0.3 when the whole entry is on screen; +0.2 when a loop window starts at the entry's first chord; −0.4 when the first chord is X again and the entry is not whole. Identical chord sequences keep the best.
- Assignment in list order: each idea takes its best candidate after −1.0 for a name, −0.3 for a genre and −0.2 for a mood already used in the list; null below 0.6.
- Output: id, name, genre, mood, chords, numerals, lanes and returnsHome; each lane is read against the next chord, the last against follow. returnsHome means the last chip is the chord already coming: the UI draws it as the return column and does not insert it; + inserts the others.

## Continuations

- Same sources, style gate, uses, pull, name (with the window cut), ending, core and replay rules as then lines, with spans of 1 to 4 chords (at least 2 shown, at least 1 new), and the same at option. Only each entry's best alignment counts; m includes X; ii and IV standing in for each other is a half match (0.5). A whole cadence (uses end, 2 to 4 chords) may be tacked on when the move from X into it is 0.9 or more with no cross-relation.
- Score: match 0.9 × min(m, 4) (tacked on: 0.4 × the move); coverage 1.5 × min(1, window / entry length); end: home 1.2, ret 1.0, strong lead (close 1.4 or more) 1.0, other lead 0.6; −0.08 × vl cost into the first chord; novelty +0.6 × share of new chords (bII7 and bVII7 do not count as new), −0.4 per repeated chord; fit on bars n + new: +1.0 multiple of 4, +0.6 when a loop closes its own cycle exactly (C Bb + F), −0.8 odd, else 0; +0.3 for completing a cadence; style fit as above, −0.8 for bVII7 to a non-7th player, up to +0.6 (0.15 per matched chord) for a genre already matching 3 or more chords.
- Groups: Darken (deceptive V–vi or V–bVI after a predominant; borrowed iv, ii, i or v; bVI not going to bVII; minor Neapolitan or bII7) wins ties over Lift (bVII, bIII, bVI–bVII, secondary and leading chords, major bII7; minor Picardy, Dorian IV, VI–VII–i); the rest are Resolve (lands home) or Keep moving.
- Pick: dedupe by entry and by chord sequence; greedy up to 6, at most 2 per group, never a contiguous run of another pick; value = score − 0.4 per same-genre pick − 0.25 per same-mood pick − the largest (0.6 × token overlap + 0.4 for the same first chord); stop below 2.6.
- Why: "Continues your ii–V" (up to 4 numerals), "Picks up from V", "IV in place of ii" or "Cadence after V"; then "returns to F", "lands on C" or "leads back to F". Never "ends on".

## Starts

Entries with uses start, grouped Classical and folk; Blues and rock (with Metal); Jazz and soul (with Gospel); Ballad and pop (Ballad, Cinematic, Pop, Doo-wop); Flamenco. Own-mode entries come first; other-mode entries are realized on the relative key; in a minor key, groups are ordered by their share of minor entries. Each group keeps at most 4: own-mode entries one per genre in order, then other own-mode entries; other-mode entries appear only in a group with no own-mode entry (Flamenco in a major key). Blues and Funk entries get blues lanes (I7 is T).

## Uncertain or simplified

- Root position only: the Monte, Fonte, Neapolitan (N6) and half cadence lose their inversions; slash and sus chords are not parsed.
- Moods, genres, the Lift and Darken split and every weight are judgment calls tuned on hand-picked progressions, not a corpus.
- A secondary triad before I is drawn PD (Lydian II); VII in minor is D only before i or III.
- Lists can be short: Spicy is empty after bII7 or I+, and Natural can be one row after a chromatic chord. The UI must allow fewer than 4.
