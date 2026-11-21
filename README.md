# PÁDY — Slovak cases, at speed

A small, loud, personal web app for learning Slovak noun declension and verb–case government.
*Pád* means a grammatical case — and also a fall.

**▶ Play it: [tkhawkey.github.io/pady](https://tkhawkey.github.io/pady/)**

Or open `app/index.html` locally. No build step, no server, works offline (fonts load when online).

## What's inside

The home screen has a **Pády | Slovesá** switch: cases (nouns, adjectives) or verbs (conjugation).
On the verb side, Rozbi to!, Tabuľka and Pád! work with persons (*ja, ty, on…*) × tenses
(present / past, or future for perfective verbs), and Hľadaj looks up any verb form (*bojím → báť sa*).
The verb side has its own Začni tu, path (9 units), daily dose, mastery map and Ťahák (groups -ám / -ím /
-em / -ujem, tenses, aspect), plus Páry (aspect pairs) and Vyfarbi vetu ("who is doing it?").

| Mode | What you do |
|---|---|
| **Začni tu** (start here) | A 3-minute adaptive level check. It places you on your path and seeds the review engine with what you already know. |
| **Tvoja cesta** (your path) | 12 units, from *Kto? Čo?* to the genitive plural and verbs. Each: learn → practise → write → test (80% to pass). Plus a mastery map of all 144 pattern × case × number cells. |
| **Dnešná dávka** (today's dose) | 5 minutes, chosen for you: spaced repetition of what's due, new items from your unit, your own words, and one real sentence to colour. |
| **Vyfarbi vetu** (colour the sentence) | Real treebank sentences: give every noun and adjective its case colour; prepositions are the clues. |
| **Hľadaj** (look up) | Type any form you see (*čerstvých*, *ulici*, *ľuďom*): which word it is, what it means, every case it could be (colour-coded, with what each case is for), and the full table with your form's cells outlined. Link straight to a word: `index.html#hladaj/čerstvých`. |
| **Ťahák** (crib sheet) | Learn: the 12 model words with endings highlighted, a "which pattern is my word?" finder, one case across all patterns, case cards with prepositions and real verbs, your weak spots. |
| **Rozbi to!** | A word shatters into its forms — drag each back to its case. |
| **Tabuľka** | The classic grid: type all the forms. Accent slips get half points. |
| **Magnet** | Which case does the verb take? Level 2: fill a real sentence with the right form. |
| **Pád!** | Arcade: forms fall, tap the right case lane before they land. |
| **Zámená a čísla** | Pronouns in real treebank sentences (*mne / mi / mňa*, *jeho / ho / neho*, *ňom*, *nimi*): pick the right form; the short and long form of one case are never set against each other. Numbers + nouns: *jedna žena, dve ženy, päť žien, dvaja muži / piati muži*. Both have a Ťahák page; Hľadaj looks up pronoun forms. |
| **Pasca** (trap) | The spots where even Slovaks slip, in real treebank sentences: *s* or *z* (+ instrumental / + genitive)? *v* or *vo*? *dobrí* or *dobré*? One underlined word is the clue; weak categories come up more. |

Every Slovak label shows English on hover. On a phone: tap a label, or press and hold a button. Answers are never translated.
Wrong answers are explained ("*-y* is the *žena* ending; *ulica* follows *ulica*: *ulice*").
Words you look up in Hľadaj can be added to **Moje slová** and come back in the daily dose.
🔊 buttons use the browser's Slovak voice when one is installed.
Progress (XP, streak, records, spaced-repetition boxes) is stored in the browser's localStorage.

**Install it on a phone:** open the GitHub Pages link, then "Add to Home Screen" / "Install app". After the
first visit it works offline. (When you upload a new version, bump `CACHE` in `app/sw.js` so phones pick it up.)

## Data

All word forms come from existing sources, not from an AI:

- **Noun and adjective declensions:** English Wiktionary, via the [kaikki.org](https://kaikki.org) extract
  and the Wiktionary REST API for full noun tables.
- **Word selection:** [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018, Slovak),
  re-ranked so a word only gets credit for frequency that is really its own (`scripts/check_homographs.ps1`),
  then blended with lemma + part-of-speech ranks from the Araneum Slovacum VII corpus (Ľ. Štúr Institute of
  Linguistics, `scripts/build_araneum.ps1`): a word's order is the geometric mean of its spoken (subtitles) and
  written (web corpus) rank.
- **Example sentences with English** ("V praxi" in Hľadaj, and after answers in the daily dose):
  [Tatoeba](https://tatoeba.org) Slovak–English pairs, 2–9 words, filtered for adult content
  (`scripts/build_tatoeba.ps1`). A form only counts as a hit when exactly one of our words has it. 1,660 words have sentences.
- **Verb–case government, example sentences, adjective + noun pairs:** the hand-annotated
  [Slovak UD treebank (SNK)](https://github.com/UniversalDependencies/UD_Slovak-SNK).
- **Validation:** every noun form is checked against real usage in the treebank (`data/validation_report.txt`),
  and every game noun table cell by cell against the Ľ. Štúr Institute morphology groups (`scripts/check_stur.ps1`,
  `data/stur_check.txt`): 6,483 of 6,518 cells agree. Where both forms are in real use (*garážam / garážiam*,
  *dažďmi / dažďami*, *študentmi / študentami*) both are accepted (`data/stur_alts.json`); where Wiktionary was
  wrong (*hosť*, *upír*, *psy*) the table is fixed by hand in `scripts/noun_overrides.json`.
- **Hľadaj nouns:** 3,861 of 4,406 ship with a table that two sources agree on (Wiktionary + Štúr,
  `data/lookup_check.txt`), so they work offline. The rest are fetched live from Wiktionary and marked "not double-checked".
- English glosses for ~200 verbs that have no Wiktionary entry, the pattern tips and the preposition lists
  were written by hand (marked `glossSource: manual` in `data/verbs.json`).

### Rebuilding the data (PowerShell 7)

The scripts download their sources into `raw/` (≈60 MB, not committed):

```powershell
# one-time downloads
Invoke-WebRequest https://kaikki.org/dictionary/Slovak/kaikki.org-dictionary-Slovak.jsonl -OutFile raw/sk.jsonl
Invoke-WebRequest https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/sk/sk_50k.txt -OutFile raw/sk_50k.txt
# UD Slovak SNK: sk_snk-ud-{train,dev,test}.conllu -> raw/ud/{train,dev,test}.conllu

./scripts/extract.ps1          # candidates from Wiktionary
./scripts/fetch_nouns.ps1      # full noun tables (rate-limited, cached in work/)
./scripts/fetch_models.ps1     # the 12 model words
./scripts/ud_frames.ps1        # verb frames from the treebank
./scripts/build_verbs.ps1
./scripts/adj_pairs.ps1        # real adjective + noun pairs
./scripts/build_data.ps1       # validate nouns + adjectives
./scripts/check_homographs.ps1 # frequency ownership / re-ranking
./scripts/build_sentences.ps1  # real sentences for Vyfarbi vetu
./scripts/build_conj.ps1       # verb conjugations, decoded from the dump + checked against the treebank
./scripts/build_vsentences.ps1 # real sentences for Vyfarbi vetu on the verb side
./scripts/build_araneum.ps1    # needs araneum_top60k.tsv (local, not committed) -> data/freq_araneum.json
./scripts/build_tatoeba.ps1    # needs the Tatoeba Slovak-English pairs TSV (local) -> work/tatoeba_ex.json
./scripts/check_stur.ps1       # needs groups-nouns.yaml (local) -> data/stur_check.txt, data/stur_alts.json
./scripts/build_traps.ps1      # Pasca items from the treebank -> work/traps.json
./scripts/build_pronouns.ps1   # pronoun sentences from the treebank -> work/pron_sents.json
./scripts/build_lookup_tables.ps1  # checked tables for Hľadaj nouns (Wiktionary x Štúr) -> work/lookup_tables.json
                                   # (run build_lookup.ps1 once before and once after it)
./scripts/build_bundle.ps1     # -> app/data.js
./scripts/build_lookup.ps1     # -> app/lookup-data.js (~1,400 adjectives, ~4,400 nouns for Hľadaj)
```

Hľadaj loads `app/lookup-data.js` only when opened. Nouns outside the game data get their full
case table live from the Wiktionary REST API (needs a connection; known forms are shown offline).

`scripts/serve.ps1` runs a tiny local web server if you want one (`http://localhost:8765`).

## Credits and licences

- Wiktionary content: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- UD Slovak SNK: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- FrequencyWords: see that repository's licence.
- Tatoeba sentences: [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/); each sentence links back to
  its page on tatoeba.org (the "Tatoeba" link under it), which names its author.
- Morphology groups: Ľ. Štúr Institute of Linguistics, Slovak Academy of Sciences (used only to check our tables
  and to accept extra variants).
- Araneum Slovacum VII frequency list: Ľ. Štúr Institute of Linguistics, Slovak Academy of Sciences. Only the
  rank of each word we use is stored (`data/freq_araneum.json`).

The derived data in `data/` and `app/data.js` is shared under the same CC BY-SA 4.0 terms.
