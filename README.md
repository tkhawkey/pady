# PÁDY — Slovak cases, at speed

A small, loud, personal web app for learning Slovak noun declension and verb–case government.
*Pád* means a grammatical case — and also a fall.

**▶ Play it: [tkhawkey.github.io/pady](https://tkhawkey.github.io/pady/)**

Or open `app/index.html` locally. No build step, no server, works offline (fonts load when online).

## What's inside

| Mode | What you do |
|---|---|
| **Hľadaj** (look up) | Type any form you see (*čerstvých*, *ulici*, *ľuďom*): which word it is, what it means, every case it could be (colour-coded, with what each case is for), and the full table with your form's cells outlined. Link straight to a word: `index.html#hladaj/čerstvých`. |
| **Ťahák** (crib sheet) | Learn: the 12 model words with endings highlighted, a "which pattern is my word?" finder, one case across all patterns, case cards with prepositions and real verbs, your weak spots. |
| **Rozbi to!** | A word shatters into its forms — drag each back to its case. |
| **Tabuľka** | The classic grid: type all the forms. Accent slips get half points. |
| **Magnet** | Which case does the verb take? Level 2: fill a real sentence with the right form. |
| **Pád!** | Arcade: forms fall, tap the right case lane before they land. |

Every Slovak label shows English on hover (or long-press on a phone). Answers are never translated.
Progress (XP, streak, records, per-cell accuracy) is stored in the browser's localStorage.

## Data

All word forms come from existing sources, not from an AI:

- **Noun and adjective declensions:** English Wiktionary, via the [kaikki.org](https://kaikki.org) extract
  and the Wiktionary REST API for full noun tables.
- **Word selection:** [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018, Slovak),
  re-ranked so a word only gets credit for frequency that is really its own (`scripts/check_homographs.ps1`).
- **Verb–case government, example sentences, adjective + noun pairs:** the hand-annotated
  [Slovak UD treebank (SNK)](https://github.com/UniversalDependencies/UD_Slovak-SNK).
- **Validation:** every noun form is checked against real usage in the treebank (`data/validation_report.txt`).
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

The derived data in `data/` and `app/data.js` is shared under the same CC BY-SA 4.0 terms.
