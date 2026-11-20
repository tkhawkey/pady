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
  const unitsFor = (side) => (side === 'verbs' ? VUNITS : UNITS);
  const currentUnit = (side = 'nouns') => { const L = unitsFor(side); return L.find((u) => !unitDone(u)) || L[L.length - 1]; };

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
    if (key.startsWith('vb:')) return vconjItem(key, forced || vtypeForBox(boxOf(key)));
    if (key.startsWith('va|')) return aspectItem(key);
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

  // the daily dose: mostly the side you're on, plus a couple of due items from the other side
  function buildDose(n = 12, side = 'nouns') {
    const s = store();
    const items = [];
    const used = new Set();
    const push = (it) => { if (it && !used.has(it.key + it.kind)) { used.add(it.key + it.kind); items.push(it); } };
    const onSide = (k) => (side === 'verbs') === isVerbKey(k);
    const due = dueKeys();
    // 1. what is due on this side (weakest first)
    for (const k of due.filter(onSide).slice(0, 7)) push(itemForKey(k));
    // 2. new cells from the current unit
    const cu = currentUnit(side);
    for (const k of shuffle(cu.keys.filter((k) => boxOf(k) == null)).slice(0, 4)) push(itemForKey(k));
    // 3. my words (nouns/adjectives from Hľadaj)
    if (side === 'nouns') for (const w of shuffle(myWords()).slice(0, 3)) push(itemForKey(pick(myWordKeys(w))));
    // 4. the other side: a couple of due items, so neither side gets forgotten
    for (const k of due.filter((k) => !onSide(k)).slice(0, 2)) push(itemForKey(k));
    // 5. verb government now and then on the noun side
    if (side === 'nouns' && (Object.keys(s.units).filter((u) => !u.startsWith('vu')).length >= 2 || cu.verbs)) push(itemForKey(pick(TOP_VERBS).key));
    // 6. fill with review from finished units on this side
    const doneKeys = unitsFor(side).filter(unitDone).flatMap((u) => u.keys);
    let guard = 0;
    while (items.length < n - 1 && guard++ < 60) push(itemForKey(pick(doneKeys.length ? doneKeys : cu.keys)));
    const out = shuffle(items).slice(0, n - 1);
    const c = side === 'verbs' ? vcolorItem() : colorItem(); if (c) out.push(c);   // finish on a real sentence
    return out;
  }

  function buildUnitSession(u, step) {
    const N = step === 'test' ? 10 : step === 'write' ? 8 : 10;
    const items = [];
    for (let i = 0; i < N; i++) {
      const key = pick(u.keys);
      if (u.aspect) { items.push(aspectItem(key)); continue; }
      if (u.side === 'verbs') {
        const type = step === 'practice' ? pick(['pickForm', 'pickForm', 'pickPerson'])
          : step === 'write' ? 'type' : pick(['pickForm', 'type', 'type', 'pickPerson']);
        items.push(vconjItem(key, type));
        continue;
      }
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
    if (t.keys?.[0]?.startsWith('vb:') || t.keys?.[0]?.startsWith('va|')) {
      return shuffle(t.keys.slice()).map((k) => (k.startsWith('va|') ? aspectItem(k) : vconjItem(k, 'pickForm'))).filter(Boolean).slice(0, n);
    }
    if (t.verbs) return shuffle(TOP_VERBS.slice(0, 20)).slice(0, n).map((vx) => verbItem(vx, 'verb'));
    return shuffle(t.keys.slice()).slice(0, n).map((k) => nounItem(k, 'pickForm', MODELS[parseKey(k).pat]));
  }
  function applyPlacement(results, side = 'nouns') {
    // results: [{tier, right, total, items:[{key, good}]}]
    const s = store();
    const tiers = side === 'verbs' ? VTIERS : TIERS, units = unitsFor(side);
    let passed = 0;
    for (const r of results) {
      for (const it of r.items) if (it.key) seed(it.key, it.good ? 3 : 0);
      if (r.right / r.total >= 0.75) {
        passed++;
        for (const uid of tiers[r.tier].units) {
          s.units[uid] = true;
          const u = units.find((x) => x.id === uid);
          for (const k of u.keys) seed(k, r.right === r.total ? 3 : 2);
        }
      } else break;
    }
    s[side === 'verbs' ? 'vplacement' : 'placement'] = { passed, at: today() };
    P.persist();
    return passed;
  }

  // ====================================================================
  // VERBS: groups by the ja ending, units, items, placement
  // ====================================================================
  const CONJ = D.conj || [];
  const PK = P.PERSONS.map((p) => p.k);
  function vgroup(v) {
    if ((v.c || '').startsWith('irreg')) return 'irr';
    const ja = v.s[0], oni = v.s[5];
    if (/ujem$/.test(ja)) return 'ujem';
    if (/[aá]m$/.test(ja) && /aj[úu]$/.test(oni)) return 'am';
    if (/[ií]m$/.test(ja) && /(ia|a)$/.test(oni)) return 'im';
    if (/(e|ie)m$/.test(ja)) return 'em';
    return 'irr';
  }
  CONJ.forEach((v) => { v.grp = vgroup(v); });
  const VGROUPS = [
    { k: 'am', sk: '-ám', en: 'verbs whose ja form ends in -ám: volám, voláš… volajú', model: 'volať' },
    { k: 'im', sk: '-ím', en: 'verbs whose ja form ends in -ím: robím, robíš… robia', model: 'robiť' },
    { k: 'em', sk: '-em', en: 'verbs whose ja form ends in -em / -iem: píšem, žijem, začnem… píšu', model: 'písať' },
    { k: 'ujem', sk: '-ujem', en: '-ovať verbs (and a few others): pracujem, pracuješ… pracujú', model: 'pracovať' },
    { k: 'irr', sk: 'nepravidelné', en: 'irregular verbs: som, viem, idem, chcem, jem…', model: 'byť' },
  ];
  const VPOOL = Object.fromEntries(VGROUPS.map((g) => [g.k, CONJ.filter((v) => v.grp === g.k)]));
  VGROUPS.forEach((g) => { if (!VPOOL[g.k].some((v) => v.w === g.model)) g.model = VPOOL[g.k][0]?.w; });
  const vByW = (w) => CONJ.find((v) => v.w === w);

  const BUD = ['budem', 'budeš', 'bude', 'budeme', 'budete', 'budú'];
  const AUXV = ['som', 'si', '', 'sme', 'ste', ''];
  const IMP_OF = { p2s: 0, p1p: 1, p2p: 2 };
  const TENSE_SK = { pres: ['Prítomný čas', 'present tense'], past: ['Minulý čas', 'past tense'], fut: ['Budúci čas', 'future tense'], imp: ['Rozkazovací spôsob', 'imperative (command)'] };
  const TENSE_CLS = { pres: 't-pres', past: 't-past', fut: 't-fut', imp: 'vp' };
  const vjoin = (...xs) => xs.filter(Boolean).join(' ');
  // any form: tense × person (× gender for the singular past)
  function vform(v, tense, pi, g = 'm') {
    if (tense === 'pres') return v.a === 'pf' ? null : vjoin(v.s[pi], v.r);
    if (tense === 'fut') return v.a === 'pf' ? vjoin(v.s[pi], v.r) : vjoin(BUD[pi], v.r, v.w);
    if (tense === 'past') return vjoin(pi >= 3 ? v.l[3] : v.l[{ m: 0, f: 1, n: 2 }[g]], AUXV[pi], v.r);
    if (tense === 'imp') { const i = IMP_OF[PK[pi]]; return i == null || !v.i?.[i] ? null : vjoin(v.i[i], v.r); }
    return null;
  }
  const vname = (v) => vjoin(v.w, v.r);

  // aspect pairs: imperfective verbs whose perfective partner we know
  const APAIRS = CONJ.filter((v) => v.a === 'impf' && v.pr).slice(0, 40);

  const ALLG = ['am', 'im', 'em', 'ujem', 'irr'];
  const VUNITS = [
    { id: 'vu1', sk: 'Prítomný čas: -ám', en: 'Present tense of -ám verbs: volám, voláš… volajú', grps: ['am'], tenses: ['pres'], learn: { vgroup: 'am' } },
    { id: 'vu2', sk: 'Prítomný čas: -ím', en: 'Present tense of -ím verbs: robím, robíš… robia', grps: ['im'], tenses: ['pres'], learn: { vgroup: 'im' } },
    { id: 'vu3', sk: 'Prítomný čas: -em', en: 'Present tense of -em verbs: píšem, píšeš… píšu', grps: ['em'], tenses: ['pres'], learn: { vgroup: 'em' } },
    { id: 'vu4', sk: 'Prítomný čas: -ujem', en: '-ovať verbs: pracujem, pracuješ… pracujú', grps: ['ujem'], tenses: ['pres'], learn: { vgroup: 'ujem' } },
    { id: 'vu5', sk: 'Nepravidelné slovesá', en: 'The irregular core: som, mám, viem, idem, chcem, môžem…', grps: ['irr'], tenses: ['pres'], learn: { vgroup: 'irr' } },
    { id: 'vu6', sk: 'Minulý čas', en: 'Past tense: -l / -la / -lo / -li + som, si, sme, ste', grps: ALLG, tenses: ['past'], learn: { vtense: 'past' } },
    { id: 'vu7', sk: 'Budúci čas', en: 'Future: budem + infinitive, or a perfective verb on its own (urobím)', grps: ALLG, tenses: ['fut'], learn: { vtense: 'fut' } },
    { id: 'vu8', sk: 'Vid: robiť ↔ urobiť', en: 'Aspect pairs: ongoing / repeated vs. one-off / completed', aspect: true, learn: { vtab: 'vid' } },
    { id: 'vu9', sk: 'Rozkazovací spôsob', en: 'Commands: rob! robme! robte!', grps: ALLG, tenses: ['imp'], learn: { vtense: 'imp' } },
  ];
  for (const u of VUNITS) {
    u.side = 'verbs';
    u.keys = u.aspect ? APAIRS.map((x) => `va|${x.w}`)
      : u.grps.flatMap((g) => u.tenses.flatMap((t) => (t === 'imp' ? ['p2s', 'p1p', 'p2p'] : PK).map((pk) => `vb:${g}|${t}_${pk}`)));
  }
  const isVerbKey = (k) => k.startsWith('vb:') || k.startsWith('va|');

  function pickVerb(grp, tense) {
    let pool = VPOOL[grp] || [];
    if (tense === 'pres') pool = pool.filter((v) => v.a === 'impf');
    if (tense === 'imp') pool = pool.filter((v) => v.i?.some(Boolean));
    pool = pool.slice(0, 15);   // the most frequent verbs of the group
    return pool.length ? pick(pool) : null;
  }
  function vconjItem(key, type, verb) {
    const [gp, cell] = key.split('|');
    const grp = gp.slice(3), [tense, pk] = cell.split('_');
    const v = verb || pickVerb(grp, tense); if (!v) return null;
    const pi = PK.indexOf(pk);
    const g = pi < 3 ? pick(['m', 'f']) : 'm';
    const answer = vform(v, tense, pi, g); if (!answer) return null;
    const all = [];
    for (const t of ['pres', 'past', 'fut']) PK.forEach((p, i) => { const f = vform(v, t, i, g); if (f) all.push({ t, pk: p, f }); });
    const it = { kind: 'vconj', type, key, v, grp, tense, pk, pi, g, answer, all };
    if (type === 'pickForm') {
      const others = [...new Set(all.map((x) => x.f))].filter((f) => f !== answer);
      const same = shuffle(others.filter((f) => all.some((x) => x.f === f && x.t === tense)));
      const rest = shuffle(others.filter((f) => !same.includes(f)));
      it.options = shuffle([answer, ...[...same.slice(0, 2), ...rest].slice(0, 3)]);
    }
    if (type === 'pickPerson') it.valid = tense === 'imp' ? new Set([pk]) : new Set(all.filter((x) => x.f === answer).map((x) => x.pk));
    return it;
  }
  function aspectItem(key) {
    const v = vByW(key.slice(3)); if (!v || !v.pr) return null;
    const flip = Math.random() < 0.5;   // ask for the perfective (robiť → ?) or the imperfective (urobiť → ?)
    const q = flip ? v.pr : vname(v), answer = flip ? v.w : v.pr;
    const pool = APAIRS.filter((x) => x.w !== v.w).map((x) => (flip ? x.w : x.pr));
    return { kind: 'aspect', key, v, q, answer, toPf: !flip, options: shuffle([answer, ...shuffle([...new Set(pool)]).slice(0, 3)]) };
  }
  const vtypeForBox = (box) => (box == null || box <= 1 ? pick(['pickForm', 'pickForm', 'pickPerson'])
    : box <= 3 ? pick(['pickForm', 'type', 'type']) : 'type');
  function vcolorItem() { const s = pick(D.vsents || []); return s ? { kind: 'vcolor', key: null, sent: s } : null; }

  // placement tiers for the verb side
  const VTIERS = [
    { units: ['vu1', 'vu2'], keys: ['vb:am|pres_p1s', 'vb:am|pres_p3p', 'vb:im|pres_p1s', 'vb:im|pres_p2s', 'vb:im|pres_p3p', 'vb:am|pres_p1p'] },
    { units: ['vu3', 'vu4', 'vu5'], keys: ['vb:em|pres_p1s', 'vb:em|pres_p3p', 'vb:ujem|pres_p1s', 'vb:ujem|pres_p2p', 'vb:irr|pres_p1s', 'vb:irr|pres_p3p'] },
    { units: ['vu6'], keys: ['vb:am|past_p1s', 'vb:im|past_p2s', 'vb:em|past_p3s', 'vb:im|past_p1p', 'vb:irr|past_p1s', 'vb:ujem|past_p3p'] },
    { units: ['vu7', 'vu8'], keys: ['vb:im|fut_p1s', 'vb:am|fut_p3p', 'vb:em|fut_p2s', 'vb:irr|fut_p1p', ...APAIRS.slice(0, 4).map((x) => `va|${x.w}`)] },
    { units: ['vu9'], keys: ['vb:im|imp_p2s', 'vb:am|imp_p2p', 'vb:em|imp_p1p', 'vb:ujem|imp_p2s'] },
  ];

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

  // ---------- personal pronouns ----------
  // forms: Wiktionary (kaikki dump). Labels: L = long/stressed (also the only form), S = short (unstressed: never first,
  // never after a preposition), N = after a preposition (on/ona/ono/oni/ony only).
  const PRONS = [
    { k: 'ja', en: 'I, me', c: { nom: [['ja', 'L']], gen: [['mňa', 'L'], ['ma', 'S']], dat: [['mne', 'L'], ['mi', 'S']], acc: [['mňa', 'L'], ['ma', 'S']], loc: [['mne', 'L']], ins: [['mnou', 'L']] } },
    { k: 'ty', en: 'you (one person, informal)', c: { nom: [['ty', 'L']], gen: [['teba', 'L'], ['ťa', 'S']], dat: [['tebe', 'L'], ['ti', 'S']], acc: [['teba', 'L'], ['ťa', 'S']], loc: [['tebe', 'L']], ins: [['tebou', 'L']] } },
    { k: 'on', en: 'he; it (masculine)', c: { nom: [['on', 'L']], gen: [['jeho', 'L'], ['ho', 'S'], ['neho', 'N']], dat: [['jemu', 'L'], ['mu', 'S'], ['nemu', 'N']], acc: [['jeho', 'L'], ['ho', 'S'], ['neho', 'N']], loc: [['ňom', 'L']], ins: [['ním', 'L']] } },
    { k: 'ona', en: 'she; it (feminine)', c: { nom: [['ona', 'L']], gen: [['jej', 'L'], ['nej', 'N']], dat: [['jej', 'L'], ['nej', 'N']], acc: [['ju', 'L'], ['ňu', 'N']], loc: [['nej', 'L']], ins: [['ňou', 'L']] } },
    { k: 'ono', en: 'it (neuter)', c: { nom: [['ono', 'L']], gen: [['jeho', 'L'], ['ho', 'S'], ['neho', 'N']], dat: [['jemu', 'L'], ['mu', 'S'], ['nemu', 'N']], acc: [['ho', 'S'], ['neho', 'N']], loc: [['ňom', 'L']], ins: [['ním', 'L']] } },
    { k: 'my', en: 'we, us', c: { nom: [['my', 'L']], gen: [['nás', 'L']], dat: [['nám', 'L']], acc: [['nás', 'L']], loc: [['nás', 'L']], ins: [['nami', 'L']] } },
    { k: 'vy', en: 'you (plural, or polite)', c: { nom: [['vy', 'L']], gen: [['vás', 'L']], dat: [['vám', 'L']], acc: [['vás', 'L']], loc: [['vás', 'L']], ins: [['vami', 'L']] } },
    { k: 'oni', en: 'they (with a man in the group)', c: { nom: [['oni', 'L']], gen: [['ich', 'L'], ['nich', 'N']], dat: [['im', 'L'], ['nim', 'N']], acc: [['ich', 'L'], ['nich', 'N']], loc: [['nich', 'L']], ins: [['nimi', 'L']] } },
    { k: 'ony', en: 'they (women, things, animals)', c: { nom: [['ony', 'L']], gen: [['ich', 'L'], ['nich', 'N']], dat: [['im', 'L'], ['nim', 'N']], acc: [['ich', 'L'], ['ne', 'N']], loc: [['nich', 'L']], ins: [['nimi', 'L']] } },
  ];
  const PRON = Object.fromEntries(PRONS.map((p) => [p.k, p]));

  // ---------- numbers + case ----------
  // 1 agrees (jeden muž, jedna žena, jedno mesto); 2–4 + nominative plural; 5+ + genitive plural.
  // Male persons: dvaja, traja, štyria (+ nom. pl.); from 5: päť mužov or piati muži.
  const NUMS = [
    { n: 1, m: 'jeden', f: 'jedna', nt: 'jedno', mp: 'jeden' },
    { n: 2, m: 'dva', f: 'dve', nt: 'dve', mp: 'dvaja' },
    { n: 3, m: 'tri', f: 'tri', nt: 'tri', mp: 'traja' },
    { n: 4, m: 'štyri', f: 'štyri', nt: 'štyri', mp: 'štyria' },
    { n: 5, m: 'päť', mp: 'piati' }, { n: 6, m: 'šesť', mp: 'šiesti' }, { n: 7, m: 'sedem', mp: 'siedmi' },
    { n: 8, m: 'osem', mp: 'ôsmi' }, { n: 9, m: 'deväť', mp: 'deviati' }, { n: 10, m: 'desať', mp: 'desiati' },
  ];
  // all correct phrases for number n + noun (first = the one we show); noun: { gen, s:[6], p:[6] }
  function numPhrases(n, noun) {
    const N = NUMS.find((x) => x.n === n), g = noun.gen, pers = g === 'm-pers';
    if (n === 1) return [{ num: g === 'f' ? N.f : g === 'n' ? N.nt : N.m, w: noun.s[0], ck: 'nom', nb: 's' }];
    if (n <= 4) return [{ num: pers ? N.mp : g === 'f' || g === 'n' ? N.f : N.m, w: noun.p[0], ck: 'nom', nb: 'p' }];
    const out = [{ num: N.m, w: noun.p[1], ck: 'gen', nb: 'p' }];
    if (pers) out.push({ num: N.mp, w: noun.p[0], ck: 'nom', nb: 'p' });
    return out;
  }

  // ---------- real example sentences with English (Tatoeba, CC BY 2.0 FR) ----------
  // ex entries: [slovak, english, form as written, tatoeba id]
  const exList = (w) => D.ex?.[w] || window.PADY_LOOKUP?.ex?.[w] || [];
  function example(w, form) {
    const list = exList(w);
    if (!form) return list[0] || null;
    const f = form.toLowerCase();
    return list.find((x) => x[2].toLowerCase() === f) || null;
  }
  // the cases a form could be in this word's table (only colour it when there is exactly one)
  function caseOfForm(word, form) {
    const f = form.toLowerCase(), set = new Set();
    if (word?.s) CASES.forEach((c, i) => { if (word.s[i] === f || word.p[i] === f || word.alt?.[`${c.k}_s`]?.includes(f) || word.alt?.[`${c.k}_p`]?.includes(f)) set.add(c.k); });
    else if (word?.f) for (const [slot, v] of Object.entries(word.f)) if (v === f) set.add(slot.split('_')[1]);
    return set.size === 1 ? [...set][0] : '';
  }
  function exHtml(ex, word, { say = true } = {}) {
    if (!ex) return '';
    const [sk, en, form, id] = ex;
    const ck = word ? caseOfForm(word, form) : '';
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const re = new RegExp(`(^|[^\\p{L}])(${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}])`, 'u');
    const skH = esc(sk).replace(re, (m, a, b) => `${a}<mark class="${ck ? `c-${ck}` : 'plain'}"${ck ? ` data-en="${P.attr(P.caseTip(CASES[CI[ck]]))}"` : ''}>${b}</mark>`);
    const sayB = say && canSpeak() ? `<button class="say" data-say="${P.attr(sk)}" aria-label="Vypočuť" data-en="listen">🔊</button>` : '';
    return `<div class="tex"><div class="tex-sk">${skH} ${sayB}</div><div class="tex-en">${esc(en)} <a class="tex-src" href="https://tatoeba.org/sentences/show/${id}" target="_blank" rel="noopener" data-en="real sentence from Tatoeba (CC BY 2.0 FR)">Tatoeba</a></div></div>`;
  }

  window.PADYEngine = {
    review, seed, boxOf, masteryOf, dueKeys, today, UNITS, TIERS, VERBS, TOP_VERBS, MODELS,
    unitMastery, unitDone, currentUnit, buildDose, buildUnitSession, itemForKey, tierItems, applyPlacement,
    explain, cellNeeds, frame, addMyWord, removeMyWord, myWords, hasMyWord, speak, canSpeak, parseKey, CI,
    example, exList, exHtml, PRONS, PRON, NUMS, numPhrases,
    setUnitDone(id) { store().units[id] = true; P.persist(); },
    // verbs
    VUNITS, VTIERS, VGROUPS, VPOOL, CONJ, APAIRS, TENSE_SK, TENSE_CLS, PK, unitsFor, vform, vname, vgroup, vByW, isVerbKey, vcolorItem,
  };
})();
