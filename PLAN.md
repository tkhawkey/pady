# PÁDY — Slovak cases, at speed

*Pád* = grammatical case, and also *a fall / a crash*. The app leans into both.

## Vision
A loud, bouncy little arcade for drilling Slovak noun morphology and verb–case government.
Short rounds (60–90 s), instant feedback, combos, streaks. Nothing that looks like a textbook.

**One rule ties it together: every case has a colour, everywhere.**

| Case | Colour | Question |
|---|---|---|
| Nominatív | sunny yellow | kto? čo? |
| Genitív | tangerine | koho? čoho? |
| Datív | hot pink | komu? čomu? |
| Akuzatív | electric blue | koho? čo? |
| Lokál | lime | o kom? o čom? |
| Inštrumentál | grape | s kým? s čím? |

Tiles, lanes, verb answers and progress heatmaps all use these colours, so after a week you see
"pink" when you hear *pomáhať*.

Look: chunky rounded type, thick outlines, springy motion, confetti on combos, short pop sounds (mutable).
Works on phone and desktop; keyboard-first on desktop, thumb-first on phone.

## Game modes

1. **Rozbi to! (Smash it)** — the drag game. A noun card (or adjective + noun, e.g. *veľká izba*)
   bursts into its forms as tiles. Drag each into the 6 × 2 grid. Forms that fill several cells
   (*izby* = G sg, N pl, A pl) can go in any cell they fit; filling all of them gives a "TRIPLE!" bonus.
   This teaches syncretism instead of pretending it doesn't exist.
2. **Tabuľka (The grid)** — the slovake.eu exercise, made snappy. Type the forms; there's an on-screen
   diacritic bar (á ä č ď é í ĺ ľ ň ó ô ŕ š ť ú ý ž). A diacritic-only slip counts as "almost" (half
   points, shown in amber).
3. **Pád! (Case rain)** — arcade. Forms fall down the screen; tap the case lane before they land.
   Speed ramps up. Lives, combos, high score.
4. **Magnet (verbs)** — a verb appears (*báť sa*, *čakať na*, *stretnúť sa s*); snap it to the right
   case (± preposition). Level 2: also put a noun into the right form (*pomáhať + mama → mame*).
   After each answer, a real corpus sentence appears with the case-governed word highlighted.
5. **Vzory (Patterns)** — the 12 declension models (chlap, hrdina, dub, stroj, žena, ulica, dlaň,
   kosť, mesto, srdce, vysvedčenie, dievča). Pick one to drill only nouns of that pattern.

## Progress / game layer
- XP, daily streak, combo multiplier, personal bests per mode.
- **Mastery heatmap**: one 6 × 2 grid per pattern, each cell coloured by accuracy. Shows exactly where
  you're weak (e.g. "G pl of žena-type is red").
- Light spaced repetition: weak cells (pattern × case × number) come up more often.
- Everything stored locally in the browser. No accounts.

## Data (done — see /data)
- `nouns.json` — 249 high-frequency nouns across 13 declension patterns, full 12-cell tables + gender/animacy + pattern (Wiktionary).
- `adjectives.json` — 150 adjectives incl. possessives (*otcov*, *matkin*), all agreement slots.
- `verbs.json` — ~300 verbs with corpus-attested case frames (UD Slovak SNK treebank), `core` flag,
  real example sentences, English glosses.
- Validation: 5,906 noun uses in the hand-annotated treebank checked against our tables. The only
  differences are non-standard spellings in the corpus (*oblastich*, *sekúd*, colloquial *psi*) and one
  accepted variant we don't list (*listami* beside *listmi*).
- Adj + noun phrases are composed at runtime from gender/animacy rules (m-pers / m-anim / m-inan / f / n).
  The adjective is a real pair from the treebank where one exists (`scripts/adj_pairs.ps1`, ~160 nouns,
  e.g. *hlavné mesto, čierna diera*), otherwise an everyday adjective (nový, starý, veľký…).
  Random pairs only in the opt-in "Bláznivé 🤪" mode.
- Rebuild: `scripts/extract.ps1` → `fetch_nouns.ps1` → `build_data.ps1`, `build_verbs.ps1`.

## Tech
- No build step: plain HTML + CSS + vanilla JS modules (no Node on this machine).
- A script bundles the JSON into `data.js` so the app opens straight from disk or as a published page.
- Can publish as a private claude.ai page to use on a phone.

## Running it
Double-click `app/index.html` (works offline; fonts load when online).
After changing anything in `data/`, run `scripts/build_bundle.ps1` to regenerate `app/data.js`.

## Build order
1. ✅ Shell, colour system, data loader, **Rozbi to!** (drag + tap-to-place, combos, multi-cell bonus,
   hints, sounds, confetti, XP/level/streak, records, per-pattern mastery stats saved locally).
2. ✅ **Tabuľka**: type all 11 forms (nom. sg. given); Enter checks; accent-only slip = amber "almost"
   (half points); second miss reveals the answer; on-screen accent bar; English tooltips everywhere
   except answers. (Mastery heatmap still to come.)
2b. ✅ **Ťahák** (learning zone): pattern pages with endings highlighted, real example words, tips,
   your accuracy per cell and Drill buttons; "Ktorý vzor?" finder (search any form, or 3 questions);
   one case across all 12 patterns (Stĺpec); case cards with prepositions and corpus verbs (Pády);
   weak-spot chips. Model-word tables: `scripts/fetch_models.ps1` → `data/models.json`.
3. ✅ **Magnet** (verbs). Level *Pád*: verb (+ preposition) → pick G/D/A/L/I; every corpus-attested case
   counts; weighted by corpus frequency, rare idioms (<4 hits) left out. Level *Tvar*: a real treebank
   sentence with the governed noun blanked; pick the right form (258 sentences, non-accusative favoured).
   Keys 1–5 + Enter. Per-verb stats saved for a future weak-spot view.
4. ✅ **Pád!** arcade: forms fall, tap/press the case lane (1–6 or N G D A L I) for the lowest one;
   any case the form could be counts; 3 lives (+1 per 15 catches, max 5); faster every 8 catches;
   misses show the answer; pauses when the tab is hidden; record per word type + pattern.
5. Polish: sounds, Vzory picker, stats screen.
6. ✅ **Hľadaj** (look up): type any noun/adjective form → word card with lemma, meaning, "this form can be"
   case chips (with use + prepositions), and the colour-coded table with matching cells outlined.
   ~1,400 adjectives + ~4,400 nouns (`scripts/build_lookup.ps1`); extra noun tables fetched live from
   Wiktionary; accent-free typing suggests the right form; recent lookups; deep links `#hladaj/<form>`.
   Not covered yet: verbs, pronouns, numerals (falls back to a Wiktionary link).

## Known gaps
- Possessives from first names (*Karlova izba*) aren't in Wiktionary; would need a small rule-based
  generator for ~20 names (Karol → Karlov, Jana → Janin). Easy follow-up.
- Verb glosses: 201 of ~300 are written by Claude (marked `glossSource: manual`); the cases themselves
  all come from the corpus.
