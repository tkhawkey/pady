/* PÁDY — Hľadaj (look up any form you see) */
(() => {
  'use strict';
  const P = window.PADY, D = window.PADY_DATA, L = window.PADYLearn;
  const $ = (s, r = document) => r.querySelector(s);
  const { CASES, attr } = P;
  const CI = Object.fromEntries(CASES.map((c, i) => [c.k, i]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const bare = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}]/gu, '');
  const DIA = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ĺ', 'ľ', 'ň', 'ó', 'ô', 'ŕ', 'š', 'ť', 'ú', 'ý', 'ž'];
  const NUM_SK = { s: 'sg', p: 'pl' };
  const NUM_EN = { s: 'singular', p: 'plural' };

  // ---------- data loading + index ----------
  let ready = null, IDX = null, BARE = null, SLOTS = null;
  function loadData() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      if (window.PADY_LOOKUP) return resolve();
      const s = document.createElement('script');
      s.src = 'lookup-data.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('lookup-data.js missing'));
      document.head.appendChild(s);
    }).then(buildIndex);
    return ready;
  }
  function add(form, entry) {
    const f = form.toLowerCase();
    if (!IDX.has(f)) IDX.set(f, []);
    IDX.get(f).push(entry);
    const b = bare(f);
    if (!BARE.has(b)) BARE.set(b, new Set());
    BARE.get(b).add(f);
  }
  function buildIndex() {
    IDX = new Map(); BARE = new Map();
    const LK = window.PADY_LOOKUP;
    SLOTS = LK.slots;
    const mainNouns = new Map();
    for (const n of [...D.models, ...D.nouns]) {
      if (mainNouns.has(n.w)) continue;
      const t = { w: n.w, g: n.g || P.PATTERN_EN[n.w]?.[0] || '', gen: n.gen, pat: n.pat || n.w, s: n.s, p: n.p, alt: n.alt || {} };
      mainNouns.set(n.w, t);
    }
    // nouns with full tables (game data)
    for (const t of mainNouns.values()) {
      const seen = new Set();
      CASES.forEach((c, ci) => ['s', 'p'].forEach((num) => {
        for (const f of [t[num][ci], ...(t.alt[`${c.k}_${num}`] || [])]) {
          const key = f + '|' + t.w;
          if (!seen.has(key)) { seen.add(key); add(f, { type: 'noun', noun: t }); }
        }
      }));
    }
    // other nouns: lemma + forms (the table is fetched when opened)
    for (const [w, g, gen, forms] of LK.nouns) {
      if (mainNouns.has(w)) continue;
      const t = { w, g, gen, extra: true, forms };
      for (const f of new Set([w, ...forms])) add(f, { type: 'noun', noun: t });
    }
    // adjectives: complete tables
    for (const [w, g, forms] of LK.adjs) {
      const a = { w, g, f: Object.fromEntries(SLOTS.map((s, i) => [s, forms[i]])) };
      for (const f of new Set(forms)) add(f, { type: 'adj', adj: a });
    }
  }

  // ---------- live noun tables from Wiktionary ----------
  const tableCache = new Map();
  async function fetchNounTable(t) {
    if (t.s) return t;
    if (tableCache.has(t.w)) return tableCache.get(t.w);
    const p = (async () => {
      const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(t.w)}`);
      if (!r.ok) throw new Error(r.status);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const h = doc.getElementById('Slovak');
      const sec = h?.closest('section') || doc;
      const table = sec.querySelector('table.inflection-table') || sec;
      const s = Array(6).fill(null), pl = Array(6).fill(null), alt = {};
      for (const el of table.querySelectorAll('[class*="-form-of"]')) {
        const m = [...el.classList].map((c) => c.match(/^(nom|gen|dat|acc|loc|ins)\|(s|p)-form-of$/)).find(Boolean);
        if (!m) continue;
        const form = el.textContent.trim().toLowerCase();
        const arr = m[2] === 's' ? s : pl, i = CI[m[1]];
        if (!arr[i]) arr[i] = form;
        else if (arr[i] !== form) (alt[`${m[1]}_${m[2]}`] = alt[`${m[1]}_${m[2]}`] || []).push(form);
      }
      if (s.some((x) => !x) || pl.some((x) => !x)) throw new Error('incomplete table');
      Object.assign(t, { s, p: pl, alt });
      return t;
    })();
    tableCache.set(t.w, p);
    p.catch(() => tableCache.delete(t.w));
    return p;
  }

  // ---------- matching ----------
  function nounMatches(t, f) {
    const out = [];
    CASES.forEach((c, ci) => ['s', 'p'].forEach((num) => {
      const all = [t[num][ci], ...(t.alt?.[`${c.k}_${num}`] || [])];
      if (all.includes(f)) out.push({ ck: c.k, num });
    }));
    return out;
  }
  const ADJ_LABEL = {
    m: 'm.', f: 'ž.', n: 's.', m_anim: 'm. živ.', m_inan: 'm. neživ.', vir: 'muži', nonvir: 'ostatné',
  };
  const ADJ_LABEL_EN = {
    m: 'masculine', f: 'feminine', n: 'neuter', m_anim: 'masculine animate', m_inan: 'masculine inanimate',
    vir: 'male persons', nonvir: 'everything else (women, things, animals)',
  };
  function adjMatches(a, f) {
    // group matching slots by case + number -> list of gender labels
    const groups = new Map();
    for (const s of SLOTS) {
      if (a.f[s] !== f) continue;
      const [num, ck, ...rest] = s.split('_');
      const g = rest.join('_') || 'all';
      const key = `${ck}|${num === 'sg' ? 's' : 'p'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(g);
    }
    return [...groups].map(([k, gs]) => { const [ck, num] = k.split('|'); return { ck, num, gs }; })
      .sort((x, y) => CI[x.ck] - CI[y.ck] || (x.num === y.num ? 0 : x.num === 's' ? -1 : 1));
  }

  // ---------- rendering ----------
  const caseOf = (ck) => CASES[CI[ck]];
  function useBlock(matches) {
    const cks = [...new Set(matches.map((m) => m.ck))];
    return `<div class="kuse">${cks.map((ck) => {
      const c = caseOf(ck);
      const preps = L.PREPS[ck] || [];
      return `<div class="kuse-row c-${ck}">
        <span class="lg c-${ck}" data-en="${attr(P.caseTip(c))}">${c.name}</span>
        <span class="kuse-text">${c.use}${preps.length ? `<span class="kpreps">${preps.map(([sk, en]) => `<span class="prep" data-en="${attr(en)}">${sk}</span>`).join('')}</span>` : ''}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function matchChips(matches, isAdj) {
    return matches.map((m) => {
      const c = caseOf(m.ck);
      const gs = isAdj && m.gs && !(m.gs.length === 1 && m.gs[0] === 'all')
        ? ` · ${m.gs.map((g) => ADJ_LABEL[g] || g).join('/')}` : '';
      const gsEn = isAdj && m.gs && !(m.gs.length === 1 && m.gs[0] === 'all')
        ? `, ${m.gs.map((g) => ADJ_LABEL_EN[g] || g).join(' / ')}` : '';
      return `<span class="kchip c-${m.ck}" data-en="${attr(`<b>${c.name}</b> ${NUM_EN[m.num]}${gsEn} = ${c.en}<span class="tip-q"><i>${c.q}</i> = ${c.qEn}</span>`)}">${c.name} ${NUM_SK[m.num]}${gs}</span>`;
    }).join('');
  }

  function nounTable(t, f) {
    const stem = L.stemOf(t.w);
    const hit = new Set(nounMatches(t, f).map((m) => `${m.ck}_${m.num}`));
    let h = `<div class="ltable ktable">
      <div></div><div class="bh" data-en="<b>singulár</b> = singular">Singulár</div><div class="bh" data-en="<b>plurál</b> = plural">Plurál</div>`;
    CASES.forEach((c, ci) => {
      h += `<div class="rl c-${c.k}" data-en="${attr(P.caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span><small>${c.q}</small></div>`;
      ['s', 'p'].forEach((num) => {
        const alts = t.alt?.[`${c.k}_${num}`] || [];
        h += `<div class="lcell c-${c.k}${hit.has(`${c.k}_${num}`) ? ' hit' : ''}">${L.fmt(t[num][ci], stem, false)}${alts.length ? `<span class="alt" data-en="${attr('also: ' + alts.join(', '))}">/${esc(alts[0])}</span>` : ''}</div>`;
      });
    });
    return h + '</div>';
  }

  function adjTable(a, f) {
    const stem = L.stemOf(a.w);
    const cell = (slot, extra = '') => {
      const form = a.f[slot];
      return `<div class="lcell${form === f ? ' hit' : ''}${extra}">${L.fmt(form, stem, false)}</div>`;
    };
    const cellPair = (s1, s2, l1, l2) => `<div class="lcell pair${a.f[s1] === f || a.f[s2] === f ? ' hit' : ''}">
        <span class="pp${a.f[s1] === f ? ' on' : ''}" data-en="${attr(ADJ_LABEL_EN[l1])}"><span>${L.fmt(a.f[s1], stem, false)}</span><small>${ADJ_LABEL[l1]}</small></span>
        <span class="pp${a.f[s2] === f ? ' on' : ''}" data-en="${attr(ADJ_LABEL_EN[l2])}"><span>${L.fmt(a.f[s2], stem, false)}</span><small>${ADJ_LABEL[l2]}</small></span></div>`;
    if (matchMedia('(max-width: 720px)').matches) return adjTableNarrow(a, f, cell, cellPair);
    let h = `<div class="atable">
      <div></div>
      <div class="bh span3" data-en="<b>singulár</b> = singular">Singulár</div>
      <div class="bh span2" data-en="<b>plurál</b> = plural">Plurál</div>
      <div></div>
      <div class="bh sub" data-en="masculine">muž.</div><div class="bh sub" data-en="feminine">žen.</div><div class="bh sub" data-en="neuter">stred.</div>
      <div class="bh sub" data-en="male persons (muži)">muži</div><div class="bh sub" data-en="everything else: women, things, animals">ostatné</div>`;
    CASES.forEach((c) => {
      h += `<div class="rl c-${c.k}" data-en="${attr(P.caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span></div>`;
      const k = c.k;
      h += `<div class="arow c-${k}">`;
      h += k === 'acc' ? cellPair('sg_acc_m_anim', 'sg_acc_m_inan', 'm_anim', 'm_inan') : cell(`sg_${k}_m`);
      h += cell(`sg_${k}_f`) + cell(`sg_${k}_n`);
      if (k === 'nom' || k === 'acc') h += cell(`pl_${k}_vir`) + cell(`pl_${k}_nonvir`);
      else h += cell(`pl_${k}`, ' span2');
      h += '</div>';
    });
    return h + '</div>';
  }

  // phones: singular (3 genders) and plural (2 columns) as two stacked tables
  function adjTableNarrow(a, f, cell, cellPair) {
    const rowLabel = (c) => `<div class="rl c-${c.k}" data-en="${attr(P.caseTip(c))}"><span class="abbr">${c.abbr}</span></div>`;
    let sg = `<h4 class="atitle" data-en="<b>singulár</b> = singular">Singulár</h4><div class="atable sg">
      <div></div><div class="bh sub" data-en="masculine">muž.</div><div class="bh sub" data-en="feminine">žen.</div><div class="bh sub" data-en="neuter">stred.</div>`;
    let pl = `<h4 class="atitle" data-en="<b>plurál</b> = plural">Plurál</h4><div class="atable pl">
      <div></div><div class="bh sub" data-en="male persons (muži)">muži</div><div class="bh sub" data-en="everything else: women, things, animals">ostatné</div>`;
    CASES.forEach((c) => {
      const k = c.k;
      sg += rowLabel(c) + `<div class="arow c-${k}">${k === 'acc' ? cellPair('sg_acc_m_anim', 'sg_acc_m_inan', 'm_anim', 'm_inan') : cell(`sg_${k}_m`)}${cell(`sg_${k}_f`)}${cell(`sg_${k}_n`)}</div>`;
      pl += rowLabel(c) + `<div class="arow c-${k}">${k === 'nom' || k === 'acc' ? cell(`pl_${k}_vir`) + cell(`pl_${k}_nonvir`) : cell(`pl_${k}`, ' span2')}</div>`;
    });
    return sg + '</div>' + pl + '</div>';
  }

  function myBtn(type, w) {
    const E = window.PADYEngine; if (!E) return '';
    const has = E.hasMyWord(type, w);
    return `<button class="mybtn${has ? ' on' : ''}" data-my="${attr(type + ':' + w)}" data-en="${attr(has ? 'In your words: it comes up in your daily dose' : 'Add to my words: it will come up in your daily dose')}">${has ? '✓ V mojich slovách' : '＋ Moje slová'}</button>`;
  }
  const sayBtn = (text) => (window.PADYEngine?.canSpeak() ? `<button class="say" data-say="${attr(text)}" aria-label="Vypočuť" data-en="listen">🔊</button>` : '');
  const cardWords = new Map();   // "type:word" -> entry to store when added

  function cardHead(f, lemma, posSk, posEn, chips, gloss, actions = '') {
    return `<header class="khead">
      <div class="kform">${esc(f)} ${sayBtn(f)}</div>
      ${actions ? `<div class="kactions">${actions}</div>` : ''}
      <div class="klemma">${f !== lemma ? `<span class="arrowto">tvar slova</span> ` : ''}<b>${esc(lemma)}</b>
        <span class="chip" data-en="${attr(posEn)}">${posSk}</span>${chips}</div>
      ${gloss ? `<div class="kgloss">${esc(gloss)}</div>` : ''}
    </header>`;
  }

  async function renderNounCard(t, f, el) {
    const genChip = `<span class="chip ghost" data-en="${attr(P.GENDER_EN[t.gen] || t.gen)}">${P.GENDER_LABEL[t.gen] || t.gen}</span>`;
    const patChip = t.pat && L.models[t.pat] ? `<button class="chip ghost link-pat" data-pat="${t.pat}" data-en="${attr(P.patternTip(t.pat) + '<span class="tip-q">Open this pattern in Ťahák</span>')}">vzor ${t.pat} →</button>` : '';
    const head = cardHead(f, t.w, 'podst. meno', '<b>podstatné meno</b> = noun', genChip + patChip, t.g);
    if (!t.s) {
      el.innerHTML = head + '<p class="kload">Načítavam tabuľku z Wiktionary…</p>';
      try { await fetchNounTable(t); }
      catch {
        el.innerHTML = head + `<p class="kload">Couldn't load the full table (offline?). Known forms: <i>${t.forms.map(esc).join(', ')}</i>.
          <a href="https://en.wiktionary.org/wiki/${encodeURIComponent(t.w)}#Slovak" target="_blank" rel="noopener">Open on Wiktionary ↗</a></p>`;
        return;
      }
    }
    const m = nounMatches(t, f);
    cardWords.set(`noun:${t.w}`, { type: 'noun', w: t.w, g: t.g, gen: t.gen, pat: t.pat, s: t.s, p: t.p, alt: t.alt || {} });
    el.innerHTML = cardHead(f, t.w, 'podst. meno', '<b>podstatné meno</b> = noun', genChip + patChip, t.g, myBtn('noun', t.w)) +
      `<div class="kcan"><span class="kcan-label" data-en="<b>tento tvar môže byť</b> = this form can be">Tento tvar môže byť</span>${matchChips(m, false)}</div>` +
      useBlock(m) + nounTable(t, f) +
      (t.extra ? '<p class="legend-note">Table loaded live from Wiktionary.</p>' : '');
  }

  function renderAdjCard(a, f, el) {
    const m = adjMatches(a, f);
    cardWords.set(`adj:${a.w}`, { type: 'adj', w: a.w, g: a.g, f: a.f });
    el.innerHTML = cardHead(f, a.w, 'príd. meno', '<b>prídavné meno</b> = adjective: it agrees with its noun in gender, number and case', '', a.g, myBtn('adj', a.w)) +
      `<div class="kcan"><span class="kcan-label" data-en="<b>tento tvar môže byť</b> = this form can be">Tento tvar môže byť</span>${matchChips(m, true)}</div>` +
      useBlock(m) + adjTable(a, f) +
      '<p class="legend-note">Look at the noun it goes with: its gender and case decide which of these it is.</p>';
  }

  // ---------- page ----------
  let q = '';
  function recent() { try { return JSON.parse(localStorage.getItem('pady.recent') || '[]'); } catch { return []; } }
  function pushRecent(w) {
    try { localStorage.setItem('pady.recent', JSON.stringify([w, ...recent().filter((x) => x !== w)].slice(0, 12))); } catch { /* ignore */ }
  }

  function renderShell() {
    const sc = $('#lookup');
    if (sc.dataset.built) return;
    sc.dataset.built = '1';
    $('#kDia').innerHTML = DIA.map((ch) => `<button type="button" tabindex="-1" data-ch="${ch}">${ch}</button>`).join('');
    $('#kDia').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      const i = $('#kInput'); i.focus();
      i.setRangeText(b.dataset.ch, i.selectionStart ?? i.value.length, i.selectionEnd ?? i.value.length, 'end');
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    let t = null;
    $('#kInput').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => search($('#kInput').value, false), 220); });
    $('#kInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search($('#kInput').value, true); } });
    $('#lookup').addEventListener('click', (e) => {
      const s = e.target.closest('[data-q]');
      if (s) { $('#kInput').value = s.dataset.q; search(s.dataset.q, true); return; }
      const p = e.target.closest('.link-pat');
      if (p) L.openPattern(p.dataset.pat);
      const my = e.target.closest('[data-my]');
      if (my) {
        const E = window.PADYEngine, id = my.dataset.my, [type, w] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
        if (E.hasMyWord(type, w)) E.removeMyWord(id); else if (cardWords.has(id)) { E.addMyWord(cardWords.get(id)); P.toast('Pridané do mojich slov ✓'); }
        my.outerHTML = myBtn(type, w);
      }
    });
  }

  function renderRecent() {
    const r = recent();
    $('#kRecent').innerHTML = r.length
      ? `<span class="kcan-label" data-en="<b>nedávno</b> = recently looked up">Nedávno</span>${r.map((w) => `<button class="exchip" data-q="${attr(w)}">${esc(w)}</button>`).join('')}`
      : '';
  }

  async function search(raw, commit) {
    const f = norm(raw);
    q = f;
    const out = $('#kOut');
    if (!f) { out.innerHTML = ''; renderRecent(); return; }
    try { await loadData(); } catch { out.innerHTML = '<p class="kload">The lookup dictionary (lookup-data.js) is missing.</p>'; return; }
    if (q !== f) return;   // a newer search started meanwhile
    const hits = IDX.get(f) || [];
    if (commit) {
      history.replaceState(null, '', `#hladaj/${encodeURIComponent(f)}`);
      if (hits.length) pushRecent(f);
    }
    if (!hits.length) {
      const sugg = [...(BARE.get(bare(f)) || [])].filter((x) => x !== f).slice(0, 6);
      out.innerHTML = sugg.length
        ? `<div class="kmiss"><span class="kcan-label" data-en="<b>mysleli ste</b> = did you mean">Mysleli ste</span>${sugg.map((s) => `<button class="exchip" data-q="${attr(s)}">${esc(s)}</button>`).join('')}</div>`
        : `<div class="kmiss"><p><b>${esc(f)}</b> isn't in the dictionary. It may be a verb, pronoun or number, or a noun/adjective we don't have.</p>
           <a class="btn small ghost" href="https://en.wiktionary.org/wiki/${encodeURIComponent(f)}#Slovak" target="_blank" rel="noopener">Wiktionary ↗</a></div>`;
      renderRecent();
      return;
    }
    // one card per word (a form can belong to several words: noun + adjective, two nouns…)
    const seen = new Set(); const cards = [];
    for (const h of hits) {
      const key = h.type + '|' + (h.noun?.w || h.adj?.w);
      if (seen.has(key)) continue; seen.add(key); cards.push(h);
    }
    out.innerHTML = (cards.length > 1 ? `<p class="kmany">This form fits <b>${cards.length}</b> words:</p>` : '') +
      cards.map((_, i) => `<article class="kcard" id="kc${i}"></article>`).join('');
    cards.forEach((h, i) => {
      const el = $(`#kc${i}`);
      if (h.type === 'adj') renderAdjCard(h.adj, f, el); else renderNounCard(h.noun, f, el);
    });
    renderRecent();
  }

  window.PADYLookup = {
    render() {
      renderShell(); renderRecent();
      const m = location.hash.match(/^#hladaj\/(.+)$/);
      if (m) { const w = decodeURIComponent(m[1]); $('#kInput').value = w; search(w, false); }
      setTimeout(() => $('#kInput').focus(), 50);
      loadData().catch(() => {});
    },
  };
  // open straight from a link like index.html#hladaj/čerstvých
  if (location.hash.startsWith('#hladaj')) setTimeout(() => P.show('lookup'), 0);
})();
