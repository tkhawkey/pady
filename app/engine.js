/* PÁDY — learning engine: spaced repetition, units, item generation, mistake explanations, speech */
(() => {
  'use strict';
  const P = window.PADY, D = window.PADY_DATA;
  const { CASES, PATTERNS, PATTERN_EN } = P;
  const CK = CASES.map((c) => c.k);
  const CI = Object.fromEntries(CK.map((k, i) => [k, i]));
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rand(a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const bare = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  const store = () => { const s = P.save(); s.srs ||= {}; s.units ||= {}; s.mywords ||= {}; return s; };

  // ---------- spaced repetition (Leitner boxes 0..6) ----------
  const INTERVAL = [0, 1, 2, 4, 8, 16, 32];   // days until next review, by box
  function review(key, good) {
    const s = store();
    const box0 = s.srs[key]?.[0] ?? 0;
    const box = good ? Math.min(6, box0 + 1) : Math.max(0, box0 - 2);
    s.srs[key] = [box, today() + (good ? INTERVAL[box] : 0)];
    P.persist();
  }
  function seed(key, box) {
    const s = store();
    if ((s.srs[key]?.[0] ?? -1) >= box) return;
    s.srs[key] = [box, today() + INTERVAL[box]];
  }
  const boxOf = (key) => store().srs[key]?.[0];
  const masteryOf = (key) => { const b = boxOf(key); return b == null ? 0 : Math.min(b, 4) / 4; };   // box 4+ = mastered
  const dueKeys = () => Object.entries(store().srs).filter(([, [, d]]) => d <= today()).sort((a, b) => a[1][0] - b[1][0]).map(([k]) => k);

  // ---------- nouns by pattern ----------
  const norm = (n) => ({ w: n.w, g: n.g || PATTERN_EN[n.w]?.[0] || '', gen: n.gen, pat: n.pat || n.w, s: n.s, p: n.p, alt: n.alt || {} });
  const MODELS = Object.fromEntries(D.models.map((m) => [m.w, norm(m)]));
  const POOL = Object.fromEntries(PATTERNS.map((p) => [p, [MODELS[p], ...D.nouns.filter((n) => n.pat === p).slice(0, 30).map(norm)]]));

  // ---------- units (the path) ----------
  const SG = CK.map((k) => `${k}_s`), PL = CK.map((k) => `${k}_p`);
  const MAIN6 = ['žena', 'mesto', 'dub', 'chlap', 'ulica', 'stroj'];
  const UNITS = [
    { id: 'u1', sk: 'Kto? Čo? · Koho? Čo?', en: 'Nominative and accusative singular: the subject and the direct object', pats: ['žena', 'mesto', 'dub', 'chlap'], cells: ['nom_s', 'acc_s'], learn: { col: ['acc', 's'] } },
    { id: 'u2', sk: 'O kom? O čom?', en: 'Locative singular: after o, v, na, po, pri', pats: MAIN6, cells: ['loc_s'], learn: { col: ['loc', 's'] } },
    { id: 'u3', sk: 'Koho? Čoho?', en: 'Genitive singular: "of", and after bez, do, z, od, u', pats: MAIN6, cells: ['gen_s'], learn: { col: ['gen', 's'] } },
    { id: 'u4', sk: 'Komu? Čomu?', en: 'Dative singular: to/for someone, and after k, proti', pats: MAIN6, cells: ['dat_s'], learn: { col: ['dat', 's'] } },
    { id: 'u5', sk: 'S kým? S čím?', en: 'Instrumental singular: after s, pred, za, nad, pod', pats: MAIN6, cells: ['ins_s'], learn: { col: ['ins', 's'] } },
    { id: 'u6', sk: 'Ďalšie vzory', en: 'The other patterns in the singular: hrdina, dlaň, kosť, srdce', pats: ['hrdina', 'dlaň', 'kosť', 'srdce'], cells: SG, learn: { pat: 'kosť' } },
    { id: 'u7', sk: 'Viac ako jeden', en: 'Nominative and accusative plural', pats: MAIN6, cells: ['nom_p', 'acc_p'], learn: { col: ['nom', 'p'] } },
    { id: 'u8', sk: '-ách · -och · -om · -ami', en: 'Locative, dative and instrumental plural', pats: MAIN6, cells: ['loc_p', 'dat_p', 'ins_p'], learn: { col: ['loc', 'p'] } },
    { id: 'u9', sk: 'Genitív plurál', en: 'Genitive plural: the tricky one (žien, miest, ulíc)', pats: [...MAIN6, 'kosť', 'dlaň', 'srdce'], cells: ['gen_p'], learn: { col: ['gen', 'p'] } },
    { id: 'u10', sk: 'Plurál ďalších vzorov', en: 'Plural of hrdina, dlaň, kosť and srdce', pats: ['hrdina', 'dlaň', 'kosť', 'srdce'], cells: PL, learn: { pat: 'srdce' } },
    { id: 'u11', sk: 'Dievča a vysvedčenie', en: 'The last two patterns, every case', pats: ['dievča', 'vysvedčenie'], cells: [...SG, ...PL], learn: { pat: 'dievča' } },
    { id: 'u12', sk: 'Slovesá a pády', en: 'Which case does the verb take?', verbs: true },
  ];
  // verbs worth drilling: common, not plain "verb + accusative object"
  const VERBS = [];
  for (const v of D.verbs) {
    const groups = {};
    v.fr.forEach((f) => { (groups[f.p || ''] ||= []).push(f); });
    for (const [p, frs] of Object.entries(groups)) {
      const n = frs.reduce((s, f) => s + f.n, 0);
      const cases = [...new Set(frs.map((f) => f.c))];
      if (n < 5 || (!p && cases.length === 1 && cases[0] === 'A')) continue;
      VERBS.push({ key: `v|${v.v}|${p}`, v, p, cases, n, ex: frs.flatMap((f) => f.ex), cz: frs.flatMap((f) => (f.cz || []).map((z) => ({ ...z, c: f.c }))) });
    }
  }
  VERBS.sort((a, b) => b.n - a.n);
  const TOP_VERBS = VERBS.slice(0, 45);
  for (const u of UNITS) u.keys = u.verbs ? TOP_VERBS.map((x) => x.key) : u.pats.flatMap((p) => u.cells.map((c) => `${p}|${c}`));
  const unitMastery = (u) => u.keys.reduce((s, k) => s + masteryOf(k), 0) / u.keys.length;
  const unitDone = (u) => !!store().units[u.id];
  const currentUnit = () => UNITS.find((u) => !unitDone(u)) || UNITS[UNITS.length - 1];

  // ---------- mini-sentence frames ----------
  const FRAME = {
    nom: { s: ['To je ___.', 'This is ___.'], p: ['To sú ___.', 'These are ___.'] },
    acc: { s: ['Vidím ___.', 'I see ___.'], p: ['Vidím ___.', 'I see ___.'] },
    gen: { s: ['bez ___', 'without ___'], p: ['bez ___', 'without ___'] },
    dat: { s: ['k ___', 'towards ___'], p: ['k ___', 'towards ___'] },
    loc: { s: ['o ___', 'about ___'], p: ['o ___', 'about ___'] },
    ins: { s: ['s ___', 'with ___'], p: ['s ___', 'with ___'] },
  };
  function frame(ck, num, form) {
    let [sk, en] = FRAME[ck][num];
    // k → ku before k/g, s → so before s/z/š/ž (ku kamarátovi, so ženou)
    if (ck === 'dat' && /^[kg]/i.test(form)) sk = sk.replace(/^k /, 'ku ');
    if (ck === 'ins' && /^[szšž]/i.test(form)) sk = sk.replace(/^s /, 'so ');
    return { sk, en };
  }

  // ---------- items ----------
  const parseKey = (key) => { const [pat, cell] = key.split('|'); const [ck, num] = cell.split('_'); return { pat, ck, num }; };
  const formsOf = (n) => { const all = []; CK.forEach((k, i) => ['s', 'p'].forEach((num) => all.push({ ck: k, num, f: n[num][i] }))); return all; };
  const okSet = (n, ck, num) => new Set([n[num][CI[ck]], ...(n.alt?.[`${ck}_${num}`] || [])]);

  function nounItem(key, type, noun) {
    const { pat, ck, num } = parseKey(key);
    const n = noun || pick(POOL[pat].slice(0, Math.max(3, Math.min(POOL[pat].length, 12))));
    const answer = n[num][CI[ck]];
    const item = { kind: 'noun', type, key, noun: n, ck, num, answer, ok: okSet(n, ck, num), frame: frame(ck, num, answer) };
    if (type === 'pickForm') {
      const others = shuffle([...new Set(formsOf(n).map((x) => x.f))].filter((f) => !item.ok.has(f))).slice(0, 3);
      item.options = shuffle([answer, ...others]);
    }
    if (type === 'pickCase') item.valid = new Set(formsOf(n).filter((x) => x.f === answer).map((x) => x.ck));
    return item;
  }
  function verbItem(vx, type) {
    if (type === 'vform') {
      const zs = vx.cz.filter((z) => {
        const t = MODELS[z.l] || D.nouns.find((n) => n.w === z.l);
        return t && t[z.num].includes(z.f.toLowerCase());
      });
      if (zs.length) {
        const z = pick(zs);
        const t = norm(MODELS[z.l] || D.nouns.find((n) => n.w === z.l));
        const cap = z.f[0] !== z.f[0].toLowerCase();
        const fix = (s) => (cap ? s[0].toUpperCase() + s.slice(1) : s);
        const others = shuffle([...new Set(t[z.num])].filter((f) => f !== z.f.toLowerCase())).slice(0, 3).map(fix);
        return { kind: 'vform', key: vx.key, vx, z, noun: t, options: shuffle([z.f, ...others]) };
      }
    }
    return { kind: 'verb', key: vx.key, vx };
  }
  const typeForBox = (box) => (box == null || box <= 1 ? pick(['pickForm', 'pickForm', 'pickCase'])
    : box <= 3 ? pick(['pickForm', 'type', 'type']) : 'type');

  function itemForKey(key, forced) {
    if (key.startsWith('v|')) { const vx = VERBS.find((x) => x.key === key); return vx ? verbItem(vx, forced || (boxOf(key) >= 2 ? 'vform' : 'verb')) : null; }
    if (key.startsWith('w|')) return myWordItem(key, forced);
    const { pat } = parseKey(key);
    if (!POOL[pat]) return null;
    return nounItem(key, forced || typeForBox(boxOf(key)));
  }

  // ---------- my words (from Hľadaj) ----------
  function addMyWord(entry) {
    const s = store();
    s.mywords[`${entry.type}:${entry.w}`] = { ...entry, added: today() };
    P.persist();
  }
  const removeMyWord = (id) => { delete store().mywords[id]; P.persist(); };
  const myWords = () => Object.entries(store().mywords).map(([id, w]) => ({ id, ...w }));
  const hasMyWord = (type, w) => !!store().mywords[`${type}:${w}`];
  // key: w|<type:word>|<slot>
  function myWordKeys(w) {
    if (w.type === 'noun') return CK.flatMap((k) => [`w|${w.id}|${k}_s`, `w|${w.id}|${k}_p`]);
    return ['sg_nom_m', 'sg_gen_f', 'sg_dat_m', 'sg_acc_f', 'sg_loc_n', 'sg_ins_m', 'pl_gen', 'pl_loc', 'pl_ins', 'pl_nom_vir'].map((sl) => `w|${w.id}|${sl}`);
  }
  const ADJ_SLOT_SK = (sl) => {
    const [num, ck, ...g] = sl.split('_');
    const G = { m: 'muž.', f: 'žen.', n: 'stred.', m_anim: 'muž. živ.', m_inan: 'muž. neživ.', vir: 'muži', nonvir: 'ostatné' }[g.join('_')] || '';
    return { ck, num: num === 'sg' ? 's' : 'p', label: `${CASES[CI[ck]].name} ${num === 'sg' ? 'sg' : 'pl'}${G ? ' · ' + G : ''}` };
  };
  function myWordItem(key, forced) {
    const [, id, slot] = key.split('|');
    const w = store().mywords[id]; if (!w) return null;
    if (w.type === 'noun') {
      const [ck, num] = slot.split('_');
      const it = nounItem(`${w.pat || 'žena'}|${ck}_${num}`, forced || typeForBox(boxOf(key)), norm(w));
      it.key = key;   // reviews are recorded against the word itself
      return it;
    }
    const s = ADJ_SLOT_SK(slot);
    const answer = w.f[slot];
    return { kind: 'adj', type: forced || (boxOf(key) >= 2 ? 'type' : 'pickForm'), key, adj: w, slot, ck: s.ck, num: s.num, label: s.label, answer,
      options: shuffle([answer, ...shuffle([...new Set(Object.values(w.f))].filter((f) => f !== answer)).slice(0, 3)]) };
  }

  // ---------- sessions ----------
  function colorItem() { const s = pick(D.sents || []); return s ? { kind: 'color', key: null, sent: s } : null; }

  function buildDose(n = 12) {
    const s = store();
    const items = [];
    const used = new Set();
    const push = (it) => { if (it && !used.has(it.key + it.kind)) { used.add(it.key + it.kind); items.push(it); } };
    // 1. what is due (weakest first)
    for (const k of dueKeys().slice(0, 7)) push(itemForKey(k));
    // 2. new cells from the current unit
    const cu = currentUnit();
    for (const k of shuffle(cu.keys.filter((k) => boxOf(k) == null)).slice(0, 4)) push(itemForKey(k));
    // 3. my words
    for (const w of shuffle(myWords()).slice(0, 3)) push(itemForKey(pick(myWordKeys(w))));
    // 4. a verb now and then (once units are under way)
    if (Object.keys(s.units).length >= 2 || cu.verbs) push(itemForKey(pick(TOP_VERBS).key));
    // 5. fill with review from finished units
    const doneKeys = UNITS.filter(unitDone).flatMap((u) => u.keys);
    let guard = 0;
    while (items.length < n - 1 && guard++ < 50) {
      const pool = doneKeys.length ? doneKeys : cu.keys;
      push(itemForKey(pick(pool)));
    }
    const out = shuffle(items).slice(0, n - 1);
    const c = colorItem(); if (c) out.push(c);   // finish on a real sentence
    return out;
  }

  function buildUnitSession(u, step) {
    const N = step === 'test' ? 10 : step === 'write' ? 8 : 10;
    const items = [];
    for (let i = 0; i < N; i++) {
      const key = pick(u.keys);
      if (u.verbs) { items.push(itemForKey(key, step === 'practice' ? 'verb' : step === 'write' ? 'vform' : pick(['verb', 'vform']))); continue; }
      const type = step === 'practice' ? pick(['pickForm', 'pickForm', 'pickCase'])
        : step === 'write' ? 'type' : pick(['pickForm', 'type', 'type', 'pickCase']);
      items.push(itemForKey(key, type));
    }
    return items.filter(Boolean);
  }

  // ---------- explaining mistakes ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const chip = (ck, num) => `<span class="lg c-${ck}">${CASES[CI[ck]].name} ${num === 's' ? 'sg' : 'pl'}</span>`;
  const HARD = { 'ď': 'd', 'ť': 't', 'ň': 'n', 'ľ': 'l' };
  function endingOf(form, lemma) {
    const stem = window.PADYLearn?.stemOf(lemma) ?? lemma;
    if (form.startsWith(stem)) return form.slice(stem.length);
    // spelling: ď ť ň ľ lose the háček before e/i (kosť → kosti, dlaň → dlane)
    const h = HARD[stem.slice(-1)];
    if (h) { const s2 = stem.slice(0, -1) + h; if (form.startsWith(s2) && /^[eiíé]/.test(form.slice(s2.length))) return form.slice(s2.length); }
    return null;
  }
  // reveal = false gives a hint: why the answer is wrong and a nudge, but never the answer itself
  function explain({ noun, adj, ck, num, answer, reveal = true }) {
    if (!noun || !answer) return '';
    if (!reveal) return hintFor({ noun, adj, ck, num, answer });
    const n = noun.s ? noun : norm(noun);
    const correct = n[num][CI[ck]];
    const ans = answer.trim().toLowerCase().split(/\s+/).pop();   // phrase mode: judge the noun
    const pat = n.pat || noun.pat;
    const model = MODELS[pat];
    const modelForm = model?.[num][CI[ck]];
    const modelEnd = model ? endingOf(modelForm, model.w) : null;
    const correctEnd = endingOf(correct, n.w);
    // only point at the model word when it really has the same ending as this word
    const sameAsModel = model && model.w !== n.w && modelEnd != null && modelEnd === correctEnd;
    const like = sameAsModel ? ` Like <i>${model.w}</i> → <i>${modelForm}</i>.` : '';
    const note = variantNote(pat, ck, num, modelEnd, correctEnd);
    const parts = [];
    if (adj) {
      const af = P.adjForm(adj, n.gen, ck, num);
      if (answer.trim().toLowerCase().split(/\s+/)[0] !== af) parts.push(`The adjective changes too: <b>${esc(af)}</b>.`);
    }
    if (ans === correct) return parts.join(' ');
    if (bare(ans) === bare(correct)) return `So close: right ending, but check the accents: <b>${esc(correct)}</b>. ${parts.join(' ')}`;
    const other = formsOf(n).filter((x) => x.f === ans);
    if (other.length) {
      return `<b>${esc(ans)}</b> is ${other.map((x) => chip(x.ck, x.num)).join(' / ')}. Here you need ${chip(ck, num)}: <b>${esc(correct)}</b>.${like} ${parts.join(' ')}`;
    }
    const end = endingOf(ans, n.w);
    // the stem itself changes (poriadok → poriadky: the o drops out; človek → ľudia)
    if (correctEnd == null) {
      if (end && correct.endsWith(end)) {
        const newStem = correct.slice(0, correct.length - end.length);
        const drop = droppedVowel(window.PADYLearn?.stemOf(n.w) ?? n.w, newStem);
        return `Right ending <b>-${esc(end)}</b>, but the stem changes: ${drop ? `the <b>${drop}</b> drops out, ` : ''}<i>${esc(n.w)}</i> → <i>${esc(newStem)}-</i>: <b>${esc(correct)}</b>. ${parts.join(' ')}`;
      }
      return `The stem changes here: <i>${esc(n.w)}</i> → <b>${esc(correct)}</b> (${chip(ck, num)}). ${note} ${parts.join(' ')}`;
    }
    // the stem grows (nebo → nebesá): right ending, extra consonant(s) before it
    if (end && correct.endsWith(end) && correctEnd !== end) {
      const newStem = correct.slice(0, correct.length - end.length);
      const stem = window.PADYLearn?.stemOf(n.w) ?? n.w;
      if (newStem.startsWith(stem) && /[^aeiouyáéíóúýäô]/.test(newStem.slice(stem.length))) {
        return `Right ending <b>-${esc(end)}</b>, but the stem grows: <i>${esc(n.w)}</i> → <i>${esc(newStem)}-</i>: <b>${esc(correct)}</b>. ${parts.join(' ')}`;
      }
    }
    // right pattern, but this word takes a different variant (chlap → chlapi, vrah → vrahovia)
    if (end != null && model && model.w !== n.w && end === modelEnd && modelEnd !== correctEnd) {
      return `<b>-${esc(end || '∅')}</b> works for <i>${model.w}</i> (<i>${modelForm}</i>), but this ending varies from word to word: <i>${esc(n.w)}</i> takes <b>${esc(correct)}</b>. ${note} ${parts.join(' ')}`;
    }
    if (end != null) {
      const fromPats = PATTERNS.filter((p) => p !== pat && MODELS[p] && endingOf(MODELS[p][num][CI[ck]], p) === end);
      if (fromPats.length) {
        return `<b>-${esc(end || '∅')}</b> is the ${chip(ck, num)} ending of <i>${fromPats.slice(0, 2).join(', ')}</i>. But <i>${esc(n.w)}</i> follows <i>${pat}</i>: <b>${esc(correct)}</b>.${like || (note ? ' ' + note : '')} ${parts.join(' ')}`;
      }
    }
    return `${chip(ck, num)} of <i>${esc(n.w)}</i> is <b>${esc(correct)}</b>.${like || (note ? ' ' + note : '')} ${parts.join(' ')}`;
  }

  // the same diagnosis as explain(), worded without the correct form
  function hintFor({ noun, adj, ck, num, answer }) {
    const n = noun.s ? noun : norm(noun);
    const correct = n[num][CI[ck]];
    const ans = answer.trim().toLowerCase().split(/\s+/).pop();
    const pat = n.pat || noun.pat;
    const model = MODELS[pat];
    const modelForm = model?.[num][CI[ck]];
    const modelEnd = model ? endingOf(modelForm, model.w) : null;
    const correctEnd = endingOf(correct, n.w);
    const sameAsModel = model && model.w !== n.w && modelEnd != null && modelEnd === correctEnd;
    const like = sameAsModel ? ` Think of <i>${model.w}</i> → <i>${modelForm}</i>.` : '';
    const note = variantNote(pat, ck, num, modelEnd, correctEnd);
    const adjBad = adj && answer.trim().toLowerCase().split(/\s+/)[0] !== P.adjForm(adj, n.gen, ck, num);
    const adjPart = adjBad ? ' The adjective needs to change too.' : '';
    const tail = ' <span class="why-try">Try once more.</span>';
    if (ans === correct) return adjBad ? `The noun is right.${adjPart}${tail}` : '';
    if (bare(ans) === bare(correct)) return `So close: right ending, check the accents.${adjPart}${tail}`;
    const other = formsOf(n).filter((x) => x.f === ans);
    if (other.length) return `<b>${esc(ans)}</b> is ${other.map((x) => chip(x.ck, x.num)).join(' / ')}, not ${chip(ck, num)}.${like}${adjPart}${tail}`;
    const end = endingOf(ans, n.w);
    if (correctEnd == null) {
      if (end && correct.endsWith(end)) return `Right ending <b>-${esc(end)}</b>, but the stem changes in this word (a vowel drops out or changes).${adjPart}${tail}`;
      return `This word's stem changes in this form. ${note}${adjPart}${tail}`;
    }
    if (end && correct.endsWith(end) && correctEnd !== end) {
      const newStem = correct.slice(0, correct.length - end.length);
      const stem = window.PADYLearn?.stemOf(n.w) ?? n.w;
      if (newStem.startsWith(stem) && /[^aeiouyáéíóúýäô]/.test(newStem.slice(stem.length))) return `Right ending <b>-${esc(end)}</b>, but the stem grows in this word.${adjPart}${tail}`;
    }
    if (end != null && model && model.w !== n.w && end === modelEnd && modelEnd !== correctEnd) {
      return `<b>-${esc(end || '∅')}</b> works for <i>${model.w}</i>, but <i>${esc(n.w)}</i> takes a different ending here. ${note}${adjPart}${tail}`;
    }
    if (end != null) {
      const fromPats = PATTERNS.filter((p) => p !== pat && MODELS[p] && endingOf(MODELS[p][num][CI[ck]], p) === end);
      if (fromPats.length) return `<b>-${esc(end || '∅')}</b> is the ${chip(ck, num)} ending of <i>${fromPats.slice(0, 2).join(', ')}</i>, but <i>${esc(n.w)}</i> follows <i>${pat}</i>.${like || (note ? ' ' + note : '')}${adjPart}${tail}`;
    }
    return `Not quite.${like || (note ? ' ' + note : ` Check ${chip(ck, num)} of the <i>${pat}</i> pattern.`)}${adjPart}${tail}`;
  }

  // Rozbi to!: what does this cell need? (said about the cell, so it doesn't reveal where the tile goes)
  function cellNeeds(noun, ck, num) {
    const n = noun.s ? noun : norm(noun);
    const pat = n.pat;
    const model = MODELS[pat];
    if (!model) return '';
    const modelForm = model[num][CI[ck]];
    const modelEnd = endingOf(modelForm, model.w);
    const correctEnd = endingOf(n[num][CI[ck]], n.w);
    if (modelEnd == null) return '';
    if (correctEnd === modelEnd) return `<i>${pat}</i>-type nouns take ${modelEnd ? `<b>-${esc(modelEnd)}</b>` : '<b>no ending</b>'} there (<i>${modelForm}</i>).`;
    return variantNote(pat, ck, num, modelEnd, correctEnd) || '';
  }

  // "poriadok" vs "poriadk": which vowel (or ie) dropped out?
  function droppedVowel(stem, newStem) {
    for (let i = 0; i < stem.length; i++) {
      for (const len of [2, 1]) {
        const v = stem.slice(i, i + len);
        if ((len === 2 ? /^(ie|ô)$/ : /^[aeiouyáéíóúýô]$/).test(v) && stem.slice(0, i) + stem.slice(i + len) === newStem) return v;
      }
    }
    return null;
  }

  // cells where words of the same pattern genuinely differ; shown instead of a misleading "like <model>"
  const VARIANTS = {
    'chlap|nom_p': 'Masculine people take <b>-i</b>, <b>-ia</b> or <b>-ovia</b> in the nominative plural (<i>chlapi, priatelia, otcovia</i>): learn it with each word.',
    'hrdina|nom_p': 'Masculine people take <b>-i</b>, <b>-ia</b> or <b>-ovia</b> in the nominative plural: learn it with each word.',
    'dub|gen_s': 'Masculine things take <b>-a</b> or <b>-u</b> in the genitive singular (<i>duba, stola</i> but <i>domu, hradu</i>). No rule: learn it with the word.',
    'dub|loc_s': 'The locative singular is usually <b>-e</b>, sometimes <b>-u</b> (<i>v dome</i> but <i>v rohu, v parku</i>).',
    'dub|ins_p': 'The instrumental plural is <b>-mi</b> or <b>-ami</b> (<i>dubmi</i> but <i>stromami</i>), depending on the word.',
    'chlap|ins_p': 'The instrumental plural is <b>-mi</b> or <b>-ami</b> (<i>chlapmi</i> but <i>otcami</i>), depending on the word.',
  };
  const GEN_PL = 'The genitive plural has no ending, and the stem often changes (a vowel is inserted or lengthened): learn the form with the word.';
  function variantNote(pat, ck, num, modelEnd, correctEnd) {
    if (VARIANTS[`${pat}|${ck}_${num}`]) return VARIANTS[`${pat}|${ck}_${num}`];
    if (ck === 'gen' && num === 'p' && ['žena', 'mesto', 'ulica', 'srdce'].includes(pat)) return GEN_PL;
    if (modelEnd != null && correctEnd != null && modelEnd !== correctEnd && bare(modelEnd) === bare(correctEnd)) {
      return 'Rhythmic law: after a long syllable, a long ending becomes short (<i>mestá</i> but <i>miesta</i>, <i>ženám</i> but <i>dieram</i>).';
    }
    return '';
  }

  // ---------- placement test tiers ----------
  const TIERS = [
    { units: ['u1', 'u2'], keys: ['žena|acc_s', 'mesto|loc_s', 'dub|loc_s', 'žena|loc_s', 'chlap|acc_s', 'dub|acc_s'] },
    { units: ['u3', 'u4', 'u5'], keys: ['žena|gen_s', 'dub|gen_s', 'mesto|ins_s', 'žena|dat_s', 'chlap|dat_s', 'ulica|ins_s', 'stroj|gen_s', 'chlap|ins_s'] },
    { units: ['u6', 'u7', 'u8'], keys: ['žena|nom_p', 'mesto|loc_p', 'dub|ins_p', 'chlap|nom_p', 'ulica|dat_p', 'kosť|gen_s', 'srdce|loc_s', 'dub|loc_p'] },
    { units: ['u9', 'u10', 'u11'], keys: ['žena|gen_p', 'mesto|gen_p', 'ulica|gen_p', 'kosť|gen_p', 'srdce|gen_p', 'dievča|gen_s', 'dlaň|ins_p', 'vysvedčenie|loc_s'] },
    { units: ['u12'], verbs: true },
  ];
  function tierItems(t, n = 4) {
    if (t.verbs) return shuffle(TOP_VERBS.slice(0, 20)).slice(0, n).map((vx) => verbItem(vx, 'verb'));
    return shuffle(t.keys.slice()).slice(0, n).map((k) => nounItem(k, 'pickForm', MODELS[parseKey(k).pat]));
  }
  function applyPlacement(results) {
    // results: [{tier, right, total, items:[{key, good}]}]
    const s = store();
    let passed = 0;
    for (const r of results) {
      for (const it of r.items) if (it.key) seed(it.key, it.good ? 3 : 0);
      if (r.right / r.total >= 0.75) {
        passed++;
        for (const uid of TIERS[r.tier].units) {
          s.units[uid] = true;
          const u = UNITS.find((x) => x.id === uid);
          for (const k of u.keys) seed(k, r.right === r.total ? 3 : 2);
        }
      } else break;
    }
    s.placement = { passed, at: today() };
    P.persist();
    return passed;
  }

  // ---------- speech ----------
  let skVoice = null;
  function findVoice() {
    if (!('speechSynthesis' in window)) return null;
    skVoice = speechSynthesis.getVoices().find((v) => /^sk/i.test(v.lang)) || null;
    return skVoice;
  }
  if ('speechSynthesis' in window) { findVoice(); speechSynthesis.onvoiceschanged = () => { findVoice(); document.dispatchEvent(new Event('pady-voices')); }; }
  function speak(text) {
    if (!skVoice && !findVoice()) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = skVoice; u.lang = skVoice.lang; u.rate = 0.9;
    speechSynthesis.speak(u);
    return true;
  }
  const canSpeak = () => !!(skVoice || findVoice());

  window.PADYEngine = {
    review, seed, boxOf, masteryOf, dueKeys, today, UNITS, TIERS, VERBS, TOP_VERBS, MODELS,
    unitMastery, unitDone, currentUnit, buildDose, buildUnitSession, itemForKey, tierItems, applyPlacement,
    explain, cellNeeds, frame, addMyWord, removeMyWord, myWords, hasMyWord, speak, canSpeak, parseKey, CI,
    setUnitDone(id) { store().units[id] = true; P.persist(); },
  };
})();
