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
  function renderHome() {
    const el = $('#journey'); if (!el) return;
    const s = P.save();
    const fresh = !s.placement && !Object.keys(s.srs || {}).length;
    if (fresh) {
      el.innerHTML = `<article class="mode big start-card">
        <div><div class="mode-tag" data-en="<b>začni tu</b> = start here">Začni tu</div>
        <h2 data-en="Let's work out what you know">Čo už vieš?</h2>
        <p>Answer a few quick examples (about 3 minutes). PÁDY works out your level and starts your path in the right place.</p></div>
        <button class="btn go" data-go="start" data-en="Start the quick check">Poďme na to →</button>
      </article>`;
      return;
    }
    const due = E.dueKeys().length;
    const u = E.currentUnit();
    const m = Math.round(E.unitMastery(u) * 100);
    const n = E.UNITS.indexOf(u) + 1;
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
    runSession({ title: 'Dnešná dávka', titleEn: "Today's dose", items: E.buildDose(12), mode: 'dose' });
  }
  function startUnit(u, step) {
    const names = { practice: ['Precvič', 'Practise'], write: ['Napíš', 'Write'], test: ['Test', 'Test: 80% to complete the unit'] };
    runSession({ title: `${E.UNITS.indexOf(u) + 1}. ${names[step][0]}`, titleEn: names[step][1], items: E.buildUnitSession(u, step), mode: 'unit', unit: u, step });
  }
  function startColor() {
    const items = []; for (let i = 0; i < 6; i++) items.push({ kind: 'color', key: null, sent: D.sents[Math.floor(Math.random() * D.sents.length)] });
    runSession({ title: 'Vyfarbi vetu', titleEn: 'Colour the sentence', items, mode: 'color' });
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
    if (it.kind === 'color') colorSelect(firstOpenTarget());
  }

  // the word you're working with always shows its meaning inline (hover is for interface labels only)
  const lemmaChip = (n, num) => `<span class="chip ghost">${esc(n.w)}${num ? ` · ${num === 's' ? 'sg' : 'pl'}` : ''}</span>${n.g ? ` <span class="gl">${esc(n.g)}</span>` : ''}`;
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

  function renderItem(it) {
    const tag = (sk, en) => `<div class="trtask" data-en="${attr(en)}">${sk}</div>`;
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
    if (it.kind === 'verb') return { good: it.vx.cases.map((l) => LETTER_CK[l]).includes(ans) };
    if (it.kind === 'vform') return { good: ans === it.z.f };
    return { good: false };
  }

  function answer(ans, btn) {
    const it = T.cur; if (!it || T.answered || it.kind === 'color') return;
    if (it.type === 'type' && !norm(ans)) return;
    T.answered = true;
    const { good, almost } = judge(it, ans);
    record(it, good);
    // mark buttons
    if (btn) {
      $$('#trCard .tropt, #trCard .trcase').forEach((b) => {
        const v = b.dataset.ans ?? b.dataset.ck;
        const isRight = judge(it, v).good;
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
    if (it.kind === 'noun') {
      say = it.answer;
      if (it.type === 'pickCase') {
        body = `<b>${esc(it.answer)}</b> = ${[...it.valid].map((k) => caseChip(k)).join(' ')}`;
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
    fb.className = `trfeed show ${good ? (almost ? 'almost' : 'ok') : 'no'}`;
    fb.innerHTML = `<div class="mrule"><span class="mres">${good ? (almost ? 'Takmer!' : 'Správne!') : 'Ups!'}</span> ${body}</div>
      <div class="trfeed-actions">${say ? sayBtn(say) : ''}<button class="btn small go" id="trNext" data-en="next (Enter)">Ďalej →</button></div>`;
    clearTimeout(T.auto);
    if (good && !almost && it.kind !== 'verb') T.auto = setTimeout(next, 1300);
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
  function colorAnswer(ck) {
    const it = T.cur; if (!it || it.kind !== 'color' || T.answered) return;
    const i = it.sel ?? firstOpenTarget(); if (i == null) return;
    const right = LETTER_CK[it.sent[i][1]];
    const good = ck === right;
    it.marks[i] = ck;
    const b = $(`#trCard .ctok[data-i="${i}"]`);
    b.classList.remove('sel'); b.classList.add(`c-${good ? ck : right}`, good ? 'cok' : 'cbad');
    if (!good) b.dataset.was = CASES[CI[ck]].abbr;
    if (good) { T.right++; P.sfx.good(T.right); } else { T.wrong++; P.sfx.bad(); }
    const nxt = firstOpenTarget();
    if (nxt != null) { colorSelect(nxt); return; }
    // done: summary
    T.answered = true;
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
      <ul class="cwords">${rows}</ul></div>
      <div class="trfeed-actions">${sayBtn(text)}<button class="btn small go" id="trNext">Ďalej →</button></div>`;
  }

  // ---------- events ----------
  $('#trCard').addEventListener('click', (e) => {
    const o = e.target.closest('.tropt'); if (o) return answer(o.dataset.ans, o);
    const c = e.target.closest('.trcase');
    if (c) { if (T.cur.kind === 'color') return colorAnswer(c.dataset.ck); return answer(c.dataset.ck, c); }
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
      if (passed) { E.setUnitDone(T.unit.id); xp += 30; headline = 'Lekcia hotová!'; note = `Unit ${E.UNITS.indexOf(T.unit) + 1} complete. The next one is open on your path.`; }
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
        ${T.mode === 'color' ? '<button class="btn go" id="trAgain">Ešte raz</button>' : ''}
        <button class="btn ghost" data-go="home">Domov</button>
      </div></div>`;
    $('#trAgain')?.addEventListener('click', startColor);
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
      if (b.dataset.lvl === '0') { showPlacementResult(E.applyPlacement([]), true); return; }
      PL = { tier: 0, results: [] };
      runPlacementTier();
      return;
    }
    if (e.target.closest('#plTest')) { PL = { tier: 0, results: [] }; runPlacementTier(); }
    if (e.target.closest('#plGo')) P.show('path');
  });
  function runPlacementTier() {
    const items = E.tierItems(E.TIERS[PL.tier], 4).map((it) => ({ ...it, tier: PL.tier }));
    if (!T || T.mode !== 'place') runSession({ title: 'Začni tu', titleEn: 'Start here: quick level check', items, mode: 'place', back: 'home' });
    else { T.items.push(...items); renderTrain(); }
  }
  function placementNext() {
    // end of a tier: evaluate
    const tierLog = T.log.filter((l) => l.tier === PL.tier);
    const right = tierLog.filter((l) => l.good).length;
    PL.results.push({ tier: PL.tier, right, total: tierLog.length, items: tierLog });
    const pass = right / tierLog.length >= 0.75;
    if (pass && PL.tier < E.TIERS.length - 1) { PL.tier++; runPlacementTier(); return; }
    const passed = E.applyPlacement(PL.results);
    P.award(10 + T.right * 2);
    T = null;
    PL.finished = true;
    P.show('start');
    showPlacementResult(passed, false);
  }
  const LEVELS = [
    ['Začiatočník', 'Beginner: we start from the very first case.'],
    ['Základy máš', 'You have the basics: nominative, accusative and locative singular.'],
    ['Mierne pokročilý', 'Lower intermediate: all singular cases are there.'],
    ['Pokročilý', 'Intermediate: the plural is mostly there too.'],
    ['Výborne!', 'Advanced: even the genitive plural. Time for the verbs.'],
    ['Majster pádov', 'Master of cases. The daily dose will keep it sharp.'],
  ];
  function showPlacementResult(passed, skipped) {
    const u = E.currentUnit();
    const [lvl, lvlEn] = LEVELS[Math.min(passed, LEVELS.length - 1)];
    $('#startBody').innerHTML = `
      <div class="start-result">
        <div class="mode-tag" data-en="your level">Tvoja úroveň</div>
        <h2 data-en="${attr(lvlEn)}">${lvl}</h2>
        <p>${lvlEn}</p>
        ${skipped ? '' : `<div class="tierbars">${E.TIERS.map((t, i) => {
          const r = PL?.results.find((x) => x.tier === i);
          return `<div class="tierbar ${r ? (r.right / r.total >= 0.75 ? 'pass' : 'fail') : 'na'}" data-en="${attr(r ? `${r.right}/${r.total} right` : 'not tested')}"><span>${i + 1}</span></div>`;
        }).join('')}</div>`}
        <div class="start-next">
          <span data-en="your path starts here">Tvoja cesta začína tu:</span>
          <b><span class="unit-no">${E.UNITS.indexOf(u) + 1}</span> ${esc(u.sk)}</b>
          <small>${esc(u.en)}</small>
        </div>
        ${mapHtml(true)}
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

  let openUnit = null;
  function renderPath() {
    const cur = E.currentUnit();
    if (openUnit == null) openUnit = cur.id;
    const due = E.dueKeys().length;
    const units = E.UNITS.map((u, i) => {
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
      ${mapHtml(false)}
      <h3 class="sec" data-en="<b>moje slová</b> = my words: words you added from Hľadaj. They come up in your daily dose.">Moje slová</h3>
      <div class="mywords">${mine.length ? mine.map((w) => `<span class="myw"><b>${esc(w.w)}</b> <small>${esc(w.g || '')}</small><button data-rm="${attr(w.id)}" aria-label="remove" data-en="remove">×</button></span>`).join('')
        : '<p class="weak-empty">Nothing yet. Look a word up in 🔍 Hľadaj and tap <b>＋ Moje slová</b>: it will come up in your daily dose.</p>'}</div>
      <p class="legend-note"><button class="link" data-go="start" data-en="Take the level check again">Znova otestovať úroveň</button></p>`;
  }
  $('#pathBody').addEventListener('click', (e) => {
    if (e.target.closest('#pathDose')) return startDose();
    const t = e.target.closest('[data-toggle]');
    if (t) { openUnit = openUnit === t.dataset.toggle ? '' : t.dataset.toggle; return renderPath(); }
    const st = e.target.closest('[data-step]');
    if (st) {
      const u = E.UNITS.find((x) => x.id === st.closest('[data-unit]').dataset.unit);
      if (st.dataset.step === 'learn') {
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
    render(id) {
      if (id === 'train') renderTrain();
      if (id === 'path') renderPath();
      if (id === 'start') { if (PL?.finished) PL.finished = false; else renderStart(); }
    },
  };
  renderHome();
})();
