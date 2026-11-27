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
7. ✅ **Learning engine** (`app/engine.js`, `app/trainer.js`): Leitner spaced repetition on every
   pattern × case × number cell (fed by every game), 12-unit path (learn → practise → write → test),
   mastery map, adaptive placement test ("Začni tu"), daily dose, mistake explanations (also in
   Tabuľka and Rozbi to!), Moje slová from Hľadaj, Vyfarbi vetu (700 treebank sentences), 🔊 speech,
   installable/offline PWA (`manifest.webmanifest`, `sw.js`, `icons/`).

8. ✅ **Slovesá (verbs), phase 1**: Pády | Slovesá switch; 400 verbs (present/future, past by gender,
   imperative, aspect partners) decoded from the kaikki dump — no web fetch; 7,943 treebank forms match,
   one usage override (vziať → vzal). Rozbi to!, Tabuľka (hints by person/tense rules; "ja robím" accepted)
   and Pád! (person lanes) on the verb side; Hľadaj looks up any of 798 verbs' forms.
9. ✅ **Slovesá, phase 2**: verbs grouped by the ja ending (-ám 98, -ím 120, -em 87, -ujem 54, irregular 40);
   9 verb units (present per group, irregulars, past, future, aspect, imperative) with spaced repetition on
   group × tense × person; verb placement test; the daily dose follows the side you're on and mixes in due
   items from the other side; verb mastery map (one grid per tense + aspect pairs); verb Ťahák (Skupiny with
   endings highlighted + tips + group drills, Ktorá skupina? finder, Časy incl. conditional, Vid + pairs);
   Páry game (44 aspect pairs, kept only if mutual or prefix-formed); Vyfarbi vetu for verbs (600 treebank
   sentences: who is doing it?).

10. ✅ **Your downloads, round 1**: Tatoeba Slovak–English pairs → up to 3 short real sentences with English for
   1,660 words ("V praxi" in Hľadaj; after an answer in the daily dose when the sentence has that exact form,
   coloured by case when the form can only be one case). Araneum lemma + POS ranks blended with the subtitle
   ranks to order nouns, adjectives and verbs.
11. ✅ **Second opinion on the tables**: every game noun checked cell by cell against the Ľ. Štúr Institute groups
   (99.5% agree). Fixed hosť (back in the game), upír, pes (psy); variants in real use accepted both ways.
12. ✅ **Pasca** (traps): picked from the top of the chiby native-error lists, built from treebank sentences.
   s/so + Ins vs z/zo + Gen (160); v/vo, z/zo, s/so, k/ku (160: long forms only where the core rule applies, short
   forms only before a vowel or consonant + vowel, so optional cases like *vo sne* never appear); male-person
   plural -í vs everything else -é incl. ktorí/ktoré, tí/tie, dvaja/dve (158, only where a clue noun is in the
   sentence). Mixed or one category; per-category stats weight the mix.
13. ✅ **Zámená a čísla**: pronoun forms in 399 treebank sentences (needs a clue: a preposition, or the verb/adjective
   it hangs on; same-case short/long never set against each other; n-forms after prepositions as the trap);
   numbers 1–10 + noun (agreement, 2–4 + nom. pl., 5+ + gen. pl., male persons dvaja/piati); Ťahák tab; pronouns in Hľadaj.
14. ✅ **Hľadaj tables checked**: 3,861 / 4,406 nouns ship with a table confirmed by Wiktionary + Štúr (offline);
   the remaining ~550 load live and say "not double-checked".
15. ✅ **Úlovok, MVP** (sentence mining from official subtitles; `app/ulovok.js`, `scripts/build_pack.ps1`):
   one importable pack per episode, kept only on the device (IndexedDB), never uploaded. Daily catch of
   sentences one new word away; tap any word (meaning, case + the preposition behind it, person/tense,
   frequency); "Neznám slovo" / "Neznám tvar" / "Poznám"; caught sentences return as read → fill-in (forms of
   the same word, from Hunspell) → colour the cases → translate → listen. Slovník: learning, to drill,
   what to catch next, recognise-only (rare), colloquial. Cases you trip on are counted per case.
   Test pack: Ted Lasso S03E01 (535 sentences).
   Next for Úlovok: Úlovok cards in the daily dose; a 40-word vocabulary check instead of the level guess;
   "Pred pozeraním" only if Slovak-dubbed shows with matching subtitles turn up.

16. ✅ **English for treebank sentences**: all 2,623 sentences the games show (Vyfarbi vetu for cases and verbs,
   Magnet + Tvar, Pasca, Zámená, Ťahák case cards) translated by Claude into `app/tr-data.js`, marked AI. Shown only
   after you answer (before, it would give away the person or the case); in the Ťahák cards, straight away.

17. ✅ **Kto komu?** (`app/pron.js`): pronoun × case with an English cue. 36 hand-written frames (noun subject, so no
   reflexive clash) × 7 pronouns; long + short both right without a preposition, n-form after one, ku/so/odo before mne.
   Three exercises (pick, read: who + case, type), stats per person × case (± preposition), weak-first, a tap-to-drill
   grid on home and in Ťahák, weak cells in the daily dose.

18. ✅ **Slovesné vzory** (`app/vzory.js`): the 14 school model verbs. All 798 Hľadaj verbs sorted by rule
   (infinitive ending + on / oni forms; 29 irregular: byť, ísť, jesť, vedieť, povedať, chcieť, môcť, vziať + prefixed).
   Hľadaj verb card: "vzor niesť" box (model vs. this verb: ja / oni / past, the rule, verbs like it). Ťahák (verb side)
   → Vzory tab: models grouped by present type, full table, rule, every verb that follows it.

## Next (needs your extra content / data)
- Tatoeba for Vyfarbi vetu (needs every noun in a sentence to be unambiguous) and for Magnet frames.
- Numbers in other cases (s dvoma ženami, o piatich mužoch), possessives (môj, tvoj, svoj).
- Verb conjugation in Hľadaj.

## Known gaps
- Possessives from first names (*Karlova izba*) aren't in Wiktionary; would need a small rule-based
  generator for ~20 names (Karol → Karlov, Jana → Janin). Easy follow-up.
- Verb glosses: 201 of ~300 are written by Claude (marked `glossSource: manual`); the cases themselves
  all come from the corpus.
