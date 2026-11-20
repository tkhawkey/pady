/* PÁDY — Rozbi to! (phase 1) */
(() => {
  'use strict';
  const D = window.PADY_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- constants ----------
  const CASES = [
    { k: 'nom', name: 'Nominatív',    abbr: 'N', q: 'kto? čo?',      en: 'nominative',   qEn: 'who? what?',
      use: 'The subject of the sentence, and the dictionary form.' },
    { k: 'gen', name: 'Genitív',      abbr: 'G', q: 'koho? čoho?',   en: 'genitive',     qEn: 'of whom? of what?',
      use: '"of", possession, quantities, 5+ things, negation; after <i>z, do, bez, u, od</i>.' },
    { k: 'dat', name: 'Datív',        abbr: 'D', q: 'komu? čomu?',   en: 'dative',       qEn: 'to whom? to what?',
      use: 'To / for someone (indirect object); after <i>k, proti, vďaka</i>.' },
    { k: 'acc', name: 'Akuzatív',     abbr: 'A', q: 'koho? čo?',     en: 'accusative',   qEn: 'whom? what?',
      use: 'The direct object; after <i>pre</i>, and <i>na, do, za</i> with movement.' },
    { k: 'loc', name: 'Lokál',        abbr: 'L', q: 'o kom? o čom?', en: 'locative',     qEn: 'about whom? about what?',
      use: 'Only after prepositions: <i>o</i> (about), <i>v</i> (in), <i>na</i> (on), <i>po, pri</i>.' },
    { k: 'ins', name: 'Inštrumentál', abbr: 'I', q: 's kým? s čím?', en: 'instrumental', qEn: 'with whom? with what?',
      use: 'With / by means of; after <i>s, pred, za, nad, pod, medzi</i>.' },
  ];
  const caseTip = (c) => `<b>${c.name}</b> = ${c.en}<span class="tip-q"><i>${c.q}</i> = ${c.qEn}</span><span class="tip-q">${c.use}</span>`;
  const PATTERNS = ['chlap', 'hrdina', 'dub', 'stroj', 'žena', 'ulica', 'dlaň', 'kosť', 'mesto', 'srdce', 'vysvedčenie', 'dievča'];
  const PATTERN_EN = {
    chlap: ['man', 'masculine nouns for people, ending in a consonant'],
    hrdina: ['hero', 'masculine nouns for people, ending in -a'],
    dub: ['oak', 'masculine things, ending in a hard consonant'],
    stroj: ['machine', 'masculine things, ending in a soft consonant'],
    žena: ['woman', 'feminine nouns in -a after a hard consonant'],
    ulica: ['street', 'feminine nouns in -a after a soft consonant'],
    dlaň: ['palm of the hand', 'feminine nouns ending in a consonant (genitive -e)'],
    kosť: ['bone', 'feminine nouns ending in a consonant (genitive -i)'],
    mesto: ['town', 'neuter nouns in -o'],
    srdce: ['heart', 'neuter nouns in -e'],
    vysvedčenie: ['school report', 'neuter nouns in -ie'],
    dievča: ['girl', 'neuter nouns in -a/-ä for young beings (dievča, mača)'],
  };
  const patternTip = (p) => PATTERN_EN[p]
    ? `<b>vzor ${p}</b> = pattern "${p}" (${PATTERN_EN[p][0]})<span class="tip-q">Model for ${PATTERN_EN[p][1]}.</span>`
    : `<b>nepravidelné</b> = irregular: doesn't follow one of the 12 patterns`;
  const GENDER_LABEL = {
    'm-pers': 'muž. · osoba', 'm-anim': 'muž. · životné', 'm-inan': 'muž. · neživotné', f: 'žen.', n: 'stred.',
  };
  const GENDER_EN = {
    'm-pers': '<b>mužský rod · osoba</b> = masculine, a person. Accusative = genitive in singular <i>and</i> plural.',
    'm-anim': '<b>mužský rod · životné</b> = masculine, animate (an animal). Accusative = genitive in the singular only.',
    'm-inan': '<b>mužský rod · neživotné</b> = masculine, inanimate (a thing). Accusative = nominative.',
    f: '<b>ženský rod</b> = feminine',
    n: '<b>stredný rod</b> = neuter. Accusative = nominative.',
  };
  const MULTI = { 2: 'DOUBLE!', 3: 'TRIPLE!', 4: 'QUAD!!', 5: 'PENTA!!!' };
  const CONF_COLORS = ['var(--nom)', 'var(--gen)', 'var(--dat)', 'var(--acc)', 'var(--loc)', 'var(--ins)'];

  // ---------- storage ----------
  const KEY = 'pady.v1';
  const defaults = { xp: 0, streak: 0, lastDay: null, best: {}, muted: false, stats: {} };
  let save = load();
  function load() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch { return { ...defaults }; }
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode etc. */ } }

  // ---------- helpers ----------
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const dayStr = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  function adjForm(adj, gender, ck, num) {
    const f = adj.f;
    if (num === 's') {
      if (ck === 'acc' && gender[0] === 'm') return f[gender === 'm-inan' ? 'sg_acc_m_inan' : 'sg_acc_m_anim'];
      return f[`sg_${ck}_${gender[0] === 'm' ? 'm' : gender}`];
    }
    if (ck === 'nom' || ck === 'acc') return f[`pl_${ck}_${gender === 'm-pers' ? 'vir' : 'nonvir'}`];
    return f[`pl_${ck}`];
  }

  // "Bláznivé" (crazy) mode: any of the top adjectives with any noun
  const phraseAdjs = D.adjs.filter((a) => !/degree of|superlative|comparative/i.test(a.g) && !a.w.startsWith('naj')).slice(0, 80);
  // normal mode: a real pair from the treebank when the noun has one, else an adjective that fits almost anything
  const adjByWord = Object.fromEntries(D.adjs.map((a) => [a.w, a]));
  const SAFE_ADJS = ['nový', 'starý', 'veľký', 'malý', 'dobrý', 'zlý', 'pekný', 'krásny', 'iný', 'ďalší', 'prvý', 'posledný']
    .map((w) => adjByWord[w]).filter(Boolean);
  function pickAdj(noun) {
    if (opts.kind === 'crazy') return { adj: phraseAdjs[rand(phraseAdjs.length)], real: false };
    const real = ((D.pairs && D.pairs[noun.w]) || []).map((w) => adjByWord[w]).filter(Boolean);
    // mostly real pairs, with some variety from the safe list so a noun doesn't always get the same adjective
    if (real.length && Math.random() < 0.75) return { adj: real[rand(Math.min(real.length, 4))], real: true };
    return { adj: SAFE_ADJS[rand(SAFE_ADJS.length)], real: false };
  }

  // ---------- level ----------
  const lvlOf = (xp) => Math.floor(Math.sqrt(xp / 25)) + 1;
  function renderTop() {
    const lv = lvlOf(save.xp);
    const lo = 25 * (lv - 1) ** 2, hi = 25 * lv ** 2;
    $('#levelVal').textContent = lv;
    $('#xpFill').style.width = `${Math.round(((save.xp - lo) / (hi - lo)) * 100)}%`;
    const alive = save.lastDay === dayStr() || save.lastDay === dayStr(new Date(Date.now() - 864e5));
    $('#streakVal').textContent = alive ? save.streak : 0;
    $('#muteBtn').textContent = save.muted ? '🔇' : '🔊';
  }

  // ---------- sound ----------
  let ac = null;
  function tone(freq, dur = 0.09, type = 'sine', vol = 0.15, when = 0) {
    if (save.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + when;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* no audio */ }
  }
  const sfx = {
    good: (combo) => tone(523 * 2 ** (Math.min(combo, 14) / 12), 0.1, 'triangle', 0.2),
    bad: () => { tone(150, 0.2, 'sawtooth', 0.12); tone(110, 0.25, 'sawtooth', 0.1, 0.06); },
    multi: () => { tone(880, 0.08, 'square', 0.08); tone(1175, 0.12, 'square', 0.08, 0.07); },
    done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.18, i * 0.08)),
    pick: () => tone(330, 0.05, 'sine', 0.08),
  };

  // ---------- fx ----------
  const fx = $('#fx');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function confetti(x, y, n = 28) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.className = 'conf';
      c.style.left = `${x}px`; c.style.top = `${y}px`;
      c.style.background = CONF_COLORS[i % CONF_COLORS.length];
      const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 220;
      c.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      c.style.setProperty('--dy', `${Math.sin(a) * d + 160}px`);
      c.style.setProperty('--rz', `${rand(720) - 360}deg`);
      fx.appendChild(c);
      setTimeout(() => c.remove(), 1200);
    }
  }
  function floater(text, x, y, big = false) {
    const f = document.createElement('div');
    f.className = 'floater' + (big ? ' big' : '');
    f.textContent = text; f.style.left = `${x}px`; f.style.top = `${y}px`;
    fx.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- navigation ----------
  function show(id) {
    window.hideTip?.();
    if (id !== 'game') stopPad();
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'home') { stopTimer(); renderHome(); }
    if (id === 'learn') { stopTimer(); renderTop(); window.PADYLearn?.render(); }
    if (id === 'lookup') { stopTimer(); renderTop(); window.PADYLookup?.render(); }
    if (['start', 'path', 'train'].includes(id)) { stopTimer(); renderTop(); window.PADYTrainer?.render(id); }
    if (id === 'game') showWhy('');
    else if (location.hash.startsWith('#hladaj')) history.replaceState(null, '', location.pathname + location.search);
  }
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) show(go.dataset.go);
  });

  // ---------- home ----------
  const opts = { kind: 'noun', pattern: 'all', len: 5, mlevel: 'case' };
  function renderHome() {
    $('#legend').innerHTML = CASES.map((c) => `<span class="lg c-${c.k}" tabindex="0" data-en="${attr(caseTip(c))}">${c.name}<small>${c.q}</small></span>`).join('');
    const counts = {};
    D.nouns.forEach((n) => { counts[n.pat] = (counts[n.pat] || 0) + 1; });
    $('#patternChips').innerHTML =
      `<button data-pat="all" class="${opts.pattern === 'all' ? 'on' : ''}" data-en="<b>všetky</b> = all patterns mixed">všetky<small>${D.nouns.length}</small></button>` +
      PATTERNS.map((p) => `<button data-pat="${p}" class="${opts.pattern === p ? 'on' : ''}" ${counts[p] ? '' : 'disabled'} data-en="${attr(patternTip(p) + `<span class="tip-q">${counts[p] || 0} words in the game.</span>`)}">${p}<small>${counts[p] || 0}</small></button>`).join('');
    [['smash', '#bestSmash'], ['grid', '#bestGrid'], ['magnet', '#bestMagnet'], ['pad', '#bestPad']].forEach(([mode, sel]) => {
      const b = save.best[bestKey(mode)];
      const best = $(sel);
      best.textContent = b ? `Rekord pre toto nastavenie: ${b} bodov` : 'Ešte žiadny rekord. Poďme na to.';
      best.dataset.en = b ? `Your record for these settings: ${b} points` : 'No record yet. Let\'s go!';
    });
    renderTop();
    window.PADYTrainer?.renderHome();
  }
  const bestKey = (mode) => (mode === 'magnet' ? `magnet:${opts.mlevel}:${opts.len}`
    : mode === 'pad' ? `pad:${opts.kind}:${opts.pattern}`
    : `${mode}:${opts.kind}:${opts.pattern}:${opts.len}`);
  $('#kindSeg').addEventListener('click', (e) => segPick(e, 'kind', '#kindSeg'));
  $('#lenSeg').addEventListener('click', (e) => segPick(e, 'len', '#lenSeg'));
  function segPick(e, key, sel) {
    const b = e.target.closest('button'); if (!b) return;
    opts[key] = key === 'len' ? +b.dataset.len : b.dataset.kind;
    $$(`${sel} button`).forEach((x) => x.classList.toggle('on', x === b));
    renderHome();
  }
  $('#patternChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    opts.pattern = b.dataset.pat; renderHome();
  });
  $('#muteBtn').addEventListener('click', () => { save.muted = !save.muted; persist(); renderTop(); });

  // ---------- game state ----------
  let G = null;
  let timerId = null;
  function stopTimer() { clearInterval(timerId); timerId = null; }

  function startRound(mode) {
    let pool = D.nouns.filter((n) => opts.pattern === 'all' || n.pat === opts.pattern);
    // favour frequent words: shuffle the top 200 (or whole pool if smaller)
    pool = shuffle(pool.slice(0, Math.max(200, opts.len)));
    G = {
      mode, words: mode === 'magnet' ? buildMagnetItems() : mode === 'pad' ? pool : pool.slice(0, opts.len), idx: 0, score: 0, combo: 0, maxCombo: 0,
      right: 0, wrong: 0, hints: 0, caseMiss: {}, start: Date.now(), card: null, sel: null,
      pausedMs: 0, pausedAt: null, awaitNext: false,
    };
    $('#game').classList.remove('card-done');
    $('#game').classList.toggle('mode-grid', mode === 'grid');
    $('#game').classList.toggle('mode-magnet', mode === 'magnet');
    $('#game').classList.toggle('mode-pad', mode === 'pad');
    $('#hudCardLabel').textContent = mode === 'pad' ? 'Životy' : 'Slovo';
    $('#hudCardWrap').dataset.en = mode === 'pad' ? '<b>životy</b> = lives. Lose one when a form lands or you pick a wrong case; +1 every 15 catches.' : '<b>slovo</b> = word (which word you\'re on)';
    show('game');
    stopTimer();
    timerId = setInterval(() => { $('#hudTime').textContent = fmtTime(elapsed()); }, 250);
    nextCard();
  }

  // ---------- the game clock only counts answering time ----------
  function elapsed() {
    if (!G) return 0;
    return Date.now() - G.start - G.pausedMs - (G.pausedAt ? Date.now() - G.pausedAt : 0);
  }
  function pauseClock() {
    if (!G || G.pausedAt) return;
    G.pausedAt = Date.now();
    $('#hudTime').closest('.hud-item').classList.add('paused');
  }
  function resumeClock() {
    if (!G || !G.pausedAt) return;
    G.pausedMs += Date.now() - G.pausedAt; G.pausedAt = null;
    $('#hudTime').closest('.hud-item').classList.remove('paused');
  }
  // switching tab/app freezes the clock too
  document.addEventListener('visibilitychange', () => {
    if (!G || !$('#game').classList.contains('active')) return;
    if (document.hidden) { G.hiddenPause = !G.pausedAt; pauseClock(); }
    else if (G.hiddenPause) { G.hiddenPause = false; if (!G.awaitNext && !G.pad?.paused) resumeClock(); }
  });

  function buildCard(noun) {
    const pick = opts.kind === 'noun' ? null : pickAdj(noun);
    const adj = pick ? pick.adj : null;
    const cells = [];
    CASES.forEach((c, ci) => {
      ['s', 'p'].forEach((num) => {
        const nf = (num === 's' ? noun.s : noun.p)[ci];
        const nAlts = [nf, ...((noun.alt && noun.alt[`${c.k}_${num}`]) || [])];
        const af = adj ? adjForm(adj, noun.gen, c.k, num) : null;
        const ok = new Set(nAlts.map((x) => (af ? `${af} ${x}` : x)));
        cells.push({ ci, ck: c.k, num, main: af ? `${af} ${nf}` : nf, ok, filled: false, tries: 0 });
      });
    });
    const tiles = new Map();
    cells.forEach((cell, i) => {
      if (!tiles.has(cell.main)) tiles.set(cell.main, { text: cell.main, cells: [], left: 0 });
      const t = tiles.get(cell.main); t.cells.push(i); t.left++;
    });
    const title = adj ? `${adjForm(adj, noun.gen, 'nom', 's')} ${noun.w}` : noun.w;
    return { noun, adj, real: !!pick?.real, cells, tiles: shuffle([...tiles.values()]), mistakes: 0, title };
  }

  function nextCard() {
    if (G.mode === 'magnet') return renderMagnet();
    if (G.mode === 'pad') return startPad();
    showWhy('');
    const noun = G.words[G.idx];
    G.card = buildCard(noun);
    G.sel = null;
    const C = G.card;
    $('#hudCard').textContent = `${G.idx + 1}/${G.words.length}`;
    $('#cardWord').textContent = C.title;
    $('#cardGloss').textContent = C.adj ? `${C.adj.g} ${noun.g}` : noun.g;
    const rc = $('#cardReal');
    rc.hidden = !C.real;
    rc.dataset.en = 'A real word pair: it appears in real Slovak text (the annotated treebank), so it\'s worth remembering as a phrase.';
    $('#cardGender').textContent = GENDER_LABEL[noun.gen] || noun.gen;
    $('#cardGender').dataset.en = GENDER_EN[noun.gen] || noun.gen;
    $('#cardPattern').textContent = noun.pat === 'other' ? 'nepravidelné' : `vzor ${noun.pat}`;
    $('#cardPattern').dataset.en = patternTip(noun.pat);
    const wc = $('#wordCard'); wc.classList.remove('enter'); void wc.offsetWidth; wc.classList.add('enter');
    if (G.mode === 'grid') { renderGrid(); } else { renderBoard(); renderTray(); }
    renderHud();
  }

  function renderBoard() {
    const C = G.card;
    let h = '<div></div><div class="bh" data-en="<b>singulár</b> = singular (one)">Singulár</div><div class="bh" data-en="<b>plurál</b> = plural (more than one)">Plurál</div>';
    CASES.forEach((c, ci) => {
      h += `<div class="rl c-${c.k}" data-en="${attr(caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span><small>${c.q}</small></div>`;
      ['s', 'p'].forEach((num, j) => {
        const i = ci * 2 + j, cell = C.cells[i];
        h += `<button class="cell c-${c.k}${cell.filled ? ' filled' : ''}" data-i="${i}" aria-label="${c.name} ${num === 's' ? 'singulár' : 'plurál'}">${cell.filled ? cell.main : ''}</button>`;
      });
    });
    $('#board').innerHTML = h;
  }

  function renderTray() {
    $('#tray').innerHTML = G.card.tiles.map((t, i) =>
      t.left > 0 ? `<button class="tile" data-t="${i}" style="--rot:${rand(40) - 20}deg;animation-delay:${i * 35}ms">${t.text}</button>` : ''
    ).join('');
  }

  function renderHud() {
    $('#hudScore').textContent = G.score;
    $('#hudCombo').textContent = `×${mult().toFixed(1).replace('.0', '')}`;
    const w = $('#hudComboWrap');
    w.classList.toggle('hot', G.combo >= 4 && G.combo < 9);
    w.classList.toggle('fire', G.combo >= 9);
  }
  const mult = () => Math.min(3, 1 + Math.floor(G.combo / 3) * 0.5);

  function statBump(noun, ck, num, good) {
    const k = `${noun.pat}|${ck}_${num}`;
    const s = save.stats[k] || [0, 0];
    s[good ? 0 : 1]++; save.stats[k] = s;
    window.PADYEngine?.review(k, good);   // spaced repetition: every game feeds it
  }

  // XP + streak for any finished activity (games, sessions, placement)
  function award(xp) {
    const lvBefore = lvlOf(save.xp);
    save.xp += xp;
    const today = dayStr(), yest = dayStr(new Date(Date.now() - 864e5));
    if (save.lastDay !== today) { save.streak = save.lastDay === yest ? save.streak + 1 : 1; save.lastDay = today; }
    persist(); renderTop();
    return lvlOf(save.xp) > lvBefore ? lvlOf(save.xp) : 0;
  }

  // "why" line under the board: explains a wrong answer
  function showWhy(html) {
    const w = $('#why'); if (!w) return;
    w.innerHTML = html || ''; w.classList.toggle('show', !!html);
  }

  // ---------- placing ----------
  function attempt(ti, i, viaHint = false) {
    const C = G.card, tile = C.tiles[ti], cell = C.cells[i];
    if (!tile || tile.left <= 0 || cell.filled) return;
    const cellEl = $(`.cell[data-i="${i}"]`);
    const [x, y] = centerOf(cellEl);
    if (cell.ok.has(tile.text)) {
      cell.filled = true; tile.left--;
      cellEl.classList.add('filled'); cellEl.textContent = cell.main;
      if (viaHint) {
        floater('−15', x, y); sfx.pick();
      } else {
        G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.right++;
        const pts = Math.round(10 * mult());
        G.score += pts;
        statBump(C.noun, cell.ck, cell.num, true);
        floater(`+${pts}`, x, y);
        sfx.good(G.combo);
      }
      if (tile.left === 0) {
        const tEl = $(`.tile[data-t="${ti}"]`);
        if (tEl) { tEl.classList.add('gone'); setTimeout(() => tEl.remove(), 200); }
        if (tile.cells.length >= 2 && !viaHint) {
          const bonus = 5 * tile.cells.length;
          G.score += bonus;
          setTimeout(() => { floater(`${MULTI[tile.cells.length] || 'MEGA!'} +${bonus}`, x, y - 40, true); sfx.multi(); }, 150);
        }
      }
      G.sel = null; $$('.tile.sel').forEach((t) => t.classList.remove('sel'));
      renderHud();
      if (C.cells.every((c) => c.filled)) cardDone();
    } else {
      G.combo = 0; G.wrong++; C.mistakes++;
      // the learner's weak spot is where the tile really belongs
      const home = C.cells[tile.cells.find((j) => !C.cells[j].filled) ?? tile.cells[0]];
      G.caseMiss[home.ck] = (G.caseMiss[home.ck] || 0) + 1;
      statBump(C.noun, home.ck, home.num, false);
      cellEl.classList.remove('bad'); void cellEl.offsetWidth; cellEl.classList.add('bad');
      setTimeout(() => cellEl.classList.remove('bad'), 420);
      sfx.bad();
      renderHud();
      // graded hints: say what the tried cell needs, then narrow it down, and only reveal on the 3rd miss
      tile.misses = (tile.misses || 0) + 1;
      const slotName = (c) => `${CASES[c.ci].name} ${c.num === 's' ? 'sg' : 'pl'}`;
      const chipOf = (c) => `<span class="lg c-${c.ck}">${slotName(c)}</span>`;
      const homes = tile.cells.map((j) => C.cells[j]).filter((c) => !c.filled);
      if (tile.misses === 1) {
        const needs = window.PADYEngine?.cellNeeds(C.noun, cell.ck, cell.num) || '';
        showWhy(`<b>${tile.text}</b> doesn't go in ${chipOf(cell)}. ${needs} <span class="why-try">Try another cell.</span>`);
      } else if (tile.misses === 2) {
        const nums = new Set(homes.map((c) => c.num));
        const narrow = nums.size === 1
          ? `<b>${tile.text}</b> is <b>${[...nums][0] === 's' ? 'singular' : 'plural'}</b>.`
          : `<b>${tile.text}</b> fits ${homes.length} cells, in both columns.`;
        showWhy(`${narrow} <span class="why-try">One more try.</span>`);
      } else {
        showWhy(`<b>${tile.text}</b> = ${homes.map(chipOf).join(' ')} <span class="why-not">· nie ${slotName(cell)}</span>`);
        for (const c of homes) {
          const el = $(`.cell[data-i="${C.cells.indexOf(c)}"]`);
          el?.classList.add('reveal'); setTimeout(() => el?.classList.remove('reveal'), 1600);
        }
      }
    }
  }

  function cardDone() {
    const C = G.card;
    const [x, y] = centerOf($('#wordCard'));
    let msg = 'Hotovo!';
    const clean = C.mistakes === 0 && !C.hinted && !C.almosts;
    if (clean) { G.score += 30; msg = 'ČISTÉ! +30'; }
    renderHud();
    setTimeout(() => { floater(msg, x, y, true); confetti(x, y); sfx.done(); }, 200);
    // pause here: the finished table stays on screen, the clock stops, the player moves on when ready
    pauseClock();
    G.awaitNext = true;
    G.doneAt = Date.now();   // the Enter that finished the last cell must not also skip the pause
    const last = G.idx + 1 >= G.words.length;
    const bits = [];
    if (C.mistakes) bits.push(`${C.mistakes} ${C.mistakes === 1 ? 'chyba' : C.mistakes < 5 ? 'chyby' : 'chýb'}`);
    if (C.almosts) bits.push(`${C.almosts}× diakritika`);
    if (C.hinted) bits.push('s nápovedou');
    const sum = clean ? 'Čisté! Bez chyby.' : bits.join(' · ');
    const sumEn = clean ? 'Clean! No mistakes.' : 'mistakes / accent slips / hints on this word';
    $('#doneBar').innerHTML = `<span class="done-sum" data-en="${attr(sumEn)}"><b>Hotovo!</b> ${sum}</span>
      <span class="done-paused" data-en="The clock is paused: take your time to look at the finished table">⏸ čas stojí</span>
      <button class="btn go" id="doneNext" data-en="${last ? 'see your results (Enter)' : 'next word (Enter)'}">${last ? 'Výsledky →' : 'Ďalej →'}</button>`;
    $('#game').classList.add('card-done');
    setTimeout(() => $('#doneNext')?.focus({ preventScroll: true }), 50);
  }

  function cardNext() {
    if (!G?.awaitNext || Date.now() - (G.doneAt || 0) < 350) return;
    G.awaitNext = false;
    $('#game').classList.remove('card-done');
    resumeClock();
    G.idx++;
    if (G.idx < G.words.length) nextCard(); else finish();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('#doneNext')) cardNext(); });
  document.addEventListener('keydown', (e) => {
    if (!G?.awaitNext || !$('#game').classList.contains('active')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardNext(); }
  });

  function hint() {
    if (G.mode === 'grid') return gridHint();
    const C = G.card;
    const open = C.cells.map((c, i) => i).filter((i) => !C.cells[i].filled);
    if (!open.length) return;
    const i = open[rand(open.length)];
    const ti = C.tiles.findIndex((t) => t.text === C.cells[i].main);
    G.hints++; C.hinted = true;
    G.score = Math.max(0, G.score - 15);
    attempt(ti, i, true);
    renderHud();
    $(`.cell[data-i="${i}"]`)?.classList.add('hinted');
  }
  $('#hintBtn').addEventListener('click', hint);
  $('#quitBtn').addEventListener('click', () => show('home'));

  // ---------- Tabuľka (typing) ----------
  const DIA = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ĺ', 'ľ', 'ň', 'ó', 'ô', 'ŕ', 'š', 'ť', 'ú', 'ý', 'ž'];
  const ORDER = [0, 2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11];   // down the singular column, then the plural
  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const bare = (s) => norm(s).normalize('NFD').replace(/\p{M}/gu, '');
  let lastInput = null;

  function renderGrid() {
    const C = G.card;
    C.cells[0].filled = true; C.cells[0].given = true;   // nominative singular is the prompt
    C.almosts = 0;
    let h = '<div></div><div class="bh" data-en="<b>singulár</b> = singular (one)">Singulár</div><div class="bh" data-en="<b>plurál</b> = plural (more than one)">Plurál</div>';
    CASES.forEach((c, ci) => {
      h += `<div class="rl c-${c.k}" data-en="${attr(caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span><small>${c.q}</small></div>`;
      ['s', 'p'].forEach((num, j) => {
        const i = ci * 2 + j, cell = C.cells[i];
        h += `<div class="cell-wrap"><input class="cell c-${c.k}${cell.given ? ' filled given' : ''}" data-i="${i}"
          ${cell.given ? `value="${attr(cell.main)}" readonly tabindex="-1"` : ''}
          autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"
          aria-label="${c.name} ${num === 's' ? 'singulár' : 'plurál'}"></div>`;
      });
    });
    $('#board').innerHTML = h;
    setTimeout(() => focusNext(-1), 60);
  }

  function inputAt(i) { return $(`#board input[data-i="${i}"]`); }
  function setTag(i, cls, text) {
    const wrap = inputAt(i)?.parentElement; if (!wrap) return;
    wrap.querySelector('.tag')?.remove();
    if (text) wrap.insertAdjacentHTML('beforeend', `<span class="tag ${cls}">${text}</span>`);
  }

  function focusNext(from) {
    const C = G.card;
    const start = ORDER.indexOf(from);
    for (let k = 1; k <= ORDER.length; k++) {
      const i = ORDER[(start + k + ORDER.length) % ORDER.length];
      if (!C.cells[i].filled) { inputAt(i)?.focus({ preventScroll: false }); return true; }
    }
    return false;
  }

  function checkCell(i) {
    const C = G.card, cell = C.cells[i], el = inputAt(i);
    if (!cell || cell.filled || !el) return;
    const v = norm(el.value);
    if (!v) return;
    const ok = [...cell.ok].map(norm);
    if (ok.includes(v)) return resolveCell(i, 'right', v);
    if (ok.map(bare).includes(bare(v))) return resolveCell(i, 'almost');
    // wrong
    cell.tries++; G.combo = 0; G.wrong++; C.mistakes++;
    G.caseMiss[cell.ck] = (G.caseMiss[cell.ck] || 0) + 1;
    statBump(C.noun, cell.ck, cell.num, false);
    sfx.bad();
    el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
    setTimeout(() => el.classList.remove('bad'), 420);
    renderHud();
    // 1st miss: a hint without the answer (so the second try is real); 2nd miss: the full explanation
    showWhy(window.PADYEngine?.explain({ noun: C.noun, adj: C.adj, ck: cell.ck, num: cell.num, answer: v, reveal: cell.tries >= 2 }) || '');
    if (cell.tries >= 2) { setTimeout(() => resolveCell(i, 'revealed'), 380); }
    else { setTag(i, 't-try', 'ešte 1×'); inputAt(i).parentElement.querySelector('.tag').dataset.en = 'one more try'; el.select(); }
  }

  function resolveCell(i, kind, typed) {
    const C = G.card, cell = C.cells[i], el = inputAt(i);
    if (cell.filled) return;
    cell.filled = true;
    el.readOnly = true; el.tabIndex = -1;
    const [x, y] = centerOf(el);
    if (kind === 'right') {
      el.value = typed;
      el.classList.add('filled');
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.right++;
      const pts = Math.round(10 * mult());
      G.score += pts;
      statBump(C.noun, cell.ck, cell.num, true);
      floater(`+${pts}`, x, y); sfx.good(G.combo);
      setTag(i, '', '');
    } else if (kind === 'almost') {
      el.value = cell.main;
      el.classList.add('almost');
      G.right++; C.almosts++;
      const pts = Math.round(5 * mult());
      G.score += pts;
      statBump(C.noun, cell.ck, cell.num, true);
      floater(`+${pts} takmer!`, x, y); sfx.pick();
      setTag(i, 't-almost', 'ˇ´ diakritika');
      el.parentElement.querySelector('.tag').dataset.en = 'Right ending, but an accent was missing or wrong. The correct spelling is shown. Half points.';
    } else if (kind === 'revealed') {
      el.value = cell.main;
      el.classList.add('revealed');
      setTag(i, 't-rev', '✗');
      el.parentElement.querySelector('.tag').dataset.en = 'Missed twice, so here is the answer. No points.';
    } else if (kind === 'hint') {
      el.value = cell.main;
      el.classList.add('filled', 'hinted');
      floater('−15', x, y); sfx.pick();
      setTag(i, '', '');
    }
    renderHud();
    if (C.cells.every((c) => c.filled)) { el.blur(); cardDone(); }
    else if (document.activeElement === el || !document.activeElement?.matches?.('#board input')) focusNext(i);
  }

  function gridHint() {
    const C = G.card;
    const act = document.activeElement?.matches?.('#board input:not([readonly])') ? +document.activeElement.dataset.i : null;
    const i = act ?? ORDER.find((j) => !C.cells[j].filled);
    if (i == null) return;
    G.hints++; C.hinted = true;
    G.score = Math.max(0, G.score - 15);
    resolveCell(i, 'hint');
  }

  $('#board').addEventListener('keydown', (e) => {
    const el = e.target.closest('input'); if (!el || G?.mode !== 'grid') return;
    if (e.key === 'Enter') { e.preventDefault(); checkCell(+el.dataset.i); }
  });
  $('#board').addEventListener('focusin', (e) => { if (e.target.matches('input')) lastInput = e.target; });

  $('#diaBar').innerHTML = DIA.map((ch) => `<button type="button" tabindex="-1" data-ch="${ch}">${ch}</button>`).join('');
  // insert on pointerdown (not click) so the focused cell — and the phone keyboard — stay put
  $('#diaBar').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    let el = document.activeElement?.matches?.('#board input:not([readonly])') ? document.activeElement : lastInput;
    if (!el || el.readOnly || !el.isConnected) el = $('#board input:not([readonly])');
    if (!el) return;
    el.focus();
    el.setRangeText(b.dataset.ch, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end');
    sfx.pick();
  });

  // ---------- Magnet (verbs → case) ----------
  const LETTER_CK = { G: 'gen', D: 'dat', A: 'acc', L: 'loc', I: 'ins' };
  const MAG_CASES = CASES.filter((c) => c.k !== 'nom');
  const nounTable = (w) => D.models.find((m) => m.w === w) || D.nouns.find((n) => n.w === w);
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function buildMagnetItems() {
    const items = [];
    if (opts.mlevel === 'case') {
      // one item per verb + preposition; every core case with that preposition counts as right
      for (const v of D.verbs) {
        const groups = {};
        v.fr.forEach((f) => { (groups[f.p || ''] = groups[f.p || ''] || []).push(f); });
        for (const [p, frs] of Object.entries(groups)) {
          const cases = [...new Set(frs.map((f) => f.c))];
          const n = frs.reduce((s, f) => s + f.n, 0);
          // plain "verb + accusative object" is the default for hundreds of verbs: keep only a few
          const plainAcc = !p && cases.length === 1 && cases[0] === 'A';
          if (n < 4) continue;   // rare / idiomatic in the corpus
          const weight = (plainAcc ? 0.1 : 1) * Math.min(n, 40);
          items.push({ kind: 'case', v, p, cases, ex: frs.flatMap((f) => f.ex), weight });
        }
      }
    } else {
      for (const v of D.verbs) {
        for (const f of v.fr) {
          for (const z of f.cz || []) {
            const tbl = nounTable(z.l);
            if (!tbl) continue;
            const forms = [...new Set(tbl[z.num])];
            if (!forms.includes(z.f.toLowerCase())) continue;
            items.push({ kind: 'form', v, p: f.p, c: f.c, z, forms, weight: f.c === 'A' && !f.p ? 1 : 3 });
          }
        }
      }
    }
    // weighted sample without replacement
    const out = [];
    const pool = items.slice();
    while (out.length < opts.len && pool.length) {
      const total = pool.reduce((s, it) => s + it.weight, 0);
      let r = Math.random() * total, i = 0;
      while ((r -= pool[i].weight) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  function renderMagnet() {
    const it = G.words[G.idx];
    G.card = { item: it, answered: false, mistakes: 0 };
    $('#hudCard').textContent = `${G.idx + 1}/${G.words.length}`;
    const verbTip = attr(`<b>${it.v.v}</b> = ${it.v.g}`);
    $('#mVerb').innerHTML = `<span data-en="${verbTip}">${esc(it.v.v)}</span>`;
    $('#mGloss').textContent = it.v.g;
    if (it.kind === 'case') {
      $('#mPrompt').innerHTML = `<span class="mline">+ ${it.p ? `<b class="mprep" data-en="${attr(`preposition <b>${esc(it.p)}</b>: it can take more than one case, depending on the verb`)}">${esc(it.p)}</b> ` : ''}<span class="mblank">?</span></span>`;
      $('#mOpts').className = 'magnets';
      $('#mOpts').innerHTML = MAG_CASES.map((c, i) => `<button class="magnet c-${c.k}" data-c="${Object.keys(LETTER_CK).find((L) => LETTER_CK[L] === c.k)}" data-en="${attr(P_caseTipShort(c))}">
          <span class="mk">${i + 1}</span><b>${c.name}</b><small>${c.q}</small></button>`).join('');
    } else {
      const z = it.z;
      const re = new RegExp(`(?<![\\p{L}])${z.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u');
      const sent = esc(z.t).replace(re, `<span class="mblank wide">?</span>`);
      // meanings inline: the noun to put in the gap, and the verb that decides its case
      const ng = nounTable(z.l)?.g || PATTERN_EN[z.l]?.[0] || '';
      $('#mPrompt').innerHTML = `<span class="msent">${sent}</span>
        <span class="mhint"><span class="chip ghost">${esc(z.l)} · ${z.num === 's' ? 'sg' : 'pl'}</span>${ng ? `<span class="gl">${esc(ng)}</span>` : ''}
        <span class="sep">·</span>
        <span class="chip ghost">${esc(it.v.v)}${it.p ? ` ${esc(it.p)}` : ''} + ?</span><span class="gl">${esc(it.v.g)}</span></span>`;
      const cap = z.f[0] !== z.f[0].toLowerCase();
      const fix = (s) => (cap ? s[0].toUpperCase() + s.slice(1) : s);
      const correct = z.f;
      const others = shuffle(it.forms.filter((f) => f !== correct.toLowerCase())).slice(0, 3).map(fix);
      const opts4 = shuffle([correct, ...others]);
      $('#mOpts').className = 'mforms';
      $('#mOpts').innerHTML = opts4.map((f, i) => `<button class="mform" data-f="${attr(f)}"><span class="mk">${i + 1}</span>${esc(f)}</button>`).join('');
    }
    $('#mFeed').innerHTML = ''; $('#mFeed').className = 'mfeed';
    const mc = $('#mCard'); mc.classList.remove('enter'); void mc.offsetWidth; mc.classList.add('enter');
    renderHud();
  }
  const P_caseTipShort = (c) => `<b>${c.name}</b> = ${c.en}<span class="tip-q"><i>${c.q}</i> = ${c.qEn}</span>`;

  function magnetAnswer(btn) {
    const C = G.card; if (!C || C.answered) return;
    const it = C.item;
    C.answered = true;
    pauseClock();   // reading the rule and the example sentence doesn't count against you
    let ok, rightCk;
    if (it.kind === 'case') {
      ok = it.cases.includes(btn.dataset.c);
      rightCk = LETTER_CK[it.cases[0]];
      $$('#mOpts .magnet').forEach((b) => {
        if (it.cases.includes(b.dataset.c)) b.classList.add('right');
        else if (b === btn) b.classList.add('wrong');
        else b.classList.add('dim');
      });
    } else {
      ok = btn.dataset.f === it.z.f;
      rightCk = LETTER_CK[it.c];
      $$('#mOpts .mform').forEach((b) => {
        if (b.dataset.f === it.z.f) b.classList.add('right', `c-${rightCk}`);
        else if (b === btn) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      $('#mPrompt .mblank')?.replaceWith(Object.assign(document.createElement('span'), { className: `mfilled c-${rightCk}`, textContent: it.z.f }));
    }
    const [x, y] = centerOf(btn);
    if (ok) {
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.right++;
      const pts = Math.round(10 * mult());
      G.score += pts;
      floater(`+${pts}`, x, y); sfx.good(G.combo);
    } else {
      G.combo = 0; G.wrong++;
      G.caseMiss[rightCk] = (G.caseMiss[rightCk] || 0) + 1;
      btn.classList.add('shake'); sfx.bad();
    }
    const vk = `${it.v.v}|${it.p || ''}`;
    save.vstats = save.vstats || {};
    const s = save.vstats[vk] || [0, 0]; s[ok ? 0 : 1]++; save.vstats[vk] = s;
    renderHud();
    showMagnetFeedback(ok);
  }

  function showMagnetFeedback(ok) {
    const it = G.card.item;
    const caseChip = (L) => { const c = CASES.find((x) => x.k === LETTER_CK[L]); return `<span class="lg c-${c.k}" data-en="${attr(P_caseTipShort(c))}">${c.name}</span>`; };
    let rule, example;
    if (it.kind === 'case') {
      rule = `${esc(it.v.v)} ${it.p ? `<b>${esc(it.p)}</b> ` : ''}+ ${it.cases.map(caseChip).join(' <span class="or">alebo</span> ')}`;
      const ex = it.ex[rand(Math.max(1, Math.min(it.ex.length, 3)))];
      example = ex ? `„${esc(ex)}“` : '';
    } else {
      rule = `${esc(it.v.v)} ${it.p ? `<b>${esc(it.p)}</b> ` : ''}+ ${caseChip(it.c)} → <b>${esc(it.z.f)}</b>`;
      example = '';
    }
    $('#mFeed').className = `mfeed show ${ok ? 'ok' : 'no'}`;
    $('#mFeed').innerHTML = `
      <div class="mrule"><span class="mres" data-en="${ok ? 'right' : 'not quite'}">${ok ? 'Správne!' : 'Ups!'}</span> ${rule}</div>
      ${example ? `<p class="mex" data-en="A real sentence from the Slovak treebank">${example}</p>` : ''}
      <button class="btn small go" id="mNext" data-en="next (Enter)">Ďalej →</button>`;
    clearTimeout(G.autoNext);
    if (ok) G.autoNext = setTimeout(magnetNext, it.kind === 'form' ? 1600 : 2200);
  }

  function magnetNext() {
    if (G?.mode !== 'magnet' || !G.card?.answered || !$('#game').classList.contains('active')) return;
    clearTimeout(G.autoNext);
    resumeClock();
    G.idx++;
    if (G.idx < G.words.length) renderMagnet(); else finish();
  }

  $('#mOpts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) magnetAnswer(b); });
  $('#mFeed').addEventListener('click', (e) => { if (e.target.closest('#mNext')) magnetNext(); });
  document.addEventListener('keydown', (e) => {
    if (G?.mode !== 'magnet' || !$('#game').classList.contains('active')) return;
    if (e.key === 'Enter' || e.key === ' ') { if (G.card?.answered) { e.preventDefault(); magnetNext(); } return; }
    const n = parseInt(e.key, 10);
    const btns = $$('#mOpts button');
    if (n >= 1 && n <= btns.length) magnetAnswer(btns[n - 1]);
  });

  // ---------- Pád! (arcade) ----------
  const PAD_LETTERS = { n: 'nom', g: 'gen', d: 'dat', a: 'acc', l: 'loc', i: 'ins' };
  let padRAF = null;
  function stopPad() {
    cancelAnimationFrame(padRAF); padRAF = null;
    if (G?.pad) G.pad.running = false;
  }

  function startPad() {
    $$('#padField .drop').forEach((e) => e.remove());
    $('#padLanes').innerHTML = CASES.map((c, i) => `<button class="lane c-${c.k}" data-ck="${c.k}" aria-label="${c.name}">
        <span class="mk">${i + 1}</span><b class="full">${c.name}</b><b class="abbr">${c.abbr}</b></button>`).join('');
    G.pad = { items: [], lives: 3, caught: 0, level: 1, speed: 0.12, spawnEvery: 2.6, sinceSpawn: 2.2, last: performance.now(), running: true, ni: 0, over: false, paused: false, freezing: false };
    $('#padOverlay').hidden = true; $('#padMsg').classList.remove('show'); $('#padPause').textContent = '⏸';
    renderLives(); renderHud(); padBanner('Level 1');
    padRAF = requestAnimationFrame(padTick);
  }

  function renderLives() {
    const P = G.pad;
    $('#hudCard').textContent = '❤'.repeat(Math.max(0, P.lives)) || '–';
  }
  function padBanner(text) {
    const b = $('#padLevel'); b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  function padSpawn() {
    const P = G.pad, field = $('#padField');
    const noun = G.words[P.ni++ % G.words.length];
    const card = buildCard(noun);
    const cell = card.cells[rand(card.cells.length)];
    const valid = new Set(card.cells.filter((c) => c.main === cell.main).map((c) => c.ck));
    const el = document.createElement('div');
    el.className = 'drop';
    el.innerHTML = `<span class="dform">${cell.main}</span><span class="dlemma">${card.title}</span>`;
    field.appendChild(el);
    const maxX = Math.max(0, field.clientWidth - el.offsetWidth - 8);
    const item = { el, cell, valid, noun, x: 4 + Math.random() * maxX, y: -el.offsetHeight, h: el.offsetHeight };
    el.style.transform = `translate(${item.x}px, ${item.y}px)`;
    P.items.push(item);
  }

  function padTarget() {
    const P = G.pad;
    let best = null;
    for (const it of P.items) if (!it.done && (!best || it.y > best.y)) best = it;
    return best;
  }

  function padTick(now) {
    const P = G?.pad; if (!P || !P.running) return;
    const dt = Math.min(0.05, (now - P.last) / 1000); P.last = now;
    // end of the short freeze after a miss
    if (P.freezing && now >= P.freezeUntil && !P.paused && !P.over) {
      P.freezing = false; $('#padMsg').classList.remove('show'); resumeClock();
    }
    if (!document.hidden && !P.paused && !P.freezing) {
      const H = $('#padField').clientHeight;
      P.sinceSpawn += dt;
      if (P.sinceSpawn >= P.spawnEvery && P.items.filter((i) => !i.done).length < 6) { P.sinceSpawn = 0; padSpawn(); }
      for (const it of P.items) {
        if (it.done) continue;
        it.y += P.speed * H * dt;
        it.el.style.transform = `translate(${it.x}px, ${it.y}px)`;
        if (it.y + it.h >= H) padLand(it);
      }
      const t = padTarget();
      for (const it of P.items) it.el.classList.toggle('target', it === t);
    }
    padRAF = requestAnimationFrame(padTick);
  }

  const caseNames = (set) => CASES.filter((c) => set.has(c.k)).map((c) => c.name).join(' / ');
  function padRemove(it, cls) {
    it.done = true;
    it.el.classList.add(cls);
    setTimeout(() => it.el.remove(), 450);
    G.pad.items = G.pad.items.filter((x) => x !== it);
  }

  function padAnswer(ck) {
    const P = G?.pad; if (!P || !P.running || P.paused || P.freezing) return;
    const it = padTarget(); if (!it) return;
    const lane = $(`.lane[data-ck="${ck}"]`);
    lane?.classList.remove('hit'); void lane?.offsetWidth; lane?.classList.add('hit');
    const r = it.el.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    if (it.valid.has(ck)) {
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.right++;
      const pts = Math.round(10 * mult());
      G.score += pts;
      statBump(it.noun, ck, it.cell.num, true);
      floater(`+${pts}`, x, y); sfx.good(G.combo);
      padRemove(it, 'caught');
      P.caught++;
      if (P.caught % 8 === 0) {
        P.level++; P.speed *= 1.13; P.spawnEvery = Math.max(0.85, P.spawnEvery * 0.88);
        padBanner(`Level ${P.level}!`); sfx.multi();
      }
      if (P.caught % 15 === 0 && P.lives < 5) { P.lives++; renderLives(); floater('+❤', x, y - 40, true); }
      renderHud();
    } else {
      padMiss(it, x, y, ck);
    }
  }

  function padMiss(it, x, y, wrongCk) {
    const P = G.pad;
    G.combo = 0; G.wrong++;
    const home = it.cell.ck;
    G.caseMiss[home] = (G.caseMiss[home] || 0) + 1;
    statBump(it.noun, home, it.cell.num, false);
    sfx.bad();
    // freeze for a moment and show the answer big, so it can actually be read (clock stops too)
    const chips = CASES.filter((c) => it.valid.has(c.k)).map((c) => `<span class="lg c-${c.k}">${c.name}</span>`).join(' ');
    const meaning = `${it.noun.w}${it.noun.g ? ` = ${it.noun.g}` : ''}`;
    $('#padMsg').innerHTML = `<b>${it.cell.main}</b> <span class="eq">=</span> ${chips}
      <span class="pm-word">← ${meaning}</span>
      ${wrongCk ? `<small>nie ${CASES.find((c) => c.k === wrongCk).name}</small>` : '<small>spadlo! · it landed</small>'}`;
    $('#padMsg').classList.add('show');
    P.freezing = true; P.freezeUntil = performance.now() + 1600;
    pauseClock();
    if (wrongCk) $(`.lane[data-ck="${wrongCk}"]`)?.classList.add('shake');
    setTimeout(() => $$('.lane.shake').forEach((l) => l.classList.remove('shake')), 420);
    padRemove(it, 'bad');
    P.lives--; renderLives(); renderHud();
    const f = $('#padField'); f.classList.remove('hurt'); void f.offsetWidth; f.classList.add('hurt');
    if (P.lives <= 0 && !P.over) {
      P.over = true;
      padBanner('Koniec!');
      setTimeout(() => { stopPad(); finish(); }, 1100);
    }
  }
  function padLand(it) {
    const r = it.el.getBoundingClientRect();
    padMiss(it, r.left + r.width / 2, r.top);
  }

  function padPause(on) {
    const P = G?.pad; if (!P || !P.running || P.over) return;
    P.paused = on ?? !P.paused;
    $('#padOverlay').hidden = !P.paused;
    $('#padPause').textContent = P.paused ? '▶' : '⏸';
    if (P.paused) pauseClock();
    else if (!P.freezing) resumeClock();
  }
  $('#padPause').addEventListener('click', () => padPause());
  $('#padResume').addEventListener('click', () => padPause(false));

  $('#padLanes').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.lane'); if (!b) return;
    e.preventDefault();
    padAnswer(b.dataset.ck);
  });
  document.addEventListener('keydown', (e) => {
    if (G?.mode !== 'pad' || !$('#game').classList.contains('active') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'p' || (e.key === 'Escape' && G.pad?.paused)) { e.preventDefault(); padPause(e.key === 'Escape' ? false : undefined); return; }
    const n = parseInt(e.key, 10);
    const ck = n >= 1 && n <= 6 ? CASES[n - 1].k : PAD_LETTERS[e.key.toLowerCase()];
    if (ck) { e.preventDefault(); padAnswer(ck); }
  });

  // ---------- drag & tap ----------
  let drag = null;
  $('#tray').addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    e.preventDefault();
    drag = { el: t, ti: +t.dataset.t, x0: e.clientX, y0: e.clientY, ghost: null, over: null, id: e.pointerId };
    t.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (!drag.ghost && moved > 6) {
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.classList.add('ghost-tile'); drag.ghost.classList.remove('sel');
      document.body.appendChild(drag.ghost);
      drag.el.classList.add('dragging');
      sfx.pick();
    }
    if (drag.ghost) {
      drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell:not(.filled)');
      if (over !== drag.over) { drag.over?.classList.remove('over'); over?.classList.add('over'); drag.over = over; }
    }
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    d.over?.classList.remove('over');
    d.el.classList.remove('dragging');
    if (d.ghost) {
      d.ghost.remove();
      if (d.over && e.type === 'pointerup') attempt(d.ti, +d.over.dataset.i);
    } else if (e.type === 'pointerup') {
      // tap = select / deselect
      const was = G.sel === d.ti;
      $$('.tile.sel').forEach((t) => t.classList.remove('sel'));
      G.sel = was ? null : d.ti;
      if (!was) { d.el.classList.add('sel'); sfx.pick(); }
    }
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  $('#board').addEventListener('click', (e) => {
    const c = e.target.closest('.cell'); if (!c || G?.sel == null) return;
    attempt(G.sel, +c.dataset.i);
  });
  // keyboard: Enter/Space on a tile selects it (click event without pointer)
  $('#tray').addEventListener('keydown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    $$('.tile.sel').forEach((x) => x.classList.remove('sel'));
    G.sel = +t.dataset.t; t.classList.add('sel');
    $('.cell:not(.filled)')?.focus();
  });

  // ---------- results ----------
  function finish() {
    stopTimer(); stopPad();
    resumeClock();
    const ms = elapsed();
    const total = G.right + G.wrong;
    const acc = total ? G.right / total : 0;
    const stars = acc >= 0.95 && G.hints === 0 ? 3 : acc >= 0.8 ? 2 : 1;
    const xp = Math.max(5, Math.round(G.score / 5));
    const lvBefore = lvlOf(save.xp);
    save.xp += xp;
    const today = dayStr(), yest = dayStr(new Date(Date.now() - 864e5));
    if (save.lastDay !== today) { save.streak = save.lastDay === yest ? save.streak + 1 : 1; save.lastDay = today; }
    const k = bestKey(G.mode), record = G.score > (save.best[k] || 0);
    if (record) save.best[k] = G.score;
    persist();

    $('#resStars').innerHTML = [1, 2, 3].map((s) => `<span class="${s <= stars ? '' : 'off'}" style="animation-delay:${s * 150}ms">⭐</span>`).join('');
    $('#resTitle').textContent = record ? 'Nový rekord!' : ['', 'Ide to!', 'Dobre!', 'Bravo!'][stars];
    $('#resTitle').dataset.en = record ? 'New record!' : ['', 'Getting there!', 'Good!', 'Bravo!'][stars];
    $('#resScore').textContent = G.score;
    $('#resAcc').textContent = `${Math.round(acc * 100)}%`;
    $('#resCombo').textContent = G.maxCombo;
    $('#resTime').textContent = fmtTime(ms);
    $('#resXp').textContent = `+${xp} XP` + (lvlOf(save.xp) > lvBefore ? `  ·  Level ${lvlOf(save.xp)}! 🎉` : '');
    const miss = CASES.filter((c) => G.caseMiss[c.k]);
    $('#resCases').innerHTML = miss.map((c) => `<span class="lg c-${c.k}" data-en="${attr(`${c.en}: ${G.caseMiss[c.k]} mistake${G.caseMiss[c.k] > 1 ? 's' : ''}<span class="tip-q">${c.use}</span>`)}">${c.name} ×${G.caseMiss[c.k]}</span>`).join('');
    $('#resNote').textContent = miss.length
      ? 'Tieto pády ťa zradili. Nabudúce ich uvidíš viac.'
      : 'Bez jedinej chyby. Si stroj. 🤖';
    $('#resNote').dataset.en = miss.length
      ? 'These cases betrayed you. You\'ll see more of them next time.'
      : 'Not a single mistake. You\'re a machine. (<i>stroj</i> = machine, and also a declension pattern!)';
    show('results');
    renderTop();
    const [x, y] = centerOf($('#resStars'));
    if (stars === 3 || record) setTimeout(() => { confetti(x, y, 60); sfx.done(); }, 300);
  }
  $('#againBtn').addEventListener('click', () => startRound(G?.mode || 'smash'));
  $('#startSmash').addEventListener('click', () => startRound('smash'));
  $('#startGrid').addEventListener('click', () => startRound('grid'));
  $('#startMagnet').addEventListener('click', () => startRound('magnet'));
  $('#startPad').addEventListener('click', () => startRound('pad'));
  $('#mlevelSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    opts.mlevel = b.dataset.mlevel;
    $$('#mlevelSeg button').forEach((x) => x.classList.toggle('on', x === b));
    renderHome();
  });

  // ---------- translation tooltips ----------
  // Hover (mouse), keyboard focus, or long-press (touch) on anything with data-en.
  // Tiles and grid cells never carry data-en, so answers are never translated.
  const tip = $('#tip');
  let tipFor = null, lpTimer = null, lpStart = null, swallowClick = false, tipHideT = null;
  function showTip(el) {
    if (!el?.dataset.en) return;
    tipFor = el; clearTimeout(tipHideT);
    tip.innerHTML = el.dataset.en;
    tip.style.left = '0px'; tip.style.top = '0px';
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2;
    x = Math.max(12, Math.min(x, innerWidth - t.width - 12));
    let y = r.top - t.height - 10;
    if (y < 8) y = r.bottom + 10;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  }
  function hideTip() { tipFor = null; tip.classList.remove('show'); }
  window.hideTip = hideTip;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || drag) return;
    const el = e.target.closest('[data-en]');
    if (el && el !== tipFor) showTip(el);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !tipFor) return;
    if (!tipFor.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-en]');
    if (el && el.matches(':focus-visible')) {
      showTip(el);
      clearTimeout(tipHideT); tipHideT = setTimeout(() => { if (tipFor === el && !el.matches(':hover')) hideTip(); }, 2500);
    }
  });
  // never leave a tooltip hanging: any click or key press (other than Tab) clears it
  document.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Shift' && tipFor) hideTip(); }, true);
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && tipFor) hideTip(); }, true);
  document.addEventListener('focusout', hideTip);

  // touch: press and hold
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = e.target.closest('[data-en]');
    if (!el) { hideTip(); return; }
    lpStart = [e.clientX, e.clientY];
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => { swallowClick = true; showTip(el); navigator.vibrate?.(10); }, 420);
  });
  document.addEventListener('pointermove', (e) => {
    if (lpStart && Math.hypot(e.clientX - lpStart[0], e.clientY - lpStart[1]) > 10) { clearTimeout(lpTimer); lpStart = null; }
  });
  const endPress = () => {
    clearTimeout(lpTimer); lpStart = null;
    if (tipFor && swallowClick) { tipHideT = setTimeout(hideTip, 2200); }
  };
  document.addEventListener('pointerup', endPress);
  document.addEventListener('pointercancel', endPress);
  // a long-press shows the tip instead of pressing the button underneath
  document.addEventListener('click', (e) => {
    if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-en]')) e.preventDefault(); });
  addEventListener('scroll', hideTip, { passive: true });

  // ---------- shared API for learn.js ----------
  window.PADY = {
    CASES, PATTERNS, PATTERN_EN, GENDER_LABEL, GENDER_EN, caseTip, patternTip, attr, show,
    stats: () => save.stats,
    save: () => save, persist, award, sfx, confetti, floater, centerOf, renderTop, toast, adjForm,
    startRound: (mode) => startRound(mode),
    drill(mode, pattern) {
      opts.pattern = pattern;
      renderHome();
      startRound(mode);
    },
  };

  // ---------- boot ----------
  renderHome();
})();
