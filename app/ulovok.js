/* ÚLOVOK ("the catch"): sentence mining from subtitle packs.
   A pack (scripts/build_pack.ps1 -> *.ulovok.json) holds one episode's Slovak lines with their official English
   subtitle, every word tagged (lemma, case, person/tense, the preposition that governs it) and glossed.
   Subtitles are copyrighted: packs are never part of the site. You import the file on each device; it is kept in this
   browser's own storage (IndexedDB) and goes nowhere else.
   Flow: daily catch (sentences with exactly one word you don't know yet) -> "Beriem" makes a card ->
   cards come back on a schedule as read / fill-in / colour the cases / translate / listen. */
(() => {
  const P = window.PADY, E = window.PADYEngine, D = window.PADY_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CASES = P.CASES, CI = Object.fromEntries(CASES.map((c, i) => [c.k, i]));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const attr = (s) => P.attr(String(s ?? ''));
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  const low = (s) => s.toLowerCase();

  // ---------- storage ----------
  const DBN = 'pady-ulovok', ST = 'packs';
  const idb = () => new Promise((res, rej) => {
    if (!('indexedDB' in window)) { rej(new Error('no IndexedDB')); return; }
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const q = fn(db.transaction(ST, mode).objectStore(ST)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  const dbAll = () => tx('readonly', (s) => s.getAll());
  const dbPut = (p) => tx('readwrite', (s) => s.put(p));
  const dbDel = (id) => tx('readwrite', (s) => s.delete(id));

  const KEY = 'pady.ulovok';
  const DEF = { level: 0, words: {}, cards: {}, done: {}, snooze: {}, miss: {}, daily: null, colors: false };
  let S = load();
  function load() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }

  // ---------- packs in memory ----------
  let PACKS = [], SENTS = [], BYSID = new Map(), LEX = new Map(), FORMS = new Map(), LEMMA_SENTS = new Map(), loaded = false, loadErr = '';
  function index() {
    SENTS = []; BYSID = new Map(); LEX = new Map(); FORMS = new Map(); LEMMA_SENTS = new Map();
    for (const p of PACKS) {
      for (const [l, v] of Object.entries(p.lex)) if (!LEX.has(l)) LEX.set(l, { g: v[0], r: v[1], pos: v[2], ai: v[3] === 'ai', c: v[4] === 'c', f: v[5] ? v[5].split(' ') : [] });
      p.ctxAt = new Map(p.ctx.map((c, i) => [c[0], i]));
      for (const s of p.s) {
        const o = { sid: `${p.id}#${s.id}`, id: s.id, t: s.t, en: s.en, approx: (s.f || []).includes('approx'), pack: p };
        o.words = o.t.filter(isWord).length;
        SENTS.push(o); BYSID.set(o.sid, o);
        for (const t of o.t) {
          if (!isWord(t)) continue;
          if (!FORMS.has(t[1])) FORMS.set(t[1], new Set());
          FORMS.get(t[1]).add(low(t[0]));
          if (!LEMMA_SENTS.has(t[1])) LEMMA_SENTS.set(t[1], []);
          const L = LEMMA_SENTS.get(t[1]); if (L[L.length - 1] !== o) L.push(o);
        }
      }
    }
  }
  async function loadPacks() {
    try { PACKS = (await dbAll()).sort((a, b) => (a.title + a.ep).localeCompare(b.title + b.ep)); loadErr = ''; }
    catch (e) { PACKS = []; loadErr = 'This browser blocks local storage (private window?), so packs can\'t be kept here.'; }
    index(); loaded = true;
  }

  // ---------- what you know ----------
  // token: [form, lemma, upos, case, morph, preposition, noSpaceAfter]
  const isWord = (t) => t[2] !== 'PUNCT' && t[2] !== 'PROPN' && t[2] !== 'X' && t[2] !== 'SYM' && /\p{L}/u.test(t[0]);
  const FUNC = new Set(['ADP', 'CCONJ', 'SCONJ', 'PART', 'INTJ', 'PRON', 'DET', 'AUX', 'NUM']);
  const RARE = 10000;   // beyond this Araneum rank: recognise only (no fill-in drills)
  let LBOX = {};
  function cardBoxes() { LBOX = {}; for (const c of Object.values(S.cards)) for (const l of c.tg) LBOX[l] = Math.max(LBOX[l] ?? -1, c.box); }
  function known(lemma, upos) {
    const st = S.words[lemma];
    if (st === 'k') return true;
    if (LBOX[lemma] != null) return LBOX[lemma] >= 4;
    if (st === 'u') return false;
    if (FUNC.has(upos)) return true;
    const r = LEX.get(lemma)?.r || 0;
    return r > 0 && r <= S.level;
  }
  const unknownIn = (s) => [...new Set(s.t.filter((t) => isWord(t) && !known(t[1], t[2])).map((t) => t[1]))];
  const rankOf = (l) => LEX.get(l)?.r || 99999;
  const isRare = (l) => { const r = LEX.get(l)?.r || 0; return r === 0 || r > RARE; };

  const LEVELS = [
    { n: 500, sk: 'Začínam', en: 'Beginner: about 500 words (greetings, family, numbers, the most common verbs)' },
    { n: 1500, sk: 'Základy mám', en: 'I have the basics: about 1,500 words. Simple conversations.' },
    { n: 3000, sk: 'Pokročilý', en: 'Intermediate: about 3,000 words. I can follow a lot with effort.' },
    { n: 6000, sk: 'Skoro plynulo', en: 'Advanced: about 6,000 words. Mostly the odd word is missing.' },
  ];

  // ---------- labels ----------
  const POS_SK = {
    NOUN: ['podst. meno', 'noun'], ADJ: ['príd. meno', 'adjective'], VERB: ['sloveso', 'verb'], AUX: ['sloveso', 'verb (helper: byť)'],
    ADV: ['príslovka', 'adverb'], PRON: ['zámeno', 'pronoun'], DET: ['zámeno', 'pronoun/determiner (ten, môj, každý)'], NUM: ['číslovka', 'number'],
    ADP: ['predložka', 'preposition'], CCONJ: ['spojka', 'conjunction'], SCONJ: ['spojka', 'conjunction'], PART: ['častica', 'particle'], INTJ: ['citoslovce', 'interjection'],
  };
  const PERS = { '1s': 'ja', '2s': 'ty', '3s': 'on / ona / ono', '1p': 'my', '2p': 'vy', '3p': 'oni / ony' };
  const TENSE = { pres: ['prítomný čas', 'present tense'], past: ['minulý čas', 'past tense'], fut: ['budúci čas', 'future tense'], imp: ['rozkaz', 'imperative (command)'], cnd: ['podmienka', 'conditional (would)'], inf: ['neurčitok', 'infinitive (dictionary form)'] };
  const caseChip = (ck, num) => `<span class="lg c-${ck}" data-en="${attr(P.caseTip(CASES[CI[ck]]))}">${CASES[CI[ck]].name}${num ? ` · ${num === 's' ? 'jedn. č.' : 'mn. č.'}` : ''}</span>`;
  function morphChips(t) {
    const [, , upos, ck, m, pr] = t;
    const ms = (m || '').split(' ').filter(Boolean);
    const num = ms.includes('s') ? 's' : ms.includes('p') ? 'p' : '';
    const out = [];
    if (ck) out.push(caseChip(ck, num));
    if (pr && ck) out.push(`<span class="chip ghost" data-en="${attr(`the preposition <b>${pr}</b> decides the case here`)}">${esc(pr)} + ${CASES[CI[ck]].name.toLowerCase()}</span>`);
    if (upos === 'VERB' || upos === 'AUX') {
      const tense = ms.find((x) => TENSE[x]);
      const per = ms.find((x) => /^[123]$/.test(x));
      if (per && num) out.push(`<span class="lg vp" data-en="who does it">${PERS[per + num]}</span>`);
      else if (tense === 'past' && num) {
        const g = ms.find((x) => /^[mfn]/.test(x));
        out.push(`<span class="lg vp" data-en="past tense without som/si: on, ona, ono or oni">${num === 'p' ? 'oni / ony' : g?.[0] === 'f' ? 'ona' : g?.[0] === 'n' ? 'ono' : 'on'}</span>`);
      }
      if (tense) out.push(`<span class="lg ${E.TENSE_CLS[tense] || 'vp'}" data-en="${attr(TENSE[tense][1])}">${TENSE[tense][0]}</span>`);
      if (ms.includes('pf')) out.push(`<span class="chip ghost" data-en="perfective: one-off, completed">dokonavé</span>`);
      if (ms.includes('ipf')) out.push(`<span class="chip ghost" data-en="imperfective: ongoing, repeated">nedokonavé</span>`);
    }
    if (ms.includes('neg')) out.push(`<span class="chip ghost" data-en="negative (ne-)">zápor</span>`);
    return out.join(' ');
  }
  function freqChip(l) {
    const r = LEX.get(l)?.r || 0;
    const [sk, en, cls] = !r ? ['zriedkavé', 'rare: not among the 60,000 most common words', 'f4']
      : r <= 1000 ? ['veľmi bežné', 'very common: top 1,000', 'f1'] : r <= 3000 ? ['bežné', 'common: top 3,000', 'f2']
        : r <= RARE ? ['menej bežné', 'less common: top 10,000', 'f3'] : ['zriedkavé', 'rare: beyond the top 10,000 (recognise it, no need to drill it)', 'f4'];
    return `<span class="ufreq ${cls}" data-en="${attr(`${en}${r ? ` (#${r} in Slovak web text, Araneum)` : ''}`)}">${sk}${r ? ` #${r}` : ''}</span>`;
  }
  const aiMark = (l) => (LEX.get(l)?.ai ? ` <span class="uai" data-en="This meaning was written by Claude (AI), not taken from a dictionary. Usually right, but unchecked.">AI</span>` : '');
  const collMark = (l) => (LEX.get(l)?.c ? ` <span class="chip ghost ucoll" data-en="colloquial / slang: you'll hear it, but dictionaries don't list it">hovorové</span>` : '');

  // ---------- sentence rendering ----------
  // opts: colors (case colours), blankAt (token index shown as a gap), marks (token index -> class), tap (tokens are buttons)
  function sentHtml(s, o = {}) {
    let h = '';
    s.t.forEach((t, i) => {
      const sp = t[6] ? '' : ' ';
      if (i === o.blankAt) { h += `<span class="mblank">?</span>${sp}`; return; }
      if (!isWord(t)) { h += `${esc(t[0])}${sp}`; return; }
      const cls = ['uw'];
      if (o.colors && t[3] && ['NOUN', 'ADJ', 'DET', 'PRON', 'NUM'].includes(t[2])) cls.push('cc', `c-${t[3]}`);
      if (o.unk && !known(t[1], t[2])) cls.push('unk');
      if (o.marks?.[i]) cls.push(o.marks[i]);
      h += `<span class="${cls.join(' ')}" data-ti="${i}">${esc(t[0])}</span>${sp}`;
    });
    return h.trim();
  }
  const plainSk = (s) => s.t.map((t) => t[0] + (t[6] ? '' : ' ')).join('').trim();
  // English of the surrounding lines only once this sentence's English is on screen (so you can try first)
  function ctxHtml(s, showEn) {
    const p = s.pack, i = p.ctxAt.get(s.id); if (i == null) return '';
    const line = (c, cur) => `<div class="uctx-line${cur ? ' cur' : ''}"><span>${esc(c[1])}</span>${showEn ? `<small>${esc(c[2])}</small>` : ''}</div>`;
    const before = p.ctx.slice(Math.max(0, i - 2), i), after = p.ctx.slice(i + 1, i + 3);
    return `${before.map((c) => line(c)).join('')}${line(p.ctx[i], true)}${after.map((c) => line(c)).join('')}`;
  }
  const srcLine = (s) => `<div class="usrc">${esc(s.pack.title)}${s.pack.ep ? ` · ${esc(s.pack.ep)}` : ''}${s.approx ? ` · <span class="uapprox" data-en="The English subtitle here is a free translation: shortened or reworded, not word for word.">≈ voľný preklad</span>` : ''}</div>`;

  // word card under the sentence
  function wordHtml(s, ti) {
    const t = s.t[ti], l = t[1], lx = LEX.get(l) || {};
    const st = S.words[l], pos = POS_SK[t[2]];
    const say = E.canSpeak() ? `<button class="say" data-say="${attr(l)}" aria-label="Vypočuť" data-en="listen">🔊</button>` : '';
    const canForm = !!(t[3] || ((t[2] === 'VERB' || t[2] === 'AUX') && t[4]));
    return `<div class="uword">
      <button class="uw-x" data-uw="x" aria-label="Zavrieť" data-en="close (Esc)">×</button>
      <div class="uw-head"><b>${esc(t[0])}</b>${low(t[0]) !== l ? ` <span class="uw-arrow">→</span> <span class="uw-lemma">${esc(l)}</span>` : ''} ${say}
        ${pos ? `<span class="chip ghost" data-en="${attr(pos[1])}">${pos[0]}</span>` : ''} ${freqChip(l)}${collMark(l)}</div>
      <div class="uw-gloss">${esc(lx.g || '—')}${aiMark(l)}</div>
      <div class="uw-tags">${morphChips(t)}</div>
      <div class="uw-acts">
        <button class="btn small ${st === 'u' ? 'go' : 'ghost'}" data-uw="u" data-en="I don't know this word: it becomes the word to learn from this sentence">Neznám slovo</button>
        ${canForm ? `<button class="btn small ghost" data-uw="f" data-en="I know the word, but this form threw me: it's counted under its case">Neznám tvar</button>` : ''}
        <button class="btn small ${st === 'k' ? 'go green' : 'ghost'}" data-uw="k" data-en="I know this word: don't count it as new any more">Poznám</button>
        <button class="btn small ghost" data-uw="look" data-en="<b>hľadaj</b> = look it up: full table of forms">🔍</button>
      </div></div>`;
  }

  // ---------- screen shell ----------
  let tab = 'dnes';
  let RUN = null;   // active session { kind: 'catch'|'review', items, i, ... }
  const body = () => $('#uBody');
  async function render() {
    if (!loaded) await loadPacks();
    cardBoxes();
    if (RUN) return renderRun();
    $('#uHead').hidden = false; $('#uRun').hidden = true;
    $$('#uTabs button').forEach((b) => b.classList.toggle('on', b.dataset.utab === tab));
    if (!PACKS.length) tab = tab === 'slovnik' ? 'dnes' : tab;
    body().innerHTML = tab === 'slovnik' ? slovnikHtml() : tab === 'balicky' ? packsHtml() : todayHtml();
  }

  const dueCards = () => Object.entries(S.cards).filter(([sid, c]) => c.due <= today() && BYSID.has(sid)).sort((a, b) => a[1].due - b[1].due);
  function dailyLeft() {
    const d = S.daily; if (!d || d.day !== today()) return null;
    return d.ids.length - d.i;
  }

  function importBox(first) {
    return `<div class="ucard uimport">
      ${first ? `<h2>Prvý balíček</h2>` : `<h3>Pridaj balíček</h3>`}
      <p>A pack is one episode's subtitles, Slovak + official English, every word tagged and glossed.
        It's a file ending in <code>.ulovok.json</code>: ask Claude to build one from the subtitle files you find, send it to yourself (email, OneDrive), then open it here.</p>
      <p class="usmall">🔒 The subtitles stay on this device, in this browser. They're never uploaded or shared.</p>
      <label class="btn go">📥 Importovať balíček<input type="file" id="uFile" accept=".json,application/json" hidden></label>
      ${loadErr ? `<p class="uerr">${esc(loadErr)}</p>` : ''}
    </div>`;
  }

  function levelPicker() {
    return `<div class="ucard"><h2 data-en="How many Slovak words do you know?">Koľko slov poznáš?</h2>
      <p>A rough guess is fine: it decides which words count as new until you mark them yourself. You can change it later.</p>
      <div class="ulevels">${LEVELS.map((L) => `<button class="ulevel${S.level === L.n ? ' on' : ''}" data-level="${L.n}" data-en="${attr(L.en)}"><b>${L.sk}</b><small>~${L.n.toLocaleString('sk')} slov</small></button>`).join('')}</div></div>`;
  }

  function todayHtml() {
    if (!PACKS.length) return importBox(true);
    if (!S.level) return levelPicker();
    const due = dueCards().length, left = dailyLeft();
    const pool = SENTS.filter((s) => !S.done[s.sid]);
    const one = pool.filter((s) => unknownIn(s).length === 1).length;
    const readable = SENTS.length ? Math.round(100 * SENTS.filter((s) => unknownIn(s).length === 0).length / SENTS.length) : 0;
    const nCards = Object.keys(S.cards).length;
    const catchBtn = left === 0
      ? `<p class="udone">✓ Dnešný úlovok hotový.</p><button class="btn ghost" data-uact="more" data-en="5 more sentences">Ešte 5 viet</button>`
      : `<button class="btn go" data-uact="catch" data-en="${left ? 'carry on with today\'s catch' : 'start today\'s catch: 10 sentences'}">${left ? `Pokračuj (${left})` : 'Začni úlovok'} →</button>`;
    return `<div class="ugrid">
      <article class="ucard uhero">
        <div class="mode-tag" data-en="<b>dnešný úlovok</b> = today's catch">Dnešný úlovok 🎣</div>
        <h2>10 viet, v každej jedno nové slovo</h2>
        <p>Read it, try to understand it, then check the English. Keep the ones worth learning.</p>
        ${catchBtn}
        <p class="usmall">${one} sentences left that are exactly one new word away.</p>
      </article>
      <article class="ucard">
        <div class="mode-tag rev" data-en="<b>opakovanie</b> = review">Opakovanie</div>
        <h2>${due ? `${due} ${due === 1 ? 'veta' : due < 5 ? 'vety' : 'viet'} na dnes` : 'Nič na dnes'}</h2>
        <p>${nCards ? `${nCards} sentences caught so far. Each one comes back as reading, fill-in, colouring, translating and listening.` : 'Sentences you keep come back here, a day later and then less and less often.'}</p>
        ${due ? `<button class="btn go blue" data-uact="review">Opakuj →</button>` : ''}
      </article>
      <article class="ucard ustats">
        <div class="ustat" data-en="sentences in your packs you can read with no new word (by your settings and marks)"><b>${readable} %</b><span>viet prečítaš</span></div>
        <div class="ustat" data-en="words you're learning from caught sentences"><b>${Object.keys(LBOX).length}</b><span>slov sa učíš</span></div>
        <div class="ustat" data-en="words you marked as known"><b>${Object.values(S.words).filter((x) => x === 'k').length}</b><span>označených ako známe</span></div>
        ${missHtml()}
        <div class="usettings"><span data-en="your rough vocabulary size: words more common than this count as known">Úroveň:</span>
          ${LEVELS.map((L) => `<button class="chip${S.level === L.n ? ' on' : ''}" data-level="${L.n}" data-en="${attr(L.en)}">${L.sk}</button>`).join('')}</div>
      </article>
    </div>`;
  }

  function missHtml() {
    const tot = CASES.reduce((a, c) => a + (S.miss[c.k] || 0), 0);
    if (!tot) return `<p class="usmall umiss-empty">When a form throws you (<b>Neznám tvar</b>) or you colour a case wrong, it's counted here by case.</p>`;
    const max = Math.max(...CASES.map((c) => S.miss[c.k] || 0));
    return `<div class="umiss"><div class="umiss-h" data-en="cases that tripped you up in real sentences">Pády, ktoré ťa potkli</div>
      ${CASES.map((c) => `<div class="umiss-row"><span class="lg c-${c.k}">${c.name}</span><span class="umiss-bar"><i class="c-${c.k}" style="width:${Math.round(100 * (S.miss[c.k] || 0) / max)}%"></i></span><b>${S.miss[c.k] || 0}</b></div>`).join('')}
      <button class="link" data-go="learn" data-en="open the crib sheet to revise a case">📖 Ťahák →</button></div>`;
  }

  function packsHtml() {
    const rows = PACKS.map((p) => {
      const ss = SENTS.filter((s) => s.pack === p);
      const taken = ss.filter((s) => S.done[s.sid] === 'take').length;
      const read = ss.filter((s) => unknownIn(s).length === 0).length;
      return `<article class="ucard upack">
        <div class="upack-poster"><b>${esc(p.title)}</b><small>${esc(p.ep || '')}</small></div>
        <div class="upack-info">
          <div class="usmall">${ss.length} viet · ${esc(p.from || '')}</div>
          <div class="upack-bar" data-en="sentences you can read with no new word"><i style="width:${Math.round(100 * read / Math.max(1, ss.length))}%"></i></div>
          <div class="usmall">${Math.round(100 * read / Math.max(1, ss.length))} % prečítaš · ${taken} ulovených</div>
          <div class="upack-acts"><button class="btn small ghost" data-uact="browse" data-pack="${attr(p.id)}" data-en="<b>prehliadať</b> = browse every sentence">Prehliadať</button>
          <button class="btn small ghost" data-uact="delpack" data-pack="${attr(p.id)}" data-en="remove this pack from this device (your progress is kept)">Odstrániť</button></div>
        </div></article>`;
    }).join('');
    return `<div class="ugrid">${rows}${importBox(false)}</div>`;
  }

  let browseId = null, browseShowEn = false;
  function browseHtml() {
    const p = PACKS.find((x) => x.id === browseId); if (!p) { browseId = null; return packsHtml(); }
    const ss = SENTS.filter((s) => s.pack === p);
    return `<div class="ubrowse-head"><button class="btn small ghost" data-uact="unbrowse">← Balíčky</button>
      <b>${esc(p.title)} ${esc(p.ep || '')}</b>
      <button class="btn small ghost" data-uact="browseen">${browseShowEn ? 'Skry angličtinu' : 'Ukáž angličtinu'}</button></div>
      <p class="usmall">Tap a sentence to open it, look up its words and catch it.</p>
      <ol class="ubrowse">${ss.map((s) => {
        const u = unknownIn(s).length, d = S.done[s.sid];
        const badge = d === 'take' ? '<span class="ub take">🎣</span>' : d === 'easy' ? '<span class="ub easy">✓</span>' : u ? `<span class="ub n${Math.min(u, 3)}">${u}</span>` : '<span class="ub zero">0</span>';
        return `<li data-usid="${attr(s.sid)}">${badge}<span class="ub-sk">${esc(plainSk(s))}</span>${browseShowEn ? `<small>${esc(s.en)}</small>` : ''}</li>`;
      }).join('')}</ol>`;
  }

  // ---------- Slovník ----------
  function slovnikHtml() {
    if (!PACKS.length) return importBox(true);
    const learning = Object.keys(LBOX).sort((a, b) => rankOf(a) - rankOf(b));
    const flagged = Object.keys(S.words).filter((l) => S.words[l] === 'u' && LBOX[l] == null && LEX.has(l));
    // what to catch next: unknown words that come up most in your packs (common words first on ties)
    const cnt = new Map();
    for (const s of SENTS) for (const t of s.t) if (isWord(t) && !known(t[1], t[2]) && LBOX[t[1]] == null && !isRare(t[1])) cnt.set(t[1], (cnt.get(t[1]) || 0) + 1);
    const next = [...cnt.entries()].sort((a, b) => b[1] - a[1] || rankOf(a[0]) - rankOf(b[0])).slice(0, 25);
    const coll = [...LEX.entries()].filter(([, v]) => v.c).map(([l]) => l).sort();
    const row = (l, extra = '') => {
      const lx = LEX.get(l) || {};
      const n = LEMMA_SENTS.get(l)?.length || 0;
      return `<li><div class="us-main"><b>${esc(l)}</b> <span class="gl">${esc(lx.g || '')}</span>${aiMark(l)}${collMark(l)}</div>
        <div class="us-meta">${freqChip(l)} <span class="usmall" data-en="sentences in your packs with this word">${n}× vo vetách</span> ${extra}</div></li>`;
    };
    const boxPips = (l) => `<span class="upips" data-en="how well you know it: fills up as its sentences come back right">${[0, 1, 2, 3].map((i) => `<i class="${(LBOX[l] ?? 0) > i ? 'on' : ''}"></i>`).join('')}</span>`;
    const huntBtn = (l) => (LEMMA_SENTS.get(l)?.some((s) => !S.done[s.sid]) ? `<button class="btn small go" data-uact="hunt" data-lemma="${attr(l)}" data-en="catch sentences with this word">Ulov</button>` : '');
    const sec = (title, en, note, items) => `<section class="ucard usec"><h3 data-en="${attr(en)}">${title} <small>${items.length}</small></h3>${note ? `<p class="usmall">${note}</p>` : ''}<ul class="uslist">${items.join('') || '<li class="usmall">Zatiaľ nič.</li>'}</ul></section>`;
    return `<div class="ugrid one">
      ${sec('Učím sa', 'words you are learning (from caught sentences)', '', learning.map((l) => row(l, boxPips(l))))}
      ${sec('Na precvičenie', 'words you marked as new, not caught in a sentence yet', 'Words you marked <b>Neznám slovo</b>. Catch a sentence with them to start learning.', flagged.filter((l) => !isRare(l)).map((l) => row(l, huntBtn(l))))}
      ${sec('Ďalšie na rade', 'what to catch next', 'Unknown words that come up most often in your packs. Worth learning first.', next.map(([l]) => row(l, huntBtn(l))))}
      ${sec('Len spoznať', 'rare words: recognise them, no need to drill them', 'Rare words (beyond the 10,000 most common). Good to recognise; they never get fill-in drills.', [...new Set([...flagged, ...learning])].filter(isRare).map((l) => row(l)))}
      ${sec('Hovorové', 'colloquial words and slang from your packs', 'Spoken Slovak that dictionaries skip. Meanings marked <span class="uai">AI</span> were written by Claude.', coll.map((l) => row(l)))}
    </div>`;
  }

  // ---------- the catch ----------
  function pickCatch(n, onlyLemma) {
    const t = today(), taken = new Set();
    const pool = (onlyLemma ? LEMMA_SENTS.get(onlyLemma) || [] : SENTS).filter((s) => !S.done[s.sid] && !(S.snooze[s.sid] > t) && s.words >= 3);
    const scored = pool.map((s) => {
      const u = unknownIn(s);
      const tier = onlyLemma ? 0 : u.length === 1 ? 0 : u.length === 2 ? 1 : u.length === 0 ? 2 : 3;
      const len = s.words < 4 ? 3 : s.words > 14 ? 2 : 0;
      const score = tier === 0 ? rankOf(u[0] || onlyLemma) : tier === 1 ? Math.max(...u.map(rankOf)) : rand(1000);
      return { s, u, tier, k: tier * 1e6 + len * 1e5 + Math.min(score, 99999) };
    }).sort((a, b) => a.k - b.k);
    const out = [];
    for (const x of scored) {
      if (out.length >= n) break;
      if (x.tier >= 3 && out.length >= Math.min(n, 3)) continue;   // 3+ new words: only when nothing else is left
      const key = x.u.join('|');
      if (x.tier < 2 && key && taken.has(key)) continue;            // not the same new word twice in one catch
      taken.add(key); out.push(x.s.sid);
    }
    return out;
  }
  function startCatch(more = 0, onlyLemma = null, sids = null) {
    let ids;
    if (sids) ids = sids;
    else if (onlyLemma) ids = pickCatch(5, onlyLemma);
    else {
      const d = S.daily;
      if (d && d.day === today() && d.i < d.ids.length && !more) ids = d.ids.slice(d.i);
      else { ids = pickCatch(more || 10); if (!more || !d || d.day !== today()) S.daily = { day: today(), ids: [...ids], i: 0 }; else { d.ids.push(...ids); } persist(); }
    }
    ids = ids.filter((sid) => BYSID.has(sid));
    if (!ids.length) { P.toast('Žiadne nové vety. Pridaj balíček!'); return; }
    RUN = { kind: 'catch', daily: !sids && !onlyLemma, title: onlyLemma ? `Úlovok · ${onlyLemma}` : 'Dnešný úlovok', items: ids.map((sid) => ({ sid })), i: 0, taken: 0, xp: 0 };
    renderRun();
  }

  // full form tables from Hľadaj's dictionary (lookup-data.js, loaded once, cached offline): so a fill-in offers
  // other forms of the same word (výlet / výletu / výletom…), which drills the case, not just the meaning
  let LKFORMS = null;
  function loadLookupForms() {
    if (LKFORMS) return Promise.resolve();
    return new Promise((res) => {
      if (window.PADY_LOOKUP) return res();
      const sc = document.createElement('script'); sc.src = 'lookup-data.js';
      sc.onload = () => res(); sc.onerror = () => res(); document.head.appendChild(sc);
    }).then(() => {
      LKFORMS = new Map(); const LK = window.PADY_LOOKUP; if (!LK) return;
      const add = (w, fs) => { if (FORMS.has(w)) LKFORMS.set(w, [...new Set(fs.filter(Boolean).map(low))]); };
      for (const n of LK.nouns) add(n[0], n[4] ? [...n[4][0], ...n[4][1]] : n[3]);
      for (const a of LK.adjs) add(a[0], a[2]);
      for (const v of LK.verbs) add(v[0], [v[0], ...(v[5] || []), ...(v[6] || []), ...(v[7] || [])]);
    });
  }

  async function startReview() {
    await loadLookupForms();
    const due = dueCards().slice(0, 20);
    if (!due.length) { P.toast('Nič na opakovanie.'); return; }
    RUN = { kind: 'review', title: 'Opakovanie', items: due.map(([sid, c]) => ({ sid, type: typeFor(sid, c) })), i: 0, good: 0, xp: 0 };
    renderRun();
  }

  // review type by box: 0 read, 1 fill-in, 2 colour, 3 translate, 4+ a mix (listen when there's a voice)
  function typeFor(sid, c) {
    const s = BYSID.get(sid);
    const canCloze = clozeIndex(s, c) != null && !c.tg.every(isRare);
    const canColor = colorTargets(s).length >= 2;
    const order = ['read', canCloze ? 'cloze' : 'read', canColor ? 'color' : canCloze ? 'cloze' : 'read', 'translate'];
    if (c.box < order.length) return order[c.box];
    const mix = ['translate', canCloze && 'cloze', canColor && 'color', E.canSpeak() && 'listen'].filter(Boolean);
    return mix[rand(mix.length)];
  }
  const clozeIndex = (s, c) => { const i = s.t.findIndex((t) => c.tg.includes(t[1]) && isWord(t)); return i < 0 ? null : i; };
  const colorTargets = (s) => s.t.map((t, i) => (t[3] && ['NOUN', 'ADJ', 'DET', 'PRON', 'NUM'].includes(t[2]) && isWord(t) ? i : -1)).filter((i) => i >= 0).slice(0, 6);

  // ---------- running a session ----------
  let cur = null;   // state of the current item
  function renderRun() {
    $('#uHead').hidden = true; $('#uRun').hidden = false;
    const R = RUN;
    $('#uRunTitle').textContent = R.title;
    if (R.i >= R.items.length) return endRun();
    $('#uRunCount').textContent = `${R.i + 1}/${R.items.length}`;
    $('#uRunBar').style.width = `${(R.i / R.items.length) * 100}%`;
    const it = R.items[R.i], s = BYSID.get(it.sid);
    cur = { s, it, revealed: false, sel: null, answered: false, flagged: new Set(), ci: 0, cmiss: 0, cdone: {} };
    if (R.kind === 'catch') cur.type = 'catch';
    else cur.type = it.type;
    if (cur.type === 'cloze') cur.cloze = buildCloze(s, S.cards[s.sid]);
    if (cur.type === 'color') cur.ctargets = colorTargets(s);
    if (cur.type === 'listen') cur.listen = buildListen(s);
    drawItem();
    const card = $('#uCard'); card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    if (cur.type === 'listen') setTimeout(() => E.speak(plainSk(s)), 300);
  }

  const TASK = {
    catch: ['Prečítaj a skús pochopiť', 'Read it and try to understand it. Tap any word for help.'],
    read: ['Rozumieš?', 'Do you understand it? Read, then check the English.'],
    cloze: ['Doplň slovo', 'Fill in the missing word'],
    color: ['Vyfarbi pády', 'Colour the cases: which case is the highlighted word in?'],
    translate: ['Povedz to po slovensky', 'Say (or write) it in Slovak, then compare with the official subtitle'],
    listen: ['Počúvaj', 'Listen: which sentence was it?'],
  };
  function drawItem() {
    const { s, type } = cur, c = S.cards[s.sid];
    const task = TASK[type];
    let h = `<div class="trtask" data-en="${attr(task[1])}">${task[0]}</div>`;
    const sayBtn = E.canSpeak() ? `<button class="say" data-say="${attr(plainSk(s))}" aria-label="Vypočuť" data-en="listen (Slovak voice)">🔊</button>` : '';
    const tools = `<div class="utools">${sayBtn}
      <button class="btn small ${cur.colors ? 'go yellow' : 'ghost'}" data-uact="colors" data-en="<b>pády</b> = colour every noun, adjective and pronoun by its case">🎨 Pády</button>
      <button class="btn small ghost" data-uact="ctx" data-en="<b>kontext</b> = the lines just before and after">⋯ Kontext</button></div>`;
    const enShown = !(type === 'catch' || type === 'read') || cur.revealed;
    const ctx = cur.showCtx ? `<div class="uctx">${ctxHtml(s, enShown)}</div>` : '';
    const wordBox = cur.sel != null ? wordHtml(s, cur.sel) : `<p class="uhint usmall">Ťukni na slovo · <span class="tip-mouse">click</span><span class="tip-touch">tap</span> any word for its meaning and form.</p>`;
    const en = `<div class="uen">${esc(s.en)}</div>`;

    if (type === 'catch' || type === 'read') {
      const marks = {}; if (type === 'read' && c) s.t.forEach((t, i) => { if (c.tg.includes(t[1])) marks[i] = 'tg'; });
      h += `<div class="usent" id="uSent">${sentHtml(s, { colors: cur.colors, unk: type === 'catch', marks })}</div>${srcLine(s)}${tools}${ctx}`;
      h += cur.revealed ? en : '';
      h += `<div id="uWord">${wordBox}</div>`;
      h += cur.revealed
        ? (type === 'catch'
          ? `<div class="uchoice">
              <button class="btn go" data-uact="take" data-en="Keep it: this sentence becomes a card that comes back for practice"><span class="mk">1</span>🎣 Beriem</button>
              <button class="btn ghost" data-uact="easy" data-en="Too easy: I knew every word"><span class="mk">2</span>Ľahké</button>
              <button class="btn ghost" data-uact="hard" data-en="Too hard for now: show it again in a couple of weeks"><span class="mk">3</span>Ťažké</button></div>`
          : gradeButtons())
        : `<div class="uchoice"><button class="btn go yellow" data-uact="reveal" data-en="show the official English subtitle (Space)">Ukáž preklad <small>␣</small></button></div>`;
    } else if (type === 'cloze') {
      const z = cur.cloze;
      h += `<div class="uen top">${esc(s.en)}</div><div class="usent" id="uSent">${cur.answered ? sentHtml(s, { colors: cur.colors, marks: { [z.i]: 'tg' } }) : sentHtml(s, { blankAt: z.i })}</div>${srcLine(s)}`;
      h += cur.answered ? `${tools}<div id="uWord">${cur.sel != null ? wordHtml(s, cur.sel) : ''}</div>${feedback()}` :
        `<div class="tropts">${z.options.map((o, i) => `<button class="tropt" data-uopt="${attr(o)}"><span class="mk">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
    } else if (type === 'color') {
      const tg = cur.ctargets, now = tg[cur.ci];
      const marks = {}; tg.forEach((ti, k) => { marks[ti] = cur.cdone[ti] ? `cdone c-${cur.cdone[ti].ck}${cur.cdone[ti].ok ? '' : ' cwrong'}` : k === cur.ci ? 'cnow' : 'cto'; });
      h += `<div class="usent" id="uSent">${sentHtml(s, { marks })}</div>${srcLine(s)}`;
      if (now != null) {
        h += `<div class="trcases">${CASES.map((cc, i) => `<button class="trcase c-${cc.k}" data-ucase="${cc.k}"><span class="mk">${i + 1}</span><b>${cc.name}</b><small>${cc.q}</small></button>`).join('')}</div>`;
      } else {
        h += `<div class="uen">${esc(s.en)}</div>${tools}<div id="uWord">${wordBox}</div>${feedback()}`;
      }
    } else if (type === 'translate') {
      h += `<div class="uen big">${esc(s.en)}</div>${srcLine(s)}`;
      if (!cur.revealed) {
        h += `<textarea id="uTr" rows="2" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="napíš po slovensky (nepovinné)…" aria-label="Tvoj preklad"></textarea>
          <div class="uchoice"><button class="btn go yellow" data-uact="reveal" data-en="show the official Slovak subtitle">Ukáž originál</button></div>`;
      } else {
        h += `${cur.mine ? `<div class="umine"><small data-en="what you wrote">Ty:</small> ${esc(cur.mine)}</div>` : ''}
          <div class="usent" id="uSent">${sentHtml(s, { colors: cur.colors })}</div>${tools}<div id="uWord">${wordBox}</div>
          <p class="usmall">The official subtitle is one good answer, not the only one. Same meaning, right forms? Count it.</p>${gradeButtons()}`;
      }
    } else if (type === 'listen') {
      const L = cur.listen;
      h += `<div class="ulisten"><button class="btn go" data-uact="replay" data-en="play it again">🔊 Ešte raz</button></div>`;
      h += cur.answered ? `<div class="usent" id="uSent">${sentHtml(s, { colors: cur.colors })}</div><div class="uen">${esc(s.en)}</div>${tools}<div id="uWord">${wordBox}</div>${feedback()}`
        : `<div class="ulopts">${L.map((o, i) => `<button class="tropt ulopt" data-ulisten="${i}"><span class="mk">${i + 1}</span>${esc(plainSk(o))}</button>`).join('')}</div>`;
    }
    $('#uCard').innerHTML = h;
    const ta = $('#uTr'); if (ta) setTimeout(() => ta.focus(), 50);
  }
  const gradeButtons = () => `<div class="uchoice">
      <button class="btn ghost" data-ugrade="0" data-en="I didn't get it: show it again tomorrow"><span class="mk">1</span>Nevedel som</button>
      <button class="btn go green" data-ugrade="1" data-en="I got it: show it again later"><span class="mk">2</span>Vedel som</button></div>`;
  function feedback() {
    const ok = cur.ok;
    return `<div class="ufeed ${ok ? 'ok' : 'no'}"><span class="mres">${ok ? 'Správne!' : 'Nie celkom.'}</span>${cur.why || ''}
      <button class="btn go" data-uact="next" data-en="next (Enter)">Ďalej →</button></div>`;
  }

  // fill-in: the right form + other forms of the same word (that's the grammar point), else similar words
  function buildCloze(s, c) {
    const i = clozeIndex(s, c), t = s.t[i], right = t[0], lem = t[1];
    const cap = right[0] !== right[0].toLowerCase();
    const fix = (f) => (cap ? f[0].toUpperCase() + f.slice(1) : f);
    const own = new Set([...(FORMS.get(lem) || []), ...(LEX.get(lem)?.f || []), ...(LKFORMS?.get(lem) || [])]);
    const n = D.nouns.find((x) => x.w === lem) || E.MODELS[lem];
    if (n) [...n.s, ...n.p].forEach((f) => f && own.add(f));
    const a = D.adjs.find((x) => x.w === lem); if (a) Object.values(a.f).forEach((f) => f && own.add(f));
    const v = E.vByW(lem); if (v) { (v.s || []).forEach((f) => f && own.add(f)); (v.l || []).forEach((f) => f && own.add(f)); (v.i || []).forEach((f) => f && own.add(f)); }
    own.delete(low(right));
    let others = shuffle([...own]).slice(0, 3);
    if (others.length < 3) {
      // not enough forms: everyday words of the same kind and case (common ones only, so no rude surprises)
      const same = shuffle(SENTS.flatMap((x) => x.t).filter((u) => u[2] === t[2] && u[1] !== lem && isWord(u) && (!t[3] || u[3] === t[3]) && rankOf(u[1]) <= 3000).map((u) => low(u[0])));
      for (const f of same) { if (others.length >= 3) break; if (!others.includes(f) && f !== low(right)) others.push(f); }
    }
    return { i, right, lem, options: shuffle([right, ...others.map(fix)]) };
  }
  function buildListen(s) {
    const others = shuffle(SENTS.filter((x) => x !== s && Math.abs(x.words - s.words) <= 3)).slice(0, 2);
    return shuffle([s, ...others]);
  }

  function grade(good) {
    const s = cur.s, c = S.cards[s.sid]; if (!c) return;
    const INT = [1, 2, 4, 8, 16, 32, 64, 120];
    c.box = good ? Math.min(INT.length - 1, c.box + 1) : Math.max(0, c.box - 1);
    c.due = today() + (good ? INT[c.box] : 1); c.n = (c.n || 0) + 1;
    persist(); cardBoxes();
    if (good) { RUN.good++; RUN.xp += 3; P.sfx.good(RUN.good); } else P.sfx.bad();
  }
  function next() { RUN.i++; if (RUN.daily) { S.daily.i = Math.min(S.daily.ids.length, S.daily.i + 1); persist(); } renderRun(); }

  function endRun() {
    const R = RUN; RUN = null;
    const xp = R.kind === 'catch' ? 5 + R.taken * 3 : 5 + R.xp;
    const lv = P.award(xp); P.sfx.done();
    $('#uRunBar').style.width = '100%';
    const due = dueCards().length;
    $('#uCard').innerHTML = `<div class="uend"><div class="ubig">🎣</div><h2>${R.kind === 'catch' ? 'Úlovok hotový!' : 'Opakovanie hotové!'}</h2>
      <p>${R.kind === 'catch' ? `${R.taken} ${R.taken === 1 ? 'veta ulovená' : R.taken > 1 && R.taken < 5 ? 'vety ulovené' : 'viet ulovených'}. They come back for review from tomorrow.` : `${R.good} / ${R.items.length} right.`}</p>
      <p class="xp-gain">+${xp} XP${lv ? ` · Level ${lv}!` : ''}</p>
      <div class="res-actions">${due && R.kind === 'catch' ? `<button class="btn go blue" data-uact="review">Opakovanie (${due}) →</button>` : ''}
        <button class="btn ghost" data-uact="home">Hotovo</button></div></div>`;
    const r = $('#uCard').getBoundingClientRect(); P.confetti(r.left + r.width / 2, r.top + 60);
  }

  // ---------- actions ----------
  function markWord(l, st) {
    if (S.words[l] === st) delete S.words[l]; else S.words[l] = st;
    persist(); cardBoxes();
  }
  function act(a, el) {
    const s = cur?.s;
    switch (a) {
      case 'catch': return startCatch();
      case 'more': return startCatch(5);
      case 'review': return startReview();
      case 'home': RUN = null; tab = 'dnes'; return render();
      case 'hunt': return startCatch(0, el.dataset.lemma);
      case 'colors': cur.colors = !cur.colors; return drawItem();
      case 'ctx': cur.showCtx = !cur.showCtx; return drawItem();
      case 'replay': return E.speak(plainSk(s));
      case 'reveal':
        if (cur.type === 'translate') cur.mine = ($('#uTr')?.value || '').trim();
        cur.revealed = true; return drawItem();
      case 'next': return next();
      case 'take': {
        const flagged = [...cur.flagged];
        let tg = flagged.length ? flagged : unknownIn(s);
        if (!tg.length) {   // everything known: learn its least common content word
          const cw = s.t.filter((t) => isWord(t) && !FUNC.has(t[2])).sort((a, b) => rankOf(b[1]) - rankOf(a[1]));
          tg = cw.length ? [cw[0][1]] : [];
        }
        tg = tg.slice(0, 3);
        tg.forEach((l) => { if (S.words[l] !== 'k') S.words[l] = 'u'; });
        S.cards[s.sid] = { tg, box: 0, due: today() + 1, n: 0, made: today() };
        S.done[s.sid] = 'take'; RUN.taken++; persist(); cardBoxes(); P.sfx.good(RUN.taken);
        return next();
      }
      case 'easy':
        unknownIn(s).forEach((l) => { if (!cur.flagged.has(l)) S.words[l] = 'k'; });
        S.done[s.sid] = 'easy'; persist(); cardBoxes(); return next();
      case 'hard':
        S.snooze[s.sid] = today() + 14; persist(); return next();
      case 'browse': browseId = el.dataset.pack; body().innerHTML = browseHtml(); return;
      case 'unbrowse': browseId = null; return render();
      case 'browseen': browseShowEn = !browseShowEn; body().innerHTML = browseHtml(); return;
      case 'delpack': {
        const p = PACKS.find((x) => x.id === el.dataset.pack);
        if (!p || !confirm(`Remove "${p.title} ${p.ep || ''}" from this device? Your progress stays.`)) return;
        dbDel(p.id).then(loadPacks).then(render);
        return;
      }
      default:
    }
  }

  async function importFile(file) {
    try {
      const pack = JSON.parse(await file.text());
      if (pack.v !== 1 || !pack.id || !Array.isArray(pack.s) || !pack.lex) throw new Error('not an Úlovok pack');
      await dbPut(pack); await loadPacks(); tab = 'dnes'; render();
      P.toast(`Pridané: ${pack.title} ${pack.ep || ''} (${pack.s.length} viet)`);
    } catch (e) { P.toast(`Nepodarilo sa: ${e.message}`); }
  }

  // ---------- events (only while the Úlovok screen is open) ----------
  const screen = () => $('#catch');
  document.addEventListener('change', (e) => { if (e.target.id === 'uFile' && e.target.files[0]) importFile(e.target.files[0]); });
  document.addEventListener('click', (e) => {
    if (!screen()?.classList.contains('active')) return;
    const t = e.target;
    const tabB = t.closest('[data-utab]'); if (tabB) { tab = tabB.dataset.utab; browseId = null; return render(); }
    const lv = t.closest('[data-level]'); if (lv) { S.level = +lv.dataset.level; persist(); return render(); }
    const say = t.closest('[data-say]'); if (say) { E.speak(say.dataset.say); return; }
    const a = t.closest('[data-uact]'); if (a) return act(a.dataset.uact, a);
    const li = t.closest('[data-usid]'); if (li) { RUN = { kind: 'catch', title: 'Prehliadanie', items: [{ sid: li.dataset.usid }], i: 0, taken: 0, xp: 0 }; return renderRun(); }
    if (!cur) return;
    const w = t.closest('.uw[data-ti]');
    if (w && cur.type !== 'color' && !(cur.type === 'cloze' && !cur.answered)) {
      const ti = +w.dataset.ti; cur.sel = cur.sel === ti ? null : ti;
      $$('#uSent .uw').forEach((x) => x.classList.toggle('sel', +x.dataset.ti === cur.sel));
      $('#uWord').innerHTML = cur.sel != null ? wordHtml(cur.s, cur.sel) : '';
      return;
    }
    const uw = t.closest('[data-uw]');
    if (uw?.dataset.uw === 'x') return closeWord();
    // click away: anywhere outside the word card that isn't a word or a button
    if (cur.sel != null && !t.closest('.uword, button, textarea, input, a')) return closeWord();
    if (uw && cur.sel != null) {
      const tok = cur.s.t[cur.sel], l = tok[1];
      if (uw.dataset.uw === 'u') { markWord(l, 'u'); if (S.words[l] === 'u') cur.flagged.add(l); else cur.flagged.delete(l); }
      else if (uw.dataset.uw === 'k') { markWord(l, 'k'); cur.flagged.delete(l); }
      else if (uw.dataset.uw === 'f') {
        const ck = tok[3]; const k = ck || 'verb';
        S.miss[k] = (S.miss[k] || 0) + 1; persist(); uw.classList.add('go'); uw.textContent = '✓ Zapísané'; P.toast(ck ? `Zapísané: ${CASES[CI[ck]].name}` : 'Zapísané'); return;
      } else if (uw.dataset.uw === 'look') { history.replaceState(null, '', `#hladaj/${encodeURIComponent(low(tok[0]))}`); P.show('lookup'); return; }
      $('#uSent').innerHTML = sentHtml(cur.s, { colors: cur.colors, unk: cur.type === 'catch' });
      $$('#uSent .uw').forEach((x) => x.classList.toggle('sel', +x.dataset.ti === cur.sel));
      $('#uWord').innerHTML = wordHtml(cur.s, cur.sel);
      return;
    }
    const g = t.closest('[data-ugrade]'); if (g) { grade(g.dataset.ugrade === '1'); return next(); }
    const o = t.closest('[data-uopt]'); if (o && !cur.answered) return answerCloze(o.dataset.uopt, o);
    const cs = t.closest('[data-ucase]'); if (cs) return answerColor(cs.dataset.ucase);
    const lo = t.closest('[data-ulisten]'); if (lo && !cur.answered) return answerListen(+lo.dataset.ulisten, lo);
  });

  function closeWord() {
    cur.sel = null;
    $$('#uSent .uw').forEach((x) => x.classList.remove('sel'));
    const box = $('#uWord'); if (box) box.innerHTML = '';
  }

  function answerCloze(ans, btn) {
    const z = cur.cloze, ok = ans === z.right;
    cur.answered = true; cur.ok = ok;
    const t = cur.s.t[z.i];
    cur.why = ok ? '' : ` <span class="usmall">Správne: <b>${esc(z.right)}</b></span>`;
    if (!ok && t[3]) { S.miss[t[3]] = (S.miss[t[3]] || 0) + 1; }
    grade(ok); cur.sel = z.i; drawItem();
  }
  function answerColor(ck) {
    const ti = cur.ctargets[cur.ci]; if (ti == null) return;
    const right = cur.s.t[ti][3], ok = ck === right;
    cur.cdone[ti] = { ck: right, ok };
    if (!ok) { cur.cmiss++; S.miss[right] = (S.miss[right] || 0) + 1; persist(); P.sfx.bad(); } else P.sfx.good(cur.ci);
    cur.ci++;
    if (cur.ci >= cur.ctargets.length) {
      cur.ok = cur.cmiss === 0; cur.answered = true;
      const wrong = cur.ctargets.filter((i) => !cur.cdone[i].ok).map((i) => `<b>${esc(cur.s.t[i][0])}</b> ${caseChip(cur.s.t[i][3])}${cur.s.t[i][5] ? ` <span class="usmall">(${esc(cur.s.t[i][5])} +)</span>` : ''}`);
      cur.why = wrong.length ? ` ${wrong.join(' · ')}` : '';
      grade(cur.ok);
    }
    drawItem();
  }
  function answerListen(k, btn) {
    const ok = cur.listen[k] === cur.s;
    cur.answered = true; cur.ok = ok; cur.why = '';
    grade(ok); drawItem();
  }

  document.addEventListener('keydown', (e) => {
    if (!screen()?.classList.contains('active') || !cur || !RUN) return;
    if (e.key === 'Escape' && cur.sel != null) { e.preventDefault(); return closeWord(); }
    if (e.target.matches('input, textarea') && e.key !== 'Enter') return;
    if (e.target.matches('textarea') && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); return act('reveal'); }
    const card = $('#uCard');
    const n = parseInt(e.key, 10);
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.matches('button')) {
      const b = card.querySelector('[data-uact="reveal"], [data-uact="next"], [data-uact="home"]');
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    if (n >= 1 && n <= 6) {
      const b = card.querySelectorAll('.uchoice button, .tropt, .trcase')[n - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  // ---------- PÁDY home card ----------
  async function homeCard() {
    const el = $('#ulovokNote'); if (!el) return;
    if (!loaded) await loadPacks();
    cardBoxes();
    const due = dueCards().length, left = dailyLeft();
    el.textContent = !PACKS.length ? 'No packs yet: import your first one.'
      : `${due ? `${due} na opakovanie · ` : ''}${left === 0 ? 'dnešný úlovok hotový ✓' : 'dnešný úlovok čaká'}`;
  }

  window.PADYUlovok = { render() { RUN = null; cur = null; render(); }, homeCard };
  homeCard();
})();
