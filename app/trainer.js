/* PÁDY — Začni tu (placement), Cesta (path + mastery map + my words), Dnešná dávka and the session runner */
(() => {
  'use strict';
  const P = window.PADY, E = window.PADYEngine, D = window.PADY_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { CASES, attr } = P;
  const CI = E.CI;
  const LETTER_CK = { N: 'nom', G: 'gen', D: 'dat', A: 'acc', L: 'loc', I: 'ins' };
  const CK_LETTER = Object.fromEntries(Object.entries(LETTER_CK).map(([l, k]) => [k, l]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const bare = (s) => norm(s).normalize('NFD').replace(/\p{M}/gu, '');
  const DIA = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ĺ', 'ľ', 'ň', 'ó', 'ô', 'ŕ', 'š', 'ť', 'ú', 'ý', 'ž'];
  const caseChip = (ck, num) => `<span class="lg c-${ck}" data-en="${attr(P.caseTip(CASES[CI[ck]]))}">${CASES[CI[ck]].name}${num ? ` ${num === 's' ? 'sg' : 'pl'}` : ''}</span>`;
  const sayBtn = (text) => (E.canSpeak() ? `<button class="say" data-say="${attr(text)}" aria-label="Vypočuť" data-en="listen">🔊</button>` : '');
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-say]'); if (b) { e.preventDefault(); E.speak(b.dataset.say); } });

  // ====================================================================
  // HOME cards
  // ====================================================================
  const sideNow = () => (P.save().side === 'verbs' ? 'verbs' : 'nouns');
  const tiersNow = () => (sideNow() === 'verbs' ? E.VTIERS : E.TIERS);
  function renderHome() {
    const kk = $('#kkGrid'); if (kk) kk.innerHTML = window.PADYPron?.gridHtml() || '';
    const el = $('#journey'); if (!el) return;
    const s = P.save();
    const side = sideNow(), verbs = side === 'verbs';
    const started = Object.keys(s.srs || {}).some((k) => verbs === E.isVerbKey(k));
    const fresh = !(verbs ? s.vplacement : s.placement) && !started;
    if (fresh) {
      el.innerHTML = `<article class="mode big start-card">
        <div><div class="mode-tag" data-en="<b>začni tu</b> = start here">Začni tu</div>
        <h2 data-en="Let's work out what you know">${verbs ? 'Čo už vieš o slovesách?' : 'Čo už vieš?'}</h2>
        <p>Answer a few quick examples (about 3 minutes). PÁDY works out your level ${verbs ? 'with verbs ' : ''}and starts your path in the right place.</p></div>
        <button class="btn go" data-go="start" data-en="Start the quick check">Poďme na to →</button>
      </article>`;
      return;
    }
    const due = E.dueKeys().filter((k) => verbs === E.isVerbKey(k)).length;
    const u = E.currentUnit(side);
    const m = Math.round(E.unitMastery(u) * 100);
    const n = E.unitsFor(side).indexOf(u) + 1;
    el.innerHTML = `<article class="mode dose-card">
        <div class="mode-tag" data-en="<b>dnešná dávka</b> = today's dose: a 5-minute mixed review chosen for you">Dnešná dávka</div>
        <h2 data-en="today's dose">Dnes</h2>
        <p><b>${due}</b> ${due === 1 ? 'vec čaká' : 'vecí čaká'} na zopakovanie + nové z tvojej cesty. ~5 min.</p>
        <button class="btn go" id="startDose" data-en="Start today's mixed session">Dnešná dávka →</button>
      </article>
      <article class="mode path-card">
        <div class="mode-tag" data-en="<b>tvoja cesta</b> = your path">Tvoja cesta</div>
        <h2><span class="unit-no">${n}</span> ${esc(u.sk)}</h2>
        <p>${esc(u.en)}</p>
        <div class="mbar"><span style="width:${m}%"></span></div>
        <button class="btn go blue" data-go="path" data-en="Open your path and mastery map">Cesta →</button>
      </article>`;
    $('#startDose').onclick = () => startDose();
  }

  // ====================================================================
  // RUNNER (screen #train)
  // ====================================================================
  let T = null;
  function runSession(opts) {
    T = { i: 0, right: 0, wrong: 0, log: [], answered: false, ...opts };
    P.show('train');
  }
  function startDose() {
    const items = E.buildDose(12, sideNow());
    // pronoun × case cells you keep missing in Kto komu? come back here too
    for (const it of window.PADYPron?.forDose(2) || []) items.splice(1 + Math.floor(Math.random() * items.length), 0, it);
    runSession({ title: 'Dnešná dávka', titleEn: "Today's dose", items, mode: 'dose' });
  }
  function startUnit(u, step) {
    const names = { practice: ['Precvič', 'Practise'], write: ['Napíš', 'Write'], test: ['Test', 'Test: 80% to complete the unit'] };
    const no = E.unitsFor(u.side || 'nouns').indexOf(u) + 1;
    runSession({ title: `${no}. ${names[step][0]}`, titleEn: names[step][1], items: E.buildUnitSession(u, step), mode: 'unit', unit: u, step });
  }
  function startColor() {
    const verbs = sideNow() === 'verbs';
    const src = verbs ? D.vsents : D.sents;
    const items = []; for (let i = 0; i < 6; i++) items.push({ kind: verbs ? 'vcolor' : 'color', key: null, sent: src[Math.floor(Math.random() * src.length)] });
    runSession({ title: 'Vyfarbi vetu', titleEn: verbs ? 'Colour the sentence: who is doing it?' : 'Colour the sentence', items, mode: 'color' });
  }
  // Páry: aspect pairs (robiť ↔ urobiť)
  function startPairs() {
    // the 20 most common pairs only (dávať/dať, robiť/urobiť, kupovať/kúpiť…)
    const keys = E.APAIRS.slice(0, 20).map((v) => `va|${v.w}`);
    const items = [];
    for (const k of keys.sort(() => Math.random() - 0.5)) { if (items.length >= 10) break; const it = E.itemForKey(k); if (it) items.push(it); }
    runSession({ title: 'Páry', titleEn: 'Aspect pairs: ongoing ↔ completed', items, mode: 'color', again: startPairs });
  }

  // Pasca: the traps Slovak writers really fall into (s/z, v/vo, -í/-é), in real treebank sentences
  const TRAP_CATS = {
    sz: { sk: 's alebo z?', en: 's/so + instrumental (with) or z/zo + genitive (from, out of)? The case of the noun decides.' },
    voc: { sk: 'v alebo vo?', en: 'Short or long preposition (v/vo, z/zo, s/so, k/ku)? Listen to the next word.' },
    vir: { sk: '-í alebo -é?', en: 'Male persons (-í/-i: dobrí, ktorí, tí) or everything else (-é/-e: dobré, ktoré, tie)?' },
  };
  function trapStats() { const s = P.save(); s.traps = s.traps || {}; for (const c in TRAP_CATS) s.traps[c] = s.traps[c] || { r: 0, w: 0 }; return s.traps; }
  function startTraps(only) {
    const all = D.traps || []; if (!all.length) return;
    const st = trapStats();
    const cats = only ? [only] : Object.keys(TRAP_CATS);
    // weaker categories come up more often
    const weight = (c) => (st[c].w + 1) / (st[c].r + st[c].w + 2) + 0.25;
    const items = [], used = new Set();
    while (items.length < 10) {
      let r = Math.random() * cats.reduce((a, c) => a + weight(c), 0), cat = cats[0];
      for (const c of cats) { r -= weight(c); if (r <= 0) { cat = c; break; } }
      const pool = all.filter((x) => x.c === cat);
      const tr = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(tr) && used.size < all.length) continue;
      used.add(tr);
      items.push({ kind: 'trap', key: null, tr, options: Math.random() < 0.5 ? [tr.a, tr.x] : [tr.x, tr.a] });
    }
    runSession({ title: 'Pasca', titleEn: only ? TRAP_CATS[only].en : 'Traps: the spots where even Slovaks slip', items, mode: 'trap', again: () => startTraps(only) });
  }
  function trapSentence(tr, done) {
    return tr.t.map(([form, ns], i) => {
      const sp = ns ? '' : ' ';
      if (i === tr.i) return (done ? `<span class="mfilled tans">${esc(tr.a)}</span>` : '<span class="mblank">?</span>') + sp;
      if (i === tr.h) {
        const ck = tr.c === 'sz' ? tr.k : '';
        return `<span class="tclue${done && ck ? ` c-${ck} on` : done ? ' on' : ''}">${esc(form)}</span>${sp}`;
      }
      return esc(form) + sp;
    }).join('');
  }

  // ---------- Zámená: put the pronoun into the right form, in a real sentence ----------
  const cap = (s, like) => (/^\p{Lu}/u.test(like) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pronOptions(ps) {
    const P0 = E.PRON[ps.p], a = ps.a.toLowerCase(), here = P0.c[ps.k];
    // ono shares on's forms; grammars differ on neuter "jeho", so never count on's same-case forms as wrong
    const sameCase = new Set([...here, ...(ps.p === 'ono' ? E.PRON.on.c[ps.k] : [])].map(([f]) => f));
    const third = here.some(([, v]) => v === 'N');
    const traps = [];
    // the n-form rule is the one hard either/or inside one case: after a preposition only the n-form, otherwise never
    if (third) {
      const ansVar = here.find(([f]) => f === a)?.[1];
      if (ps.pr && ansVar === 'N') traps.push(here.find(([, v]) => v === 'L')?.[0]);
      if (!ps.pr && ansVar !== 'N') traps.push(here.find(([, v]) => v === 'N')?.[0]);
    }
    const others = shuffle(Object.entries(P0.c).filter(([ck]) => ck !== ps.k && ck !== 'nom')
      .flatMap(([, fs]) => fs.map(([f]) => f)).filter((f) => !sameCase.has(f)));
    const opts = [a];
    for (const f of [...traps, ...others]) { if (f && !opts.includes(f) && opts.length < 4) opts.push(f); }
    return shuffle(opts).map((f) => cap(f, ps.a));
  }
  function startPron(only) {
    const all = (D.prons || []).filter((x) => !only || x.p === only); if (!all.length) return;
    const items = shuffle([...all]).slice(0, 10).map((ps) => ({ kind: 'pron', key: null, ps, options: pronOptions(ps) }));
    runSession({ title: 'Zámená', titleEn: 'Pronouns: mňa, mne, ho, jemu, nemu, ňom…', items, mode: 'trap', again: () => startPron(only) });
  }
  // ---------- Kto komu? pronoun × case, with an English cue (app/pron.js) ----------
  const PR = () => window.PADYPron;
  function startKtoKomu(only) {
    const items = PR().build(10, only);
    runSession({ title: 'Kto komu?', titleEn: 'Pronouns × cases: mu or ho? jej or ju? k nemu or k jemu?', items, mode: 'trap', again: () => startKtoKomu(only), back: only ? 'learn' : 'home' });
  }
  const PWHO = { ja: 'I', ty: 'you', on: 'he', ona: 'she', my: 'we', vy: 'you (pl.)', oni: 'they' };
  // every person + case a form can be (ju = ona · akuzatív; jej = ona · genitív / datív)
  function whatIs(form) {
    const out = [];
    for (const p of PR().PERS) for (const c of CASES) if (E.PRON[p].c[c.k].some(([f]) => f === form)) out.push([p, c.k]);
    return out;
  }
  // one person's forms across the cases, the asked one outlined: untangles jej / ju / nej / ňou
  function personRow(p, ck) {
    return `<div class="prow"><b class="prow-p">${p}</b>${CASES.map((c) => `<span class="prow-c c-${c.k}${c.k === ck ? ' on' : ''}" data-en="${attr(P.caseTip(c))}"><small>${c.abbr}</small>${E.PRON[p].c[c.k].map(([f]) => esc(f)).join(' · ')}</span>`).join('')}</div>`;
  }
  const blankHtml = (pre) => `${esc(pre)}<span class="mblank">?</span>`;

  // ---------- Čísla: number + noun ----------
  function startNums() {
    const nouns = D.nouns.slice(0, 250).filter((n) => n.s?.[0] && n.p?.[0] && n.p?.[1]);
    const items = [];
    const pickN = () => { const r = Math.random(); return r < 0.15 ? 1 : r < 0.55 ? 2 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 6); };
    let guard = 0;
    while (items.length < 10 && guard++ < 200) {
      const noun = nouns[Math.floor(Math.random() * nouns.length)], n = pickN();
      // male persons every so often: that's where dvaja / piati live
      if (noun.gen !== 'm-pers' && Math.random() < 0.25) continue;
      const ok = E.numPhrases(n, noun), show = ok[Math.floor(Math.random() * ok.length)];
      const okSet = new Set(ok.map((x) => `${x.num} ${x.w}`));
      const N = E.NUMS.find((x) => x.n === n);
      const nums = [...new Set([N.m, N.f, N.nt, N.mp].filter(Boolean))];
      const ws = [...new Set([noun.s[0], noun.p[0], noun.p[1]])];
      const right = `${show.num} ${show.w}`;
      // wrong ones: change one part (the number word or the noun form), never another correct phrase
      const cands = shuffle([...nums.map((x) => `${x} ${show.w}`), ...ws.map((w) => `${show.num} ${w}`), ...nums.flatMap((x) => ws.map((w) => `${x} ${w}`))])
        .filter((c) => !okSet.has(c));
      const options = [right];
      for (const c of cands) { if (!options.includes(c) && options.length < 4) options.push(c); }
      if (options.length < 3) continue;
      items.push({ kind: 'num', key: null, n, noun, ok, show, answer: right, okSet, options: shuffle(options) });
    }
    runSession({ title: 'Čísla', titleEn: 'Numbers: dve ženy, päť žien, dvaja muži', items, mode: 'trap', again: startNums });
  }

  function renderTrain() {
    if (!T) { P.show('home'); return; }
    $('#trTitle').textContent = T.title;
    $('#trTitle').dataset.en = T.titleEn || '';
    if (T.i >= T.items.length) return T.mode === 'place' ? placementNext() : endSession();
    const it = T.items[T.i];
    T.answered = false; T.cur = it;
    $('#trBar').style.width = `${(T.i / Math.max(T.items.length, 1)) * 100}%`;
    $('#trCount').textContent = `${T.i + 1}/${T.items.length}`;
    $('#trFeed').className = 'trfeed'; $('#trFeed').innerHTML = '';
    $('#trEnd').hidden = true; $('#trMain').hidden = false;
    const card = $('#trCard');
    card.innerHTML = renderItem(it);
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    const inp = $('#trInput'); if (inp) setTimeout(() => inp.focus(), 50);
    if (it.kind === 'color' || it.kind === 'vcolor') colorSelect(firstOpenTarget());
  }

  // the word you're working with always shows its meaning inline (hover is for interface labels only)
  // gender belongs to the word (žena is always žen.), number to the form, so the number sits on the case chip
  const genChip = (n) => (n.gen && P.GENDER_LABEL[n.gen] ? ` <span class="chip ghost" data-en="${attr(P.GENDER_EN[n.gen] || '')}">${P.GENDER_LABEL[n.gen]}</span>` : '');
  const lemmaChip = (n, num) => `<span class="chip ghost">${esc(n.w)}${num ? ` · ${num === 's' ? 'sg' : 'pl'}` : ''}</span>${genChip(n)}${n.g ? ` <span class="gl">${esc(n.g)}</span>` : ''}`;
  // meaning of any noun/adjective lemma we have data for
  const GLOSS = new Map();
  for (const n of [...D.nouns, ...D.adjs]) if (n.g && !GLOSS.has(n.w)) GLOSS.set(n.w, n.g);
  for (const m of D.models) if (!GLOSS.has(m.w)) GLOSS.set(m.w, P.PATTERN_EN[m.w]?.[0] || '');
  const glossOf = (w) => GLOSS.get(w) || D.glosses?.[w] || '';
  const optionButtons = (opts) => `<div class="tropts">${opts.map((o, i) => `<button class="tropt" data-ans="${attr(o)}"><span class="mk">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
  const caseButtons = (only) => `<div class="trcases">${CASES.filter((c) => !only || only.includes(c.k)).map((c, i) => `<button class="trcase c-${c.k}" data-ck="${c.k}"><span class="mk">${i + 1}</span><b>${c.name}</b><small>${c.q}</small></button>`).join('')}</div>`;
  const typeBox = () => `<div class="trtype"><input id="trInput" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="napíš tvar…">
    <button class="btn small go" id="trCheck" data-en="check (Enter)">OK</button></div>
    <div class="keys trdia">${DIA.map((ch, i) => `<button type="button" tabindex="-1" data-ch="${ch}">${ch}<small class="kk">${P.diaKey(i)}</small></button>`).join('')}</div>`;
  const blankFrame = (fr, extra = '') => `<div class="trframe" data-en="${attr(fr.en)}">${esc(fr.sk).replace('___', `<span class="mblank">?</span>`)}</div>${extra}`;

  // ---------- verb helpers ----------
  const PRON = (pi, g) => ['ja', 'ty', g === 'f' ? 'ona' : 'on', 'my', 'vy', 'oni'][pi];
  const personChip = (pk) => { const p = P.PERSONS.find((x) => x.k === pk); return `<span class="lg vp" data-en="${attr(`<b>${p.sk}</b> = ${p.en}`)}">${p.icon} ${p.sk}</span>`; };
  const tenseChip = (t) => `<span class="lg ${E.TENSE_CLS[t]}" data-en="${attr(E.TENSE_SK[t][1])}">${E.TENSE_SK[t][0]}</span>`;
  const personButtons = () => `<div class="trcases">${P.PERSONS.map((p, i) => `<button class="trcase vp" data-ck="${p.k}"><span class="mk">${i + 1}</span><b>${p.icon} ${p.sk}</b><small>${p.en.split(' (')[0]}</small></button>`).join('')}</div>`;
  const verbHead = (v) => `<div class="trbig">${esc(E.vname(v))}</div>`;
  const verbSub = (v, extra = '') => `<div class="trsub"><span class="gl">${esc(v.g)}</span> <span class="chip ghost" data-en="${attr(P.ASPECT[v.a]?.[1] || '')}">${P.ASPECT[v.a]?.[0] || ''}</span>${extra}</div>`;
  const stripPron = (s) => norm(s).replace(/^(ja|ty|on|ona|ono|my|vy|oni|ony)\s+/, '');

  function renderItem(it) {
    const tag = (sk, en) => `<div class="trtask" data-en="${attr(en)}">${sk}</div>`;
    if (it.kind === 'vconj') {
      const v = it.v;
      const gChip = it.tense === 'past' && it.pi < 3 ? ` <span class="chip ghost" data-en="${attr(it.g === 'f' ? 'feminine subject' : 'masculine subject')}">${it.g === 'f' ? 'žen.' : 'muž.'}</span>` : '';
      if (it.type === 'pickPerson') {
        return tag('Kto to robí?', 'Who is doing it? (any person this form fits counts)') +
          `<div class="trbig">${esc(it.answer)}</div>` + verbSub(v, ` · ${esc(E.vname(v))} ${tenseChip(it.tense)}`) + personButtons();
      }
      const frame = it.tense === 'imp' ? `(${PRON(it.pi, it.g)}) <span class="mblank">?</span>!` : `${PRON(it.pi, it.g)} <span class="mblank">?</span>`;
      return tag(it.type === 'type' ? 'Napíš správny tvar' : 'Vyber správny tvar', it.type === 'type' ? 'Type the right form (the pronoun is optional)' : 'Pick the right form') +
        verbHead(v) + verbSub(v, ` ${tenseChip(it.tense)}${gChip}`) + `<div class="trframe">${frame}</div>` +
        (it.type === 'type' ? typeBox() : optionButtons(it.options));
    }
    if (it.kind === 'pron') {
      const ps = it.ps, P0 = E.PRON[ps.p];
      const sent = ps.t.map(([f, ns], i) => (i === ps.i ? '<span class="mblank">?</span>' : esc(f)) + (ns ? '' : ' ')).join('');
      return tag('Daj zámeno do správneho tvaru', 'Put the pronoun into the right form') +
        `<div class="trsent">${sent}</div><div class="trsub"><span class="chip ghost">${esc(P0.k)}</span> <span class="gl">${esc(P0.en)}</span></div>` + optionButtons(it.options);
    }
    if (it.kind === 'pc' || it.kind === 'pct') {
      const f = it.f;
      return tag(it.kind === 'pct' ? 'Napíš zámeno' : 'Doplň zámeno', 'Put in the pronoun the English asks for. The verb or the preposition decides the case.') +
        `<div class="pk-en">${PR().enOf(it.p, f)}</div><div class="trsent">${esc(f.sk).replace('___', blankHtml(f.pr ? `${f.pr} ` : ''))}</div>` +
        (it.kind === 'pct' ? typeBox() : optionButtons(it.options));
    }
    if (it.kind === 'prc') {
      const f = it.f;
      const sent = esc(PR().filled(f, it.form)).replace(new RegExp(`(^|\\s)(${it.form})(?=[\\s.,!?])`, 'u'), '$1<mark class="pmark">$2</mark>');
      const who = it.who
        ? `<div class="trsub">Kto: <span class="chip">${it.who} <span class="gl">${PWHO[it.who]}</span></span></div>
           <div class="trcases">${PR().PCASES.map((k, i) => { const c = CASES[CI[k]]; return `<button class="trcase c-${k}" data-ck="${k}"><span class="mk">${i + 1}</span><b>${c.name}</b><small>${c.q}</small></button>`; }).join('')}</div>`
        : `<div class="trcases pwho">${PR().PERS.map((p, i) => `<button class="trcase vp" data-who="${p}"><span class="mk">${i + 1}</span><b>${p}</b><small>${PWHO[p]}</small></button>`).join('')}</div>`;
      return tag(it.who ? 'Aký pád?' : 'Kto to je?', it.who ? 'Which case is it in, here?' : 'Who is the highlighted word? (then: which case)') +
        `<div class="trsent">${sent}</div>` + who;
    }
    if (it.kind === 'num') {
      return tag('Koľko?', 'How many? Pick the right number word and noun form') +
        `<div class="trbig">${it.n} × ${esc(it.noun.w)}</div><div class="trsub">${lemmaChip(it.noun)}</div>` + optionButtons(it.options);
    }
    if (it.kind === 'trap') {
      const cat = TRAP_CATS[it.tr.c];
      return tag(`Pasca · ${cat.sk}`, cat.en) + `<div class="trsent">${trapSentence(it.tr, false)}</div>` +
        `<p class="trhint" data-en="the underlined word is your clue">Pozri sa na podčiarknuté slovo.</p>` + optionButtons(it.options);
    }
    if (it.kind === 'aspect') {
      return tag(it.toPf ? 'Nájdi dokonavý pár' : 'Nájdi nedokonavý pár', it.toPf ? 'Find the perfective partner (one-off, completed)' : 'Find the imperfective partner (ongoing, repeated)') +
        `<div class="trbig">${esc(it.q)}</div><div class="trframe">↔ <span class="mblank">?</span></div>
         <div class="trsub"><span class="gl">${esc(it.v.g)}</span></div>` + optionButtons(it.options);
    }
    if (it.kind === 'vcolor') {
      it.marks = it.marks || {};
      const toks = it.sent.map((t, i) => {
        const [form, pk, kind, lemma, tense, ns] = t;
        const sp = ns ? '' : ' ';
        if (kind === 'v') return `<button class="ctok" data-i="${i}">${esc(form)}</button>${sp}`;
        if (kind === 'c') return `<b class="cprep" data-en="subject pronoun: a clue to the person">${esc(form)}</b>${sp}`;
        return `<span class="cword">${esc(form)}</span>${sp}`;
      }).join('');
      return tag('Kto to robí?', 'Who is doing it? Mark the person of every verb. Pronouns (pink) are clues; so are the endings.') +
        `<div class="csent">${toks}</div>` + personButtons();
    }
    if (it.kind === 'noun' || it.kind === 'adj') {
      if (it.kind === 'adj') {
        const head = `<div class="trbig">${esc(it.adj.w)}</div><div class="trsub">${caseChip(it.ck, it.num)} <span class="chip ghost">${esc(it.label.split(' · ')[1] || '')}</span> <span class="gl">${esc(it.adj.g || '')}</span></div>`;
        return tag('Aký je tvar?', 'Which form? (adjective, from your words)') + head + (it.type === 'type' ? typeBox() : optionButtons(it.options));
      }
      if (it.type === 'pickCase') {
        return tag('Ktorý pád to môže byť?', 'Which case could this form be? (any that fits counts)') +
          `<div class="trbig">${esc(it.answer)}</div><div class="trsub">${lemmaChip(it.noun)}</div>` + caseButtons();
      }
      const head = blankFrame(it.frame, `<div class="trsub">${lemmaChip(it.noun, it.num)} ${caseChip(it.ck, it.num)}</div>`);
      return tag(it.type === 'type' ? 'Napíš správny tvar' : 'Vyber správny tvar', it.type === 'type' ? 'Type the right form' : 'Pick the right form') +
        head + (it.type === 'type' ? typeBox() : optionButtons(it.options));
    }
    if (it.kind === 'verb') {
      const vx = it.vx;
      return tag('Ktorý pád?', 'Which case does this verb (+ preposition) take?') +
        `<div class="trbig" data-en="${attr(`<b>${vx.v.v}</b> = ${vx.v.g}`)}">${esc(vx.v.v)}</div>
        <div class="trframe">+ ${vx.p ? `<b class="mprep">${esc(vx.p)}</b> ` : ''}<span class="mblank">?</span></div>
        <div class="trsub"><span class="gl">${esc(vx.v.g)}</span></div>` + caseButtons(['gen', 'dat', 'acc', 'loc', 'ins']);
    }
    if (it.kind === 'vform') {
      const z = it.z;
      const re = new RegExp(`(?<![\\p{L}])${z.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u');
      return tag('Doplň vetu', 'Fill the real sentence') +
        `<div class="trsent">${esc(z.t).replace(re, '<span class="mblank wide">?</span>')}</div>
         <div class="trsub">${lemmaChip(it.noun, z.num)} <span class="sep">·</span> <span class="chip ghost">${esc(it.vx.v.v)}${it.vx.p ? ' ' + esc(it.vx.p) : ''} + ?</span> <span class="gl">${esc(it.vx.v.g)}</span></div>` + optionButtons(it.options);
    }
    if (it.kind === 'color') {
      it.marks = it.marks || {};
      const toks = it.sent.map((t, i) => {
        const [form, c, kind, lemma, num, ns] = t;
        const sp = ns ? '' : ' ';
        if (c) return `<button class="ctok" data-i="${i}" data-en="${attr(`<b>${lemma}</b>${num ? ` · ${num === 's' ? 'singular' : 'plural'}` : ''}${kind === 'a' ? ' (adjective)' : ' (noun)'}`)}">${esc(form)}</button>${sp}`;
        if (kind === 'p') return `<b class="cprep" data-en="preposition: a clue to the case">${esc(form)}</b>${sp}`;
        return `<span class="cword">${esc(form)}</span>${sp}`;
      }).join('');
      return tag('Vyfarbi vetu', 'Colour the sentence: give every noun and adjective its case colour. Prepositions (pink) are clues.') +
        `<div class="csent">${toks}</div>` + caseButtons();
    }
    return '';
  }

  // ---------- answering ----------
  function judge(it, ans) {
    if (it.kind === 'noun') {
      if (it.type === 'pickCase') return { good: it.valid.has(ans) };
      const a = norm(ans);
      if ([...it.ok].map(norm).includes(a)) return { good: true };
      if (it.type === 'type' && [...it.ok].map(bare).includes(bare(a))) return { good: true, almost: true };
      return { good: false };
    }
    if (it.kind === 'adj') {
      const a = norm(ans);
      if (a === it.answer) return { good: true };
      if (it.type === 'type' && bare(a) === bare(it.answer)) return { good: true, almost: true };
      return { good: false };
    }
    if (it.kind === 'vconj') {
      if (it.type === 'pickPerson') return { good: it.valid.has(ans) };
      const a = stripPron(ans);
      if (a === it.answer) return { good: true };
      if (it.type === 'type' && bare(a) === bare(it.answer)) return { good: true, almost: true };
      return { good: false };
    }
    if (it.kind === 'aspect') return { good: ans === it.answer };
    if (it.kind === 'trap') return { good: ans === it.tr.a };
    if (it.kind === 'pron') return { good: ans.toLowerCase() === it.ps.a.toLowerCase() };
    if (it.kind === 'num') return { good: it.okSet.has(ans) };
    if (it.kind === 'verb') return { good: it.vx.cases.map((l) => LETTER_CK[l]).includes(ans) };
    if (it.kind === 'vform') return { good: ans === it.z.f };
    if (it.kind === 'pc') return { good: it.ok.includes(ans) };
    if (it.kind === 'pct') {
      // "k nemu" / "ku mne" typed with the preposition is fine too
      let a = norm(ans); const pr = it.f.pr;
      if (pr) for (const x of [PR().prepFor(pr, a.split(' ').pop()), pr]) if (a.startsWith(`${x} `)) { a = a.slice(x.length + 1); break; }
      if (it.ok.includes(a)) return { good: true };
      if (it.ok.map(bare).includes(bare(a))) return { good: true, almost: true };
      return { good: false };
    }
    if (it.kind === 'prc') return { good: it.whoOk.has(it.who) && ans === it.f.ck };
    return { good: false };
  }

  function answer(ans, btn) {
    const it = T.cur; if (!it || T.answered || it.kind === 'color' || it.kind === 'vcolor') return;
    if ((it.type === 'type' || it.kind === 'pct') && !norm(ans)) return;
    T.answered = true;
    const { good, almost } = judge(it, ans);
    record(it, good);
    // mark buttons
    if (btn) {
      $$('#trCard .tropt, #trCard .trcase').forEach((b) => {
        const v = b.dataset.ans ?? b.dataset.ck;
        const isRight = it.kind === 'prc' ? v === it.f.ck : judge(it, v).good;
        b.classList.add(isRight ? 'right' : b === btn ? 'wrong' : 'dim');
      });
    } else {
      const inp = $('#trInput'); inp.readOnly = true;
      inp.classList.add(good ? (almost ? 'almost' : 'right') : 'wrong');
      if (!good || almost) inp.value = it.answer;
    }
    feedback(it, good, almost, ans);
  }

  function record(it, good) {
    if (good) T.right++; else T.wrong++;
    T.log.push({ key: it.key, good, tier: it.tier });
    if (it.kind === 'trap') { const st = trapStats()[it.tr.c]; good ? st.r++ : st.w++; P.persist(); }
    if (it.cell) PR().record(it.cell, good);
    if (T.mode !== 'place' && it.key) E.review(it.key, good);
    const sfx = P.sfx; good ? sfx.good(T.right) : sfx.bad();
  }

  function feedback(it, good, almost, ans) {
    const fb = $('#trFeed');
    if (T.mode === 'place') {   // placement: no teaching, just keep moving
      fb.className = `trfeed show ${good ? 'ok' : 'no'}`;
      fb.innerHTML = `<b class="mres">${good ? 'Áno' : 'Nie'}</b>`;
      setTimeout(next, 650);
      return;
    }
    let body = '';
    let say = '';
    if (it.kind === 'vconj') {
      const v = it.v;
      say = it.tense === 'imp' ? it.answer : `${PRON(it.pi, it.g)} ${it.answer}`;
      const rule = it.tense === 'past' ? P.PAST_RULE[it.pi] : it.tense === 'imp' ? '' : P.PRES_RULE[it.pi];
      if (it.type === 'pickPerson') {
        body = `<b>${esc(it.answer)}</b> = ${[...it.valid].map(personChip).join(' ')} ${tenseChip(it.tense)}`;
      } else if (good && !almost) {
        body = `${esc(PRON(it.pi, it.g))} <b>${esc(it.answer)}</b> ${tenseChip(it.tense)}`;
      } else {
        // what did they give? another person / tense of the same verb?
        const a = stripPron(ans);
        const other = it.all.filter((x) => x.f === a);
        const was = other.length ? `<b>${esc(a)}</b> is ${other.map((x) => `${personChip(x.pk)} ${tenseChip(x.t)}`).join(' / ')}. ` : '';
        body = `${almost ? 'Check the accents: ' : was}${esc(PRON(it.pi, it.g))} → <b>${esc(it.answer)}</b>.${rule ? ` <span class="why-rule">Remember: ${rule}.</span>` : ''}`;
      }
    } else if (it.kind === 'pron') {
      const ps = it.ps, P0 = E.PRON[ps.p], a = ps.a.toLowerCase();
      const v = P0.c[ps.k].find(([f]) => f === a)?.[1];
      const siblings = P0.c[ps.k].map(([f]) => f).filter((f) => f !== a);
      say = ps.t.map(([f, ns]) => f + (ns ? '' : ' ')).join('').trim();
      const blank = $('#trCard .mblank'); if (blank) blank.outerHTML = `<span class="mfilled c-${ps.k}">${esc(ps.a)}</span>`;
      const why = ps.pr ? ` (after <b>${esc(ps.pr)}</b>)` : '';
      let note = '';
      if (v === 'N') note = 'After a preposition, on / ona / ono / oni use the <b>n-form</b>: k nemu, pre neho, s ňou, na nich.';
      else if (v === 'S') {
        const longs = siblings.filter((f) => !/^[nň]/.test(f));
        note = `<b>${esc(a)}</b> is the short, unstressed form: never first in the sentence, never after a preposition.${longs.length ? ` The long one (${longs.map(esc).join(', ')}) is for emphasis.` : ''}`;
      }
      else if (siblings.length && !ps.pr) note = `Also: ${siblings.map(esc).join(', ')} (${siblings.some((f) => /^[nň]/.test(f)) ? 'the n-form only after a preposition' : 'short form, unstressed'}).`;
      body = `${esc(P0.k)} → ${caseChip(ps.k)} <b>${esc(ps.a)}</b>${why}. ${note ? `<span class="why-rule">${note}</span>` : ''}`;
    } else if (it.kind === 'pc' || it.kind === 'pct' || it.kind === 'prc') {
      const f = it.f, ck = f.ck, p = it.p;
      // the form to show: yours if it was right (jemu as well as mu), otherwise the usual one
      const typed = it.kind === 'pct' ? norm(ans).split(' ').pop() : ans;
      const form = it.kind !== 'prc' && good && it.ok.includes(typed) ? typed : it.answer;
      const full = PR().filled(f, form);
      say = full;
      $('#trCard .trsent').innerHTML = esc(f.sk).replace('___', `${f.pr ? `${esc(PR().prepFor(f.pr, form))} ` : ''}<span class="mfilled c-${ck}">${esc(form)}</span>`);
      const notes = [];
      const fs = E.PRON[p].c[ck];
      const hasN = fs.some(([, v]) => v === 'N'), hasS = fs.some(([, v]) => v === 'S');
      if (f.pr) {
        if (hasN) notes.push(`After a preposition, on / ona / oni take the <b>n-form</b>: ${esc(f.pr)} <b>${esc(it.ok[0])}</b>, not ${esc(f.pr)} ${esc(fs.find(([, v]) => v !== 'N')[0])}.`);
        else if (hasS) notes.push(`After a preposition only the long form: <b>${esc(PR().prepFor(f.pr, it.ok[0]))} ${esc(it.ok[0])}</b>, never ${esc(f.pr)} ${esc(fs.find(([, v]) => v === 'S')[0])}.`);
        if (PR().prepFor(f.pr, form) !== f.pr) notes.push(`<b>${esc(f.pr)}</b> becomes <b>${esc(PR().prepFor(f.pr, form))}</b> before mne / mnou / mňa.`);
        notes.push(`<b>${esc(f.pr)}</b> + ${CASES[CI[ck]].name.toLowerCase()}.`);
      } else {
        if (hasS) notes.push(`Both work here: <b>${esc(fs.find(([, v]) => v === 'S')[0])}</b> is the normal, unstressed form; <b>${esc(fs.find(([, v]) => v === 'L')?.[0] || '')}</b> stresses it (this person, not someone else) or starts the sentence.`);
        if (hasN) notes.push(`<b>${esc(fs.find(([, v]) => v === 'N')[0])}</b> is only for after a preposition.`);
      }
      // what was the wrong answer, then?
      let was = '';
      if (!good && it.kind === 'pc') {
        const w = whatIs(ans);
        if (w.length) was = `<b>${esc(ans)}</b> = ${w.map(([q, k]) => `${q} · ${caseChip(k)}`).join(' / ')}. `;
      }
      if (!good && it.kind === 'prc') {
        if (!it.whoOk.has(it.who)) was = `<b>${esc(it.form)}</b> is not ${esc(it.who)}: it's ${[...it.whoOk].join(' / ')}. `;
        else was = `Right person, but here <b>${esc(it.form)}</b> is ${caseChip(ck)}. `;
      }
      body = `${was}<b>${esc(p)}</b> → ${caseChip(ck)} <b>${esc(form)}</b>${notes.length ? ` <span class="why-rule">${notes.join(' ')}</span>` : ''}
        ${it.kind === 'prc' ? `<div class="pk-en">${PR().enOf(p, f)}</div>` : ''}${personRow(p, ck)}`;
    } else if (it.kind === 'num') {
      say = it.answer;
      const n = it.n;
      const ph = it.ok.map((x) => `${esc(x.num)} <span class="mfilled c-${x.ck}">${esc(x.w)}</span>`).join(' <span class="or">alebo</span> ');
      const rule = n === 1 ? '1 agrees like an adjective (<i>jeden muž, jedna žena, jedno mesto</i>) + nominative singular.'
        : n <= 4 ? '2, 3, 4 + <b>nominative plural</b>: <i>dva stoly, dve ženy, dve mestá</i>; male persons: <i>dvaja, traja, štyria muži</i>.'
          : '5 and up + <b>genitive plural</b>: <i>päť žien, päť stolov</i>. Male persons: <i>päť mužov</i> or <i>piati muži</i>.';
      body = `${ph} ${caseChip(it.ok[0].ck, it.ok[0].nb)} <span class="why-rule">${rule}</span>`;
    } else if (it.kind === 'trap') {
      const tr = it.tr, a = tr.a.toLowerCase(), clue = tr.h >= 0 ? tr.t[tr.h][0] : '';
      say = tr.t.map(([f, ns]) => f + (ns ? '' : ' ')).join('').trim();
      $('#trCard .trsent').innerHTML = trapSentence(tr, true);
      if (tr.c === 'sz') {
        body = a.startsWith('s')
          ? `<b>${esc(tr.a)}</b> + ${caseChip('ins')} = <i>with</i>: <b>${esc(clue)}</b> is instrumental. <span class="why-rule">z/zo + genitív = from, out of, off (z mesta, zo stola).</span>`
          : `<b>${esc(tr.a)}</b> + ${caseChip('gen')} = <i>from, out of, off</i>: <b>${esc(clue)}</b> is genitive. <span class="why-rule">s/so + inštrumentál = with (s mamou, so sestrou).</span>`;
      } else if (tr.c === 'voc') {
        const long = ['vo', 'zo', 'so', 'ku'].includes(a);
        body = long
          ? `<b>${esc(tr.a)}</b> ${esc(clue)}: the next word starts with a clashing sound, so the preposition gets a vowel. <span class="why-rule">vo + v/f (vo vode) · zo, so + s/z/š/ž (zo školy, so ženou) · ku + k/g (ku koncu) · vo mne, zo mňa, so mnou, ku mne.</span>`
          : `<b>${esc(tr.a)}</b> ${esc(clue)}: no clash, so the short form. <span class="why-rule">Long forms only before the same kind of sound: vo vode, zo školy, so ženou, ku koncu.</span>`;
      } else {
        body = tr.k === 'v'
          ? `<b>${esc(tr.a)}</b>: <b>${esc(clue)}</b> are male persons → the "men" form. <span class="why-rule">Only men (or mixed groups) take it: dobrí, ktorí, tí, moji, dvaja, traja, štyria. Everything else: dobré, ktoré, tie, moje, dve, tri, štyri.</span>`
          : `<b>${esc(tr.a)}</b>: <b>${esc(clue)}</b> are not male persons → the "everything else" form. <span class="why-rule">The -í form is only for men: dobrí muži, ktorí, tí, dvaja, štyria. Women, things, animals: dobré ženy, ktoré, tie, dve, štyri.</span>`;
      }
    } else if (it.kind === 'aspect') {
      const pfW = it.toPf ? it.answer : it.q, ipfW = it.toPf ? it.q : it.answer;
      body = `<b>${esc(ipfW)}</b> ↔ <b>${esc(pfW)}</b> <span class="why-rule">${esc(ipfW)} = ongoing / repeated (I was doing, I do); ${esc(pfW)} = one-off, completed (I did it; its present means the future).</span>`;
      say = `${ipfW}, ${pfW}`;
    } else if (it.kind === 'noun') {
      say = it.answer;
      if (it.type === 'pickCase') {
        // every cell this form fills, with its number (ženy = Genitív sg · Nominatív pl · Akuzatív pl)
        const cells = CASES.flatMap((c, i) => ['s', 'p'].filter((num) => it.noun[num][i] === it.answer).map((num) => caseChip(c.k, num)));
        body = `<b>${esc(it.answer)}</b> = ${cells.join(' <span class="or">·</span> ')}`;
        if (!good) body += ` <span class="why-not">(${esc(CASES[CI[ans]]?.name || '')} nie)</span>`;
      } else {
        body = good && !almost
          ? `${esc(it.frame.sk).replace('___', `<b>${esc(it.answer)}</b>`)}`
          : E.explain({ noun: it.noun, ck: it.ck, num: it.num, answer: ans }) || `<b>${esc(it.answer)}</b>`;
      }
    } else if (it.kind === 'adj') {
      say = it.answer;
      body = `${esc(it.adj.w)} → ${caseChip(it.ck, it.num)} <b>${esc(it.answer)}</b>`;
    } else if (it.kind === 'verb') {
      const vx = it.vx;
      body = `${esc(vx.v.v)} ${vx.p ? `<b>${esc(vx.p)}</b> ` : ''}+ ${vx.cases.map((l) => caseChip(LETTER_CK[l])).join(' <span class="or">alebo</span> ')}`;
      const ex = vx.ex[0];
      if (ex) { body += `<p class="mex">„${esc(ex)}“</p>`; say = ex; }
    } else if (it.kind === 'vform') {
      body = `${esc(it.vx.v.v)} ${it.vx.p ? `<b>${esc(it.vx.p)}</b> ` : ''}+ ${caseChip(LETTER_CK[it.z.c])} → <b>${esc(it.z.f)}</b>`;
      say = it.z.t;
      const blank = $('#trCard .mblank'); if (blank) blank.outerHTML = `<span class="mfilled c-${LETTER_CK[it.z.c]}">${esc(it.z.f)}</span>`;
    }
    // the same form in a real sentence, with English (only when Tatoeba has this exact form)
    const exW = it.kind === 'noun' ? it.noun : it.kind === 'adj' ? it.adj : null;
    const exLemma = it.kind === 'vconj' ? it.v?.w : exW?.w;
    const ex = exLemma && it.answer ? E.example(exLemma, String(it.answer).split(/[ ,/]/).pop()) : null;
    if (ex) say = ex[0];   // 🔊 reads the whole sentence
    // a real treebank sentence on screen: its English, now that you've answered
    const trSk = it.kind === 'pron' || it.kind === 'trap' ? say : it.kind === 'verb' ? it.vx.ex[0] : it.kind === 'vform' ? it.z.t : '';
    fb.className = `trfeed show ${good ? (almost ? 'almost' : 'ok') : 'no'}`;
    fb.innerHTML = `<div class="mrule"><span class="mres">${good ? (almost ? 'Takmer!' : 'Správne!') : 'Ups!'}</span> ${body}</div>
      ${trSk ? E.trHtml(trSk) : ''}
      ${ex ? E.exHtml(ex, exW, { say: false }) : ''}
      <div class="trfeed-actions">${say ? sayBtn(say) : ''}<button class="btn small go" id="trNext" data-en="next (Enter)">Ďalej →</button></div>`;
    // no auto-skip: there's always something to read here, so you move on when you're ready (Enter / Ďalej)
    clearTimeout(T.auto);
    setTimeout(() => $('#trNext')?.focus({ preventScroll: true }), 30);
  }

  function next() {
    if (!T || !$('#train').classList.contains('active')) return;
    clearTimeout(T.auto);
    T.i++;
    renderTrain();
  }

  // ---------- colour the sentence ----------
  function targets() { return T.cur.sent.map((t, i) => (t[1] ? i : -1)).filter((i) => i >= 0); }
  function firstOpenTarget() { return targets().find((i) => !(i in T.cur.marks)); }
  function colorSelect(i) {
    $$('#trCard .ctok').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i));
    T.cur.sel = i;
  }
  // nouns: the answer is a case; verbs ("vcolor"): the answer is a person
  const rightOf = (it, j) => (it.kind === 'vcolor' ? it.sent[j][1] : LETTER_CK[it.sent[j][1]]);
  const personAbbr = (pk) => P.PERSONS.find((p) => p.k === pk)?.abbr || pk;
  function colorAnswer(ck) {
    const it = T.cur; if (!it || (it.kind !== 'color' && it.kind !== 'vcolor') || T.answered) return;
    const i = it.sel ?? firstOpenTarget(); if (i == null) return;
    const right = rightOf(it, i);
    const good = ck === right;
    it.marks[i] = ck;
    const b = $(`#trCard .ctok[data-i="${i}"]`);
    b.classList.remove('sel');
    if (it.kind === 'vcolor') {
      b.classList.add('vp', good ? 'cok' : 'cbad', 'vmark'); b.dataset.who = personAbbr(right);
      if (!good) b.dataset.was = personAbbr(ck);
    } else {
      b.classList.add(`c-${good ? ck : right}`, good ? 'cok' : 'cbad');
      if (!good) b.dataset.was = CASES[CI[ck]].abbr;
    }
    if (good) { T.right++; P.sfx.good(T.right); } else { T.wrong++; P.sfx.bad(); }
    const nxt = firstOpenTarget();
    if (nxt != null) { colorSelect(nxt); return; }
    // done: summary
    T.answered = true;
    if (it.kind === 'vcolor') return vcolorSummary(it);
    const bad = targets().filter((j) => it.marks[j] !== LETTER_CK[it.sent[j][1]]);
    const text = it.sent.map((t) => t[0] + (t[5] ? '' : ' ')).join('').trim();
    $('#trFeed').className = `trfeed show ${bad.length ? 'no' : 'ok'}`;
    // every coloured word with its base form and meaning: the vocabulary is half the point of a real sentence
    const rows = targets().map((j) => {
      const [form, c, kind, lemma, num] = it.sent[j];
      const ok = it.marks[j] === LETTER_CK[c];
      const g = glossOf(lemma);
      return `<li class="${ok ? 'ok' : 'no'}"><b>${esc(form)}</b> <span class="lem">← ${esc(lemma)}</span>${g ? ` <span class="gl">${esc(g)}</span>` : ''}
        <span class="pos">${kind === 'a' ? 'príd.' : 'podst.'}</span> ${caseChip(LETTER_CK[c], num)}${ok ? '' : ' <span class="xmark">✗</span>'}</li>`;
    }).join('');
    $('#trFeed').innerHTML = `<div class="mrule"><span class="mres">${bad.length ? 'Skoro!' : 'Výborne!'}</span>
      ${bad.length ? `${bad.length} of ${targets().length} in the wrong colour.` : 'Every word in the right colour.'}
      ${E.trHtml(text)}<ul class="cwords">${rows}</ul></div>
      <div class="trfeed-actions">${sayBtn(text)}<button class="btn small go" id="trNext">Ďalej →</button></div>`;
  }

  function vcolorSummary(it) {
    const bad = targets().filter((j) => it.marks[j] !== it.sent[j][1]);
    const text = it.sent.map((t) => t[0] + (t[5] ? '' : ' ')).join('').trim();
    const rows = targets().map((j) => {
      const [form, pk, , lemma, tense] = it.sent[j];
      const ok = it.marks[j] === pk;
      const g = D.vglosses?.[lemma] || E.vByW(lemma)?.g || '';
      return `<li class="${ok ? 'ok' : 'no'}"><b>${esc(form)}</b> <span class="lem">← ${esc(lemma)}</span>${g ? ` <span class="gl">${esc(g)}</span>` : ''}
        ${personChip(pk)} ${tenseChip(tense === 'fut' ? 'fut' : 'pres')}${ok ? '' : ' <span class="xmark">✗</span>'}</li>`;
    }).join('');
    $('#trFeed').className = `trfeed show ${bad.length ? 'no' : 'ok'}`;
    $('#trFeed').innerHTML = `<div class="mrule"><span class="mres">${bad.length ? 'Skoro!' : 'Výborne!'}</span>
      ${bad.length ? `${bad.length} of ${targets().length} with the wrong person.` : 'Every verb with the right person.'}
      ${E.trHtml(text)}<ul class="cwords">${rows}</ul></div>
      <div class="trfeed-actions">${sayBtn(text)}<button class="btn small go" id="trNext">Ďalej →</button></div>`;
  }

  // ---------- events ----------
  $('#trCard').addEventListener('click', (e) => {
    const o = e.target.closest('.tropt'); if (o) return answer(o.dataset.ans, o);
    const wb = e.target.closest('[data-who]');
    if (wb && T.cur?.kind === 'prc' && !T.answered) { T.cur.who = wb.dataset.who; $('#trCard').innerHTML = renderItem(T.cur); return; }
    const c = e.target.closest('.trcase');
    if (c) { if (T.cur.kind === 'color' || T.cur.kind === 'vcolor') return colorAnswer(c.dataset.ck); return answer(c.dataset.ck, c); }
    const t = e.target.closest('.ctok'); if (t && !(+t.dataset.i in T.cur.marks)) return colorSelect(+t.dataset.i);
    if (e.target.closest('#trCheck')) answer($('#trInput').value, null);
  });
  $('#trCard').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.trdia button'); if (!b) return;
    e.preventDefault();
    const i = $('#trInput'); if (!i || i.readOnly) return;
    i.focus(); i.setRangeText(b.dataset.ch, i.selectionStart ?? i.value.length, i.selectionEnd ?? i.value.length, 'end');
  });
  $('#trFeed').addEventListener('click', (e) => { if (e.target.closest('#trNext')) next(); });
  document.addEventListener('keydown', (e) => {
    if (!T || !$('#train').classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey) return;
    const inInput = e.target.id === 'trInput';
    if (e.key === 'Enter') {
      e.preventDefault();
      if (T.answered) return next();
      if (inInput) return answer($('#trInput').value, null);
      return;
    }
    if (inInput || T.answered) return;
    const n = parseInt(e.key, 10);
    if (T.cur?.kind === 'color') { if (n >= 1 && n <= 6) colorAnswer(CASES[n - 1].k); return; }
    if (T.cur?.kind === 'vcolor') { if (n >= 1 && n <= 6) colorAnswer(P.PERSONS[n - 1].k); return; }
    const btns = $$('#trCard .tropt, #trCard .trcase');
    if (n >= 1 && n <= btns.length) btns[n - 1].click();
  });
  $('#trQuit').addEventListener('click', () => { const back = T?.mode === 'place' ? 'home' : T?.back || 'home'; T = null; P.show(back); });

  // ---------- end of session ----------
  function endSession() {
    const total = T.right + T.wrong;
    const acc = total ? T.right / total : 0;
    let xp = Math.max(5, T.right * 3);
    let headline = acc >= 0.9 ? 'Výborne!' : acc >= 0.7 ? 'Dobre!' : 'Ide to!';
    let note = '';
    let passed = false;
    if (T.mode === 'unit' && T.step === 'test') {
      passed = acc >= 0.8;
      if (passed) { E.setUnitDone(T.unit.id); xp += 30; headline = 'Lekcia hotová!'; note = `Unit ${E.unitsFor(T.unit.side || 'nouns').indexOf(T.unit) + 1} complete. The next one is open on your path.`; }
      else note = `${Math.round(acc * 100)}%: you need 80% to complete the unit. Practise a bit more and try again.`;
    }
    if (T.mode === 'dose') {
      const s = P.save(); s.doseDay = E.today(); P.persist();
      note = `${E.dueKeys().length} still due today. Come back tomorrow for the next dose.`;
    }
    const lv = P.award(xp);
    $('#trMain').hidden = true;
    const end = $('#trEnd'); end.hidden = false;
    end.innerHTML = `<div class="results-card">
      <h2>${headline}</h2>
      <div class="res-grid three">
        <div><span>Správne</span><b>${T.right}/${total}</b></div>
        <div><span>Presnosť</span><b>${Math.round(acc * 100)}%</b></div>
        <div><span>XP</span><b>+${xp}</b></div>
      </div>
      ${lv ? `<p class="xp-gain">Level ${lv}! 🎉</p>` : ''}
      <p class="res-note">${note}</p>
      <div class="res-actions">
        ${T.mode === 'unit' ? '<button class="btn go blue" data-go="path">Cesta →</button>' : ''}
        ${T.mode === 'color' || T.mode === 'trap' ? '<button class="btn go" id="trAgain">Ešte raz</button>' : ''}
        <button class="btn ghost" data-go="home">Domov</button>
      </div></div>`;
    $('#trAgain')?.addEventListener('click', T.again || startColor);
    $('#trBar').style.width = '100%';
    const [x, y] = P.centerOf(end.querySelector('h2'));
    if (passed || acc >= 0.9) setTimeout(() => { P.confetti(x, y, 60); P.sfx.done(); }, 200);
  }

  // ====================================================================
  // ZAČNI TU (placement)
  // ====================================================================
  let PL = null;
  function renderStart() {
    PL = null;
    $('#startBody').innerHTML = `
      <div class="start-intro">
        <h2 data-en="How much Slovak have you learned so far?">Koľko slovenčiny už vieš?</h2>
        <p>Be honest, it's only to pick where to begin. Then a few quick examples (no time limit, no explanations), and PÁDY places you on your path.</p>
        <div class="fopts">
          <button class="fopt" data-lvl="0"><b>Úplný začiatok</b><small>I'm brand new to Slovak cases</small></button>
          <button class="fopt" data-lvl="1"><b>Trochu</b><small>I know some basics</small></button>
          <button class="fopt" data-lvl="2"><b>Dosť veľa</b><small>I've studied a fair bit</small></button>
        </div>
      </div>`;
  }
  $('#startBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lvl]');
    if (b) {
      if (b.dataset.lvl === '0') { showPlacementResult(E.applyPlacement([], sideNow()), true); return; }
      PL = { tier: 0, results: [] };
      runPlacementTier();
      return;
    }
    if (e.target.closest('#plTest')) { PL = { tier: 0, results: [] }; runPlacementTier(); }
    if (e.target.closest('#plGo')) P.show('path');
  });
  function runPlacementTier() {
    const items = E.tierItems(tiersNow()[PL.tier], 4).map((it) => ({ ...it, tier: PL.tier }));
    if (!T || T.mode !== 'place') runSession({ title: 'Začni tu', titleEn: 'Start here: quick level check', items, mode: 'place', back: 'home' });
    else { T.items.push(...items); renderTrain(); }
  }
  function placementNext() {
    // end of a tier: evaluate
    const tierLog = T.log.filter((l) => l.tier === PL.tier);
    const right = tierLog.filter((l) => l.good).length;
    PL.results.push({ tier: PL.tier, right, total: tierLog.length, items: tierLog });
    const pass = right / tierLog.length >= 0.75;
    if (pass && PL.tier < tiersNow().length - 1) { PL.tier++; runPlacementTier(); return; }
    const passed = E.applyPlacement(PL.results, sideNow());
    P.award(10 + T.right * 2);
    T = null;
    PL.finished = true;
    P.show('start');
    showPlacementResult(passed, false);
  }
  const VLEVELS = [
    ['Začiatočník', 'Beginner: we start with the -ám verbs (volám, voláš…).'],
    ['Základy máš', 'You have the basics: the present tense of -ám and -ím verbs.'],
    ['Mierne pokročilý', 'Every present-tense group, irregular verbs too.'],
    ['Pokročilý', 'The past tense is there as well.'],
    ['Výborne!', 'Future and aspect too. Only commands (the imperative) left.'],
    ['Majster slovies', 'Master of verbs. The daily dose will keep it sharp.'],
  ];
  const LEVELS = [
    ['Začiatočník', 'Beginner: we start from the very first case.'],
    ['Základy máš', 'You have the basics: nominative, accusative and locative singular.'],
    ['Mierne pokročilý', 'Lower intermediate: all singular cases are there.'],
    ['Pokročilý', 'Intermediate: the plural is mostly there too.'],
    ['Výborne!', 'Advanced: even the genitive plural. Time for the verbs.'],
    ['Majster pádov', 'Master of cases. The daily dose will keep it sharp.'],
  ];
  function showPlacementResult(passed, skipped) {
    const u = E.currentUnit(sideNow());
    const LV = sideNow() === 'verbs' ? VLEVELS : LEVELS;
    const [lvl, lvlEn] = LV[Math.min(passed, LV.length - 1)];
    $('#startBody').innerHTML = `
      <div class="start-result">
        <div class="mode-tag" data-en="your level">Tvoja úroveň</div>
        <h2 data-en="${attr(lvlEn)}">${lvl}</h2>
        <p>${lvlEn}</p>
        ${skipped ? '' : `<div class="tierbars">${tiersNow().map((t, i) => {
          const r = PL?.results.find((x) => x.tier === i);
          return `<div class="tierbar ${r ? (r.right / r.total >= 0.75 ? 'pass' : 'fail') : 'na'}" data-en="${attr(r ? `${r.right}/${r.total} right` : 'not tested')}"><span>${i + 1}</span></div>`;
        }).join('')}</div>`}
        <div class="start-next">
          <span data-en="your path starts here">Tvoja cesta začína tu:</span>
          <b><span class="unit-no">${E.unitsFor(sideNow()).indexOf(u) + 1}</span> ${esc(u.sk)}</b>
          <small>${esc(u.en)}</small>
        </div>
        ${sideNow() === 'verbs' ? vmapHtml(true) : mapHtml(true)}
        <div class="res-actions">
          <button class="btn go" id="plGo" data-en="Let's go!">Poďme! →</button>
          ${skipped ? '<button class="btn ghost" id="plTest" data-en="Test me anyway">Aj tak ma otestuj</button>' : ''}
        </div>
      </div>`;
    P.renderTop();
  }

  // ====================================================================
  // CESTA (path) + mastery map + my words
  // ====================================================================
  const MAP_PATS = P.PATTERNS;
  function boxClass(key) {
    const b = E.boxOf(key);
    return b == null ? 'm-none' : b <= 1 ? 'm-low' : b <= 3 ? 'm-mid' : 'm-high';
  }
  function mapHtml(compact) {
    const head = `<div></div>${['s', 'p'].map((num) => CASES.map((c) => `<div class="mh c-${c.k}" data-en="${attr(`${c.en} ${num === 's' ? 'singular' : 'plural'}`)}">${c.abbr}</div>`).join('')).join('')}`;
    const rows = MAP_PATS.map((p) => `<button class="mp" data-open="${p}" data-en="${attr(P.patternTip(p))}">${p}</button>` +
      ['s', 'p'].map((num) => CASES.map((c) => { const key = `${p}|${c.k}_${num}`; return `<div class="mc ${boxClass(key)}" title="${p} · ${c.name} ${num === 's' ? 'sg' : 'pl'}"></div>`; }).join('')).join('')).join('');
    return `<div class="mmap${compact ? ' compact' : ''}">
      <div class="mmap-grid">${head}${rows}</div>
      <div class="mmap-legend"><span class="mc m-none"></span> nové <span class="mc m-low"></span> slabé <span class="mc m-mid"></span> učím sa <span class="mc m-high"></span> viem</div>
      <div class="mmap-sub"><span>singulár</span><span>plurál</span></div>
    </div>`;
  }

  // verbs: one small grid per tense, groups × persons
  function vmapHtml(compact) {
    const blocks = ['pres', 'past', 'fut', 'imp'].map((t) => {
      const pks = t === 'imp' ? ['p2s', 'p1p', 'p2p'] : E.PK;
      const head = `<div></div>${pks.map((pk) => `<div class="mh vp" data-en="${attr(P.PERSONS.find((p) => p.k === pk).en)}">${P.PERSONS.find((p) => p.k === pk).abbr}</div>`).join('')}`;
      const rows = E.VGROUPS.map((g) => `<div class="mp" data-en="${attr(g.en)}">${g.sk}</div>` +
        pks.map((pk) => { const key = `vb:${g.k}|${t}_${pk}`; return `<div class="mc ${boxClass(key)}" title="${g.sk} · ${E.TENSE_SK[t][0]} · ${pk}"></div>`; }).join('')).join('');
      return `<div class="vmap-block"><div class="vmap-title ${E.TENSE_CLS[t]}">${E.TENSE_SK[t][0]}</div>
        <div class="mmap-grid vgrid" style="grid-template-columns: 92px repeat(${pks.length}, minmax(14px, 1fr))">${head}${rows}</div></div>`;
    }).join('');
    const asp = E.APAIRS.slice(0, 20).map((v) => `<div class="mc ${boxClass(`va|${v.w}`)}" title="${v.w} ↔ ${v.pr}"></div>`).join('');
    return `<div class="mmap vmap${compact ? ' compact' : ''}">${blocks}
      <div class="vmap-block"><div class="vmap-title vp" data-en="aspect pairs: robiť ↔ urobiť">Vid (páry)</div><div class="vmap-pairs">${asp}</div></div>
      <div class="mmap-legend"><span class="mc m-none"></span> nové <span class="mc m-low"></span> slabé <span class="mc m-mid"></span> učím sa <span class="mc m-high"></span> viem</div></div>`;
  }

  let openUnit = null;
  function renderPath() {
    const verbs = sideNow() === 'verbs';
    const cur = E.currentUnit(sideNow());
    if (openUnit == null || (openUnit && !E.unitsFor(sideNow()).some((u) => u.id === openUnit))) openUnit = cur.id;
    const due = E.dueKeys().filter((k) => verbs === E.isVerbKey(k)).length;
    $('#path .learn-head h1').textContent = verbs ? 'Tvoja cesta: slovesá' : 'Tvoja cesta';
    const units = E.unitsFor(sideNow()).map((u, i) => {
      const done = E.unitDone(u), isCur = u === cur, open = u.id === openUnit;
      const m = Math.round(E.unitMastery(u) * 100);
      return `<li class="unit ${done ? 'done' : ''} ${isCur ? 'cur' : ''} ${open ? 'open' : ''}" data-unit="${u.id}">
        <button class="unit-head" data-toggle="${u.id}">
          <span class="unit-no">${done ? '✓' : i + 1}</span>
          <span class="unit-title"><b>${esc(u.sk)}</b><small>${esc(u.en)}</small></span>
          <span class="unit-pct" data-en="mastery of this unit">${m}%</span>
        </button>
        ${open ? `<div class="unit-body">
          <div class="mbar"><span style="width:${m}%"></span></div>
          <div class="steps">
            <button class="step" data-step="learn" data-en="Read it first in the crib sheet">📖 <b>Nauč sa</b><small>Learn</small></button>
            <button class="step" data-step="practice" data-en="Recognise: pick forms and cases">🎯 <b>Precvič</b><small>Practise</small></button>
            <button class="step" data-step="write" data-en="Produce: type the forms yourself">✍️ <b>Napíš</b><small>Write</small></button>
            <button class="step test" data-step="test" data-en="Score 80% to complete the unit">🏁 <b>Test</b><small>80% = hotovo</small></button>
          </div></div>` : ''}
      </li>`;
    }).join('');
    const mine = E.myWords();
    $('#pathBody').innerHTML = `
      <button class="dose-cta" id="pathDose" data-en="Today's dose: what's due + new from your current unit">
        <span>Dnešná dávka</span><b>${due} na zopakovanie · ~5 min</b><i>→</i></button>
      <ol class="units">${units}</ol>
      <h3 class="sec" data-en="<b>mapa</b> = map: every pattern × case × number. Colours fill in as you learn.">Mapa pokroku</h3>
      ${verbs ? vmapHtml(false) : mapHtml(false)}
      ${verbs ? '' : `<h3 class="sec" data-en="<b>moje slová</b> = my words: words you added from Hľadaj. They come up in your daily dose.">Moje slová</h3>
      <div class="mywords">${mine.length ? mine.map((w) => `<span class="myw"><b>${esc(w.w)}</b> <small>${esc(w.g || '')}</small><button data-rm="${attr(w.id)}" aria-label="remove" data-en="remove">×</button></span>`).join('')
        : '<p class="weak-empty">Nothing yet. Look a word up in 🔍 Hľadaj and tap <b>＋ Moje slová</b>: it will come up in your daily dose.</p>'}</div>`}
      <p class="legend-note"><button class="link" data-go="start" data-en="Take the level check again">Znova otestovať úroveň</button></p>`;
  }
  $('#pathBody').addEventListener('click', (e) => {
    if (e.target.closest('#pathDose')) return startDose();
    const t = e.target.closest('[data-toggle]');
    if (t) { openUnit = openUnit === t.dataset.toggle ? '' : t.dataset.toggle; return renderPath(); }
    const st = e.target.closest('[data-step]');
    if (st) {
      const u = E.unitsFor(sideNow()).find((x) => x.id === st.closest('[data-unit]').dataset.unit);
      if (st.dataset.step === 'learn') {
        if (u.side === 'verbs') return window.PADYLearn.openVerb(u.learn || {});
        if (u.verbs) { window.PADYLearn.openTab('pady'); return; }
        if (u.learn?.col) return window.PADYLearn.openColumn(...u.learn.col);
        return window.PADYLearn.openPattern(u.learn?.pat || u.pats[0]);
      }
      return startUnit(u, st.dataset.step);
    }
    const o = e.target.closest('[data-open]'); if (o) return window.PADYLearn.openPattern(o.dataset.open);
    const rm = e.target.closest('[data-rm]'); if (rm) { E.removeMyWord(rm.dataset.rm); renderPath(); }
  });
  $('#startBody').addEventListener('click', (e) => { const o = e.target.closest('[data-open]'); if (o) window.PADYLearn.openPattern(o.dataset.open); });

  window.PADYTrainer = {
    renderHome,
    startColor,
    startPairs,
    startTraps,
    startPron, startKtoKomu,
    startNums,
    render(id) {
      if (id === 'train') renderTrain();
      if (id === 'path') renderPath();
      if (id === 'start') { if (PL?.finished) PL.finished = false; else renderStart(); }
    },
  };
  renderHome();
})();
