/* PÁDY — Kto komu? Personal pronouns × case, in short everyday sentences.
   The sentences are written by hand (Claude): a noun subject (Mama, Peter, šéf…) so every person can be the object
   without turning reflexive (*Vidím ma), and an English cue that says WHO, so the only question is the case.
   Forms come from PADYEngine.PRONS (Wiktionary). Rules:
   - no preposition: the long and the short form are both right (mi / mne, ho / jeho); the n-form is wrong (*nemu);
   - after a preposition: the n-form where there is one (k nemu, s ňou); never the short form (*k mi);
   - k, s, v, z, od, pred, nad, pod get a vowel before mne / mnou / mňa: ku mne, so mnou, odo mňa, predo mnou. */
(() => {
  'use strict';
  const PERS = ['ja', 'ty', 'on', 'ona', 'my', 'vy', 'oni'];
  const EN_OBJ = { ja: 'me', ty: 'you', on: 'him', ona: 'her', my: 'us', vy: 'you all', oni: 'them' };
  const EN_POSS = { ja: 'my', ty: 'your', on: 'his', ona: 'her', my: 'our', vy: 'your (pl.)', oni: 'their' };
  const PCASES = ['gen', 'dat', 'acc', 'loc', 'ins'];
  // sk: ___ = the pronoun (with its preposition, if pr is set, written in front of the blank)
  // en: {o} = object pronoun, {p} = possessive
  const FRAMES = [
    // dative, no preposition
    { ck: 'dat', sk: 'Mama ___ pomáha.', en: 'Mum is helping {o}.' },
    { ck: 'dat', sk: 'Peter ___ volá každý večer.', en: 'Peter phones {o} every evening.' },
    { ck: 'dat', sk: 'Babka ___ dala darček.', en: 'Grandma gave {o} a present.' },
    { ck: 'dat', sk: 'Učiteľ ___ verí.', en: 'The teacher believes {o}.' },
    { ck: 'dat', sk: 'Lekár ___ nerozumie.', en: "The doctor doesn't understand {o}." },
    { ck: 'dat', sk: 'Šéf ___ poďakoval.', en: 'The boss thanked {o}.' },
    // dative after k
    { ck: 'dat', pr: 'k', sk: 'Mama ide ___.', en: 'Mum is going over to {o}.' },
    { ck: 'dat', pr: 'k', sk: 'Pes beží rovno ___.', en: 'The dog is running straight to {o}.' },
    // accusative, no preposition
    { ck: 'acc', sk: 'Mama ___ vidí.', en: 'Mum can see {o}.' },
    { ck: 'acc', sk: 'Peter ___ dobre pozná.', en: 'Peter knows {o} well.' },
    { ck: 'acc', sk: 'Babka ___ ľúbi.', en: 'Grandma loves {o}.' },
    { ck: 'acc', sk: 'Učiteľ ___ hľadá.', en: 'The teacher is looking for {o}.' },
    { ck: 'acc', sk: 'Šéf ___ pozval na večeru.', en: 'The boss invited {o} to dinner.' },
    { ck: 'acc', sk: 'Polícia ___ zastavila.', en: 'The police stopped {o}.' },
    // accusative after na, pre
    { ck: 'acc', pr: 'na', sk: 'Mama čaká ___.', en: 'Mum is waiting for {o}.' },
    { ck: 'acc', pr: 'pre', sk: 'Ten darček je ___.', en: 'That present is for {o}.' },
    { ck: 'acc', pr: 'na', sk: 'Peter stále myslí ___.', en: 'Peter keeps thinking about {o}.' },
    { ck: 'acc', pr: 'na', sk: 'Babka sa hnevá ___.', en: 'Grandma is angry with {o}.' },
    // genitive, no preposition
    { ck: 'gen', sk: 'Mama sa ___ bojí.', en: 'Mum is afraid of {o}.' },
    { ck: 'gen', sk: 'Turista sa ___ pýta na cestu.', en: 'The tourist is asking {o} the way.' },
    { ck: 'gen', sk: 'Dieťa sa ___ pevne drží.', en: 'The child is holding on tight to {o}.' },
    // genitive after od, bez, u, vedľa, okrem
    { ck: 'gen', pr: 'od', sk: 'Peter dostal list ___.', en: 'Peter got a letter from {o}.' },
    { ck: 'gen', pr: 'bez', sk: 'Mama nemôže žiť ___.', en: "Mum can't live without {o}." },
    { ck: 'gen', pr: 'u', sk: 'Peter je dnes ___.', en: 'Peter is at {p} place today.' },
    { ck: 'gen', pr: 'vedľa', sk: 'Babka sedí ___.', en: 'Grandma is sitting next to {o}.' },
    { ck: 'gen', pr: 'okrem', sk: 'Všetci sú tu ___.', en: 'Everyone is here except {o}.' },
    // locative (always after a preposition)
    { ck: 'loc', pr: 'o', sk: 'Mama hovorí ___.', en: 'Mum is talking about {o}.' },
    { ck: 'loc', pr: 'o', sk: 'Peter často sníva ___.', en: 'Peter often dreams about {o}.' },
    { ck: 'loc', pr: 'pri', sk: 'Babka stojí ___.', en: 'Grandma is standing beside {o}.' },
    { ck: 'loc', pr: 'na', sk: 'Všetko záleží ___.', en: 'Everything depends on {o}.' },
    // instrumental (after a preposition)
    { ck: 'ins', pr: 's', sk: 'Mama ide ___ do kina.', en: 'Mum is going to the cinema with {o}.' },
    { ck: 'ins', pr: 's', sk: 'Peter sa rád rozpráva ___.', en: 'Peter likes chatting with {o}.' },
    { ck: 'ins', pr: 's', sk: 'Šéf sa zajtra stretne ___.', en: 'The boss is meeting {o} tomorrow.' },
    { ck: 'ins', pr: 'za', sk: 'Babka sedí ___.', en: 'Grandma is sitting behind {o}.' },
    { ck: 'ins', pr: 'pred', sk: 'Pes leží ___.', en: 'The dog is lying in front of {o}.' },
    { ck: 'ins', pr: 'nad', sk: 'Lampa visí ___.', en: 'The lamp is hanging above {o}.' },
  ];
  const VOWEL_PR = { k: 'ku', s: 'so', v: 'vo', z: 'zo', od: 'odo', pred: 'predo', nad: 'nado', pod: 'podo' };
  // k mne -> ku mne, s mnou -> so mnou, od mňa -> odo mňa
  const prepFor = (pr, form) => (pr && /^mn/.test(form) && VOWEL_PR[pr]) || pr;

  const E = () => window.PADYEngine;
  const formsOf = (p, ck) => E().PRON[p].c[ck];   // [[form, 'L'|'S'|'N'], …]
  // the forms that are right in this frame
  function okForms(p, f) {
    const fs = formsOf(p, f.ck);
    if (f.pr) { const n = fs.filter(([, v]) => v === 'N'); return (n.length ? n : fs.filter(([, v]) => v === 'L')).map(([x]) => x); }
    return fs.filter(([, v]) => v !== 'N').map(([x]) => x);
  }
  // the form to show in a reading item: short where there is one (that's what you hear), n-form after a preposition
  function shownForm(p, f) {
    const ok = okForms(p, f), fs = formsOf(p, f.ck);
    if (!f.pr) return fs.find(([x, v]) => v === 'S' && ok.includes(x))?.[0] || ok[0];
    return ok[0];
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // wrong options: the mix-ups that really happen
  function options(p, f) {
    const ok = okForms(p, f), right = shownForm(p, f);
    const bad = new Set();
    const add = (x) => { if (x && !ok.includes(x)) bad.add(x); };
    const fs = formsOf(p, f.ck);
    // 1. the same case, wrong variant for this spot: *k mi, *k jemu / *pomáha nemu
    if (f.pr) fs.forEach(([x, v]) => { if (v !== 'N' || !fs.some(([, w]) => w === 'N')) add(x); });
    else fs.forEach(([x, v]) => { if (v === 'N') add(x); });
    // 2. the same person, a neighbouring case (ju / jej / nej / ňou)
    const near = { gen: ['acc', 'dat'], dat: ['acc', 'loc', 'gen'], acc: ['dat', 'gen'], loc: ['dat', 'ins'], ins: ['loc', 'dat'] }[f.ck];
    for (const ck of shuffle([...near])) for (const [x, v] of shuffle([...formsOf(p, ck)])) { if (bad.size >= 3) break; if (!f.pr || v !== 'S') add(x); }
    // 3. the same case, the person you'd confuse it with (mu ↔ jej, im ↔ ich)
    const twin = { on: 'ona', ona: 'on', oni: 'ona', my: 'vy', vy: 'my', ja: 'ty', ty: 'ja' }[p];
    if (bad.size < 3) okForms(twin, f).forEach(add);
    const opts = [right, ...[...bad].slice(0, 3)];
    return shuffle(opts);
  }

  // ---------- stats per person × case (+ 'p' after a preposition) ----------
  const cellOf = (p, f) => `${p}|${f.ck}${f.pr ? '|p' : ''}`;
  function stats() { const s = window.PADY.save(); s.pstats = s.pstats || {}; return s.pstats; }
  function record(cell, good) { const st = stats(); const c = st[cell] || [0, 0]; c[good ? 0 : 1]++; st[cell] = c; window.PADY.persist(); }
  // 0..1, or null when not tried yet
  function acc(p, ck) {
    const st = stats(); let r = 0, w = 0;
    for (const k of [`${p}|${ck}`, `${p}|${ck}|p`]) if (st[k]) { r += st[k][0]; w += st[k][1]; }
    return r + w ? r / (r + w) : null;
  }
  // weak and untried cells come up more
  function weight(p, f) { const c = stats()[cellOf(p, f)]; if (!c) return 1.2; const [r, w] = c; return (w + 1) / (r + w + 2) + 0.15; }

  // one item: kind 'pc' (pick the form), 'pct' (type it), 'prc' (read it: who + which case?)
  function makeItem(p, f, kind) {
    const c = stats()[cellOf(p, f)] || [0, 0];
    if (!kind) { const r = Math.random(); kind = r < 0.3 ? 'prc' : c[0] >= 2 && r < 0.55 ? 'pct' : 'pc'; }
    const it = { kind, key: null, p, f, ok: okForms(p, f), answer: shownForm(p, f), cell: cellOf(p, f) };
    if (kind === 'pc') it.options = options(p, f);
    if (kind === 'prc') {
      it.form = it.answer;
      // every listed person this exact form can be, in this case (ho = on, also ono; ich = oni, also ony)
      it.whoOk = new Set(PERS.filter((q) => okForms(q, f).includes(it.form) || formsOf(q, f.ck).some(([x]) => x === it.form)));
    }
    return it;
  }
  function build(n = 10, only) {
    const pool = [];
    for (const f of FRAMES) for (const p of PERS) { if (only && !(only.p ? p === only.p : true)) continue; if (only?.ck && f.ck !== only.ck) continue; pool.push([p, f]); }
    const items = [], used = new Map();
    // a single cell (ona · lokál) has only a few sentences: each may come twice, as a different exercise
    const maxUse = pool.length < n ? 2 : 1;
    n = Math.min(n, pool.length * maxUse);
    const onePerson = new Set(pool.map(([p]) => p)).size === 1;
    let guard = 0;
    while (items.length < n && guard++ < 1000) {
      let r = Math.random() * pool.reduce((a, [p, f]) => a + weight(p, f), 0), pick = pool[0];
      for (const x of pool) { r -= weight(...x); if (r <= 0) { pick = x; break; } }
      const id = `${pick[0]}|${FRAMES.indexOf(pick[1])}`;
      if ((used.get(id) || 0) >= maxUse) continue;
      const last = items[items.length - 1];
      // don't ask the same person twice in a row, or the same sentence back to back
      if (last && !onePerson && last.p === pick[0]) continue;
      if (last && last.f === pick[1] && pool.length > 1) continue;
      used.set(id, (used.get(id) || 0) + 1);
      items.push(makeItem(pick[0], pick[1], used.get(id) === 2 && last?.kind === 'pc' ? 'prc' : undefined));
    }
    return items;
  }
  // a few weak cells for the daily dose (only once you've used Kto komu?)
  function forDose(n = 2) {
    const st = stats(); if (!Object.keys(st).length) return [];
    const weak = Object.entries(st).filter(([, [r, w]]) => w > 0 && w / (r + w) > 0.25).map(([k]) => k);
    if (!weak.length) return [];
    const out = [];
    for (const cell of shuffle(weak).slice(0, n)) {
      const [p, ck, pp] = cell.split('|');
      const fs = FRAMES.filter((f) => f.ck === ck && !!f.pr === !!pp);
      if (fs.length) out.push(makeItem(p, fs[Math.floor(Math.random() * fs.length)], 'pc'));
    }
    return out;
  }
  const enOf = (p, f) => f.en.replace('{o}', `<b>${EN_OBJ[p]}</b>`).replace('{p}', `<b>${EN_POSS[p]}</b>`);
  // the sentence with the pronoun (and its preposition) in place
  function filled(f, form, html) {
    const pre = f.pr ? `${prepFor(f.pr, form)} ` : '';
    return html ? f.sk.replace('___', html(pre, form)) : f.sk.replace('___', pre + form);
  }

  // your pronoun × case map: tap a cell to drill just that one. Empty when nothing's been tried yet.
  function gridHtml(force) {
    if (!force && !Object.keys(stats()).length) return '';
    const P = window.PADY, CASES = P.CASES;
    const cls = (a) => (a == null ? 'kk-new' : a < 0.6 ? 'kk-bad' : a < 0.85 ? 'kk-mid' : 'kk-ok');
    let h = `<div class="kkg"><div></div>${PERS.map((p) => `<div class="kkh" data-en="${P.attr(EN_OBJ[p])}">${p}</div>`).join('')}`;
    for (const ck of PCASES) {
      const c = CASES.find((x) => x.k === ck);
      h += `<div class="kkr c-${ck}" data-en="${P.attr(P.caseTip(c))}">${c.abbr}</div>`;
      h += PERS.map((p) => {
        const a = acc(p, ck), f = E().PRON[p].c[ck].filter(([, v]) => v !== 'N').map(([x]) => x).join(' · ');
        return `<button class="kkc ${cls(a)}" onclick="window.PADYTrainer.startKtoKomu({p:'${p}',ck:'${ck}'})" data-en="${P.attr(`<b>${p}</b> · ${c.name}${a == null ? ' · not tried yet' : ` · ${Math.round(a * 100)}% right`}. Tap to drill it.`)}">${f}</button>`;
      }).join('');
    }
    return `${h}</div><p class="legend-note kk-legend"><span class="kkc kk-bad"></span> often wrong <span class="kkc kk-mid"></span> getting there <span class="kkc kk-ok"></span> solid <span class="kkc kk-new"></span> not tried. Tap a cell to drill just that one.</p>`;
  }

  window.PADYPron = { gridHtml, PERS, PCASES, FRAMES, EN_OBJ, okForms, shownForm, options, build, forDose, record, acc, stats, enOf, filled, prepFor, cellOf };
})();
