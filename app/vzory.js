/* PÁDY — the 14 school verb models (slovesné vzory), as taught in Slovak schools.
   The list follows slovake.eu (grammar → verbs) and the Krížom-krážom textbook's 14 present-tense classes, which agree.
   Which model a verb follows is decided by rule from its own forms (Wiktionary, in lookup-data.js): the infinitive
   ending + the on / oni present forms. Verbs that fit no model cleanly (byť, ísť, jesť, vedieť…) are "nepravidelné". */
(() => {
  'use strict';
  // present-tense types: by the on / oni endings
  const TYPES = [
    { k: 'a', sk: '-á / -ajú', en: 'on -á, oni -ajú' },
    { k: 'iej', sk: '-ie / -ejú', en: 'on -ie, oni -ejú' },
    { k: 'i', sk: '-í / -ia', en: 'on -í, oni -ia (or -a)' },
    { k: 'e', sk: '-e / -ú', en: 'on -e, oni -ú (or -u)' },
    { k: 'ie', sk: '-ie / -ú', en: 'on -ie, oni -ú (or -u)' },
  ];
  const VZORY = [
    { k: 'chytať', t: 'a', how: '<b>-ať</b>, present with <b>-á-</b>', rule: '<i>chytám, chytáš, chytá… chytajú</i>. After a long syllable the <b>á</b> shortens: <i>čítam, čítaš</i> (rhythmic law). Past: swap <b>-ť</b> for <b>-l</b> (<i>chytal</i>). The biggest and most regular model.' },
    { k: 'rozumieť', t: 'iej', how: '<b>-ieť</b>, present with <b>-ie-</b> and <b>-ejú</b>', rule: '<i>rozumiem… rozumie, rozumejú</i>. Past: <b>-el</b> (<i>rozumel</i>), imperative <b>-ej</b> (<i>rozumej!</i>). A small model: <i>rozumieť</i>, <i>ovdovieť</i>, and verbs meaning "to become …" like <i>zelenieť sa</i> (zelenie sa, zelenejú sa).' },
    { k: 'robiť', t: 'i', how: '<b>-iť</b>, present with <b>-í-</b>', rule: '<i>robím, robíš, robí… robia</i>. After a long syllable <b>-im, -iš</b> (<i>vrátim</i>). Imperative usually drops <b>-iť</b>: <i>rob! hovor!</i> (after two consonants <b>-i</b>: <i>kresli!</i>).' },
    { k: 'vidieť', t: 'i', how: '<b>-ieť / -eť</b>, present with <b>-í-</b>', rule: '<i>vidím… vidia</i>, like <i>robiť</i> in the present, but the past has <b>-el</b>: <i>videl, sedel, letel, myslel</i>.' },
    { k: 'kričať', t: 'i', how: '<b>-ať</b> (mostly after č, ž, š, j), present with <b>-í-</b>', rule: '<i>kričím… kričia</i>, like <i>robiť</i> in the present, past <b>-al</b>: <i>kričal, držal, bežal</i>. Also <i>stáť → stojím, stoja; spať → spím, spia; báť sa → bojím sa</i>.' },
    { k: 'česať', t: 'e', how: '<b>-ať</b>, present with <b>-e-</b>, the last consonant softens', rule: '<i>česať → češem… češú; písať → píšem; kázať → kážem; plakať → plačem; kopať → kopem</i>. Learn the <i>ja</i> form with the verb. Past keeps the infinitive stem: <i>česal, písal</i>.' },
    { k: 'pracovať', t: 'e', how: '<b>-ovať</b> → <b>-ujem</b>', rule: '<i>pracujem, pracuješ… pracujú</i>. Hundreds of verbs, completely regular. Past keeps <b>-oval</b>: <i>pracoval, ďakoval</i>.' },
    { k: 'žuť', t: 'e', how: 'short infinitive, present with <b>-j-</b>', rule: '<i>žujem… žujú; piť → pijem; žiť → žijem; kryť → kryjem; šiť → šijem; umyť → umyjem; smiať sa → smejem sa</i>. Past from the infinitive: <i>pil, žil, umyl</i>.' },
    { k: 'niesť', t: 'ie', how: 'infinitive <b>-sť / -zť / -cť</b>', rule: 'The infinitive ending <b>-sť / -zť / -cť</b> covers up the last consonant of the real stem, so you can\'t see it in the infinitive. The present and the past show it: <i>niesť</i> → <b>nes</b>: <i>nesiem, niesol</i> · <i>viesť</i> → <b>ved</b>: <i>vediem, viedol</i> · <i>liezť</i> → <b>lez</b>: <i>leziem, liezol</i> · <i>piecť</i> → <b>pek</b>: <i>piekol</i>, and <b>k → č</b> in the present: <i>pečiem</i>. So learn the <i>ja</i> form with the verb. Also: the long <b>ie</b> of the infinitive is short <b>e</b> in the present (<i>niesť → nesiem</i>). Present: <b>-iem, -ieš, -ie… -ú</b>. Past: <b>-ol</b> for <i>on</i> (<i>niesol</i>), then <i>niesla, nieslo, niesli</i>.' },
    { k: 'hynúť', t: 'ie', how: '<b>-núť</b> after a vowel (or r, l)', rule: '<i>hyniem… hynie, hynú</i>; past <b>-ul</b>: <i>hynul</i>. Also <i>minúť → miniem, minul; plynúť → plynie</i>.' },
    { k: 'chudnúť', t: 'e', how: '<b>-núť</b> after a consonant', rule: '<i>chudnem… chudne, chudnú</i>. Past usually drops <b>-nu-</b>: <i>chudol, zabudol (zabudnúť), sadol si (sadnúť si)</i>; some keep it: <i>kopnul / kopol</i>.' },
    { k: 'žať', t: 'e', how: '<b>-ať</b>, an <b>-n- / -m-</b> appears in the present', rule: '<i>žnem… žnú; začať → začnem; stať sa → stanem sa; pripäť → pripnem</i>. Past from the infinitive: <i>žal, začal, stal sa</i>.' },
    { k: 'brať', t: 'ie', how: '<b>-ať</b>, present with <b>-ie-</b> and a new vowel in the stem', rule: '<i>brať → beriem… berie, berú; prať → periem; orať → oriem; hnať → ženiem</i>. Past from the infinitive: <i>bral, hnal</i>.' },
    { k: 'trieť', t: 'ie', how: '<b>-rieť</b>', rule: '<i>triem… trie, trú</i>; past <b>-rel</b>: <i>trel</i>. Also <i>zomrieť → zomriem, zomrel; udrieť; zavrieť → zavriem, zavrel</i>, and <i>smieť → smiem, smú, smel</i>.' },
  ];
  const IRR = { k: 'irr', sk: 'nepravidelné', how: 'irregular', rule: 'These follow no model: learn them by heart. They are among the most frequent verbs: <i>byť</i> (som, je, sú), <i>ísť</i> (idem, išiel), <i>jesť</i> (jem, jedia), <i>vedieť</i> (viem, vedia), <i>povedať</i> (poviem, povedia), <i>chcieť</i> (chcem, chcú), <i>môcť</i> (môžem, môžu), <i>vziať</i> (vezmem, vzal).' };
  const BYK = Object.fromEntries(VZORY.map((v) => [v.k, v]));

  // irregular families (prefixed verbs too: prísť, odísť, zjesť, odpovedať, pomôcť…)
  const IRR_END = ['byť', 'ísť', 'jsť', 'jesť', 'vedieť', 'povedať', 'chcieť', 'môcť', 'vziať'];
  function classify(w, pres) {
    if (!w || !pres || pres.length < 6) return null;
    if (IRR_END.some((x) => w.endsWith(x))) return 'irr';
    const s3 = pres[2] || '', p3 = pres[5] || '';
    if (/[áa]$/.test(s3) && /aj[úu]$/.test(p3)) return 'chytať';
    if (/ie$/.test(s3) && /ej[úu]$/.test(p3)) return 'rozumieť';
    if (/[íi]$/.test(s3) && /(ia|a)$/.test(p3)) {
      if (/iť$/.test(w)) return 'robiť';
      if (/eť$/.test(w)) return 'vidieť';
      if (/[aáä]ť$/.test(w)) return 'kričať';
      return null;
    }
    if (/ovať$/.test(w) && /uje$/.test(s3)) return 'pracovať';
    // -núť, or -nuť after a long syllable (tiahnuť, zvládnuť)
    if (/n[úu]ť$/.test(w)) { if (/nie$/.test(s3)) return 'hynúť'; if (/ne$/.test(s3)) return 'chudnúť'; return null; }
    if (/je$/.test(s3) && /j[úu]$/.test(p3)) return 'žuť';
    if (/ieť$/.test(w) && /ie$/.test(s3) && /[úu]$/.test(p3)) return 'trieť';
    if (/[szc]ť$/.test(w) && /ie$/.test(s3) && /[úu]$/.test(p3)) return 'niesť';
    if (/[aáä]ť$/.test(w) && /e$/.test(s3) && /[úu]$/.test(p3)) {
      const stem = w.replace(/i?[aáä]ť$/, '');
      if (/ie$/.test(s3)) return 'brať';
      // žať: an n / m that isn't in the infinitive (začať → začne); česať: the stem's own consonant (klamať → klame)
      if (/[nm]e$/.test(s3) && !/[nm]$/.test(stem)) return 'žať';
      return 'česať';
    }
    return null;
  }
  const vzorOf = (v) => classify(v.w, v.pres);
  // every Hľadaj verb (lookup-data.js) sorted by model; the ~400 common ones (game data) first
  let MEM = null;
  function members() {
    if (MEM) return MEM;
    const LK = window.PADY_LOOKUP; if (!LK?.verbs) return {};
    const common = new Set((window.PADY_DATA?.conj || []).map((v) => v.w));
    MEM = {};
    for (const a of LK.verbs) {
      const [w, refl, g, asp, partner, pres, past, imp] = a;
      const k = classify(w, pres); if (!k) continue;
      (MEM[k] = MEM[k] || []).push({ w, refl, g, asp, partner, pres, past, imp, common: common.has(w) });
    }
    for (const k in MEM) MEM[k].sort((x, y) => (y.common - x.common));
    return MEM;
  }
  const modelOf = (k) => (members()[k] || []).find((v) => v.w === k) || null;
  // the lookup dictionary loads on demand (Hľadaj does the same)
  function ready() {
    return new Promise((res) => {
      if (window.PADY_LOOKUP) return res();
      const s = document.createElement('script'); s.src = 'lookup-data.js'; s.onload = () => res(); s.onerror = () => res(); document.head.appendChild(s);
    });
  }
  window.PADYVzory = { TYPES, VZORY, IRR, BYK, classify, vzorOf, members, modelOf, ready };
})();
