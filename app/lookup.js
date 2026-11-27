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
    for (const [w, g, gen, forms, tb] of LK.nouns) {
      if (mainNouns.has(w)) continue;
      // tb: a table checked against two sources (Wiktionary + Ľ. Štúr Institute); otherwise fetched live when opened
      const t = tb ? { w, g, gen, s: tb[0], p: tb[1], alt: tb[2] || {}, checked: true, forms } : { w, g, gen, extra: true, forms };
      const all = new Set([w, ...forms]);
      if (tb) for (const f of [...tb[0], ...tb[1], ...Object.values(tb[2] || {}).flat()]) all.add(f);
      for (const f of all) add(f, { type: 'noun', noun: t });
    }
    // adjectives: complete tables
    for (const [w, g, forms] of LK.adjs) {
      const a = { w, g, f: Object.fromEntries(SLOTS.map((s, i) => [s, forms[i]])) };
      for (const f of new Set(forms)) add(f, { type: 'adj', adj: a });
    }
    // personal pronouns (mňa, mi, jeho, neho, ňom…)
    for (const p of window.PADYEngine?.PRONS || []) {
      const seen = new Set();
      for (const fs of Object.values(p.c)) for (const [f] of fs) if (!seen.has(f)) { seen.add(f); add(f, { type: 'pron', pron: p }); }
    }
    // verbs: infinitive, present/future, past (-l forms), imperative
    for (const [w, refl, g, asp, partner, pres, past, imp] of LK.verbs || []) {
      const v = { w, refl, g, asp, partner, pres, past, imp };
      const seen = new Set();
      const addV = (f) => { if (f && !seen.has(f)) { seen.add(f); add(f, { type: 'verb', verb: v }); } };
      addV(w); pres.forEach(addV); past.forEach(addV); (imp || []).forEach(addV);
    }
  }

  // ---------- verbs ----------
  const VPERS = () => P.PERSONS;
  const vname = (v) => (v.refl ? `${v.w} ${v.refl}` : v.w);
  const AUXV = ['som', 'si', '', 'sme', 'ste', ''];
  function verbMatches(v, f) {
    const out = [];
    if (f === v.w) out.push({ kind: 'inf' });
    v.pres.forEach((x, i) => { if (x === f) out.push({ kind: v.asp === 'pf' ? 'fut' : 'pres', pi: i }); });
    v.past.forEach((x, i) => { if (x === f) out.push({ kind: 'past', gi: i }); });
    (v.imp || []).forEach((x, i) => { if (x === f) out.push({ kind: 'imp', ii: i }); });
    return out;
  }
  const PAST_G = [['muž.', 'masculine'], ['žen.', 'feminine'], ['stred.', 'neuter'], ['množ.', 'plural']];
  const IMP_P = [['ty', 'you (one)'], ['my', "let's"], ['vy', 'you (several / polite)']];
  function verbChips(v, ms) {
    return ms.map((m) => {
      if (m.kind === 'inf') return `<span class="kchip vp" data-en="<b>neurčitok</b> = infinitive: the dictionary form">neurčitok</span>`;
      if (m.kind === 'pres' || m.kind === 'fut') {
        const p = VPERS()[m.pi];
        return `<span class="kchip ${m.kind === 'pres' ? 't-pres' : 't-fut'}" data-en="${attr(`<b>${p.sk}</b> (${p.en}), ${m.kind === 'pres' ? 'present tense' : 'future tense (perfective verb)'}`)}">${p.icon} ${p.sk} · ${m.kind === 'pres' ? 'prítomný' : 'budúci'}</span>`;
      }
      if (m.kind === 'past') {
        const who = m.gi === 3 ? 'my / vy / oni' : `ja / ty / ${['on', 'ona', 'ono'][m.gi]}`;
        return `<span class="kchip t-past" data-en="${attr(`past tense, ${PAST_G[m.gi][1]}: on its own for ${m.gi === 3 ? 'oni' : ['on', 'ona', 'ono'][m.gi]}; with <i>${m.gi === 3 ? 'sme / ste' : 'som / si'}</i> for ${m.gi === 3 ? 'my / vy' : 'ja / ty'}`)}">minulý · ${PAST_G[m.gi][0]} (${who})</span>`;
      }
      return `<span class="kchip vp" data-en="${attr(`<b>rozkazovací spôsob</b> = imperative (a command) for ${IMP_P[m.ii][1]}`)}">❗ rozkaz · ${IMP_P[m.ii][0]}</span>`;
    }).join('');
  }
  function verbUse(v, ms) {
    const kinds = new Set(ms.map((m) => m.kind));
    const lines = [];
    if (kinds.has('pres')) lines.push(['t-pres', 'Prítomný čas', 'What is happening now, or happens usually.']);
    if (kinds.has('fut')) lines.push(['t-fut', 'Budúci čas', `<i>${vname(v)}</i> is perfective (one-off, completed), so this "present" form means the <b>future</b>: <i>${v.pres[0]}</i> = I will ${v.g.split(',')[0].replace(/^to /, '')} (and finish).`]);
    if (kinds.has('past')) lines.push(['t-past', 'Minulý čas', 'The -l form agrees with the subject\'s gender; add <i>som / si</i> (ja / ty) or <i>sme / ste</i> (my / vy). On its own for on / ona / ono / oni.']);
    if (kinds.has('imp')) lines.push(['vp', 'Rozkazovací spôsob', 'A command: do it!']);
    return lines.length ? `<div class="kuse">${lines.map(([cls, name, txt]) => `<div class="kuse-row ${cls}"><span class="lg ${cls}">${name}</span><span class="kuse-text">${txt}</span></div>`).join('')}</div>` : '';
  }
  function verbTable(v, f, ms) {
    const hit = (kind, pi, gi) => ms.some((m) => (m.kind === kind && (m.pi === pi)) || (kind === 'past' && m.kind === 'past' && m.gi === gi));
    const join = (...xs) => xs.filter(Boolean).join(' ');
    const simpleCls = v.asp === 'pf' ? 't-fut' : 't-pres';
    const showFut = v.asp !== 'pf';
    let h = `<div class="vtable${showFut ? ' with-fut' : ''}">
      <div></div>
      <div class="bh th ${simpleCls}" data-en="${v.asp === 'pf' ? 'future (perfective verb: no present)' : 'present tense'}">${v.asp === 'pf' ? 'Budúci' : 'Prítomný'}</div>
      <div class="bh th t-past" data-en="past tense, masculine subject">Minulý · muž.</div>
      <div class="bh th t-past" data-en="past tense, feminine subject">Minulý · žen.</div>
      ${showFut ? '<div class="bh th t-fut fcol" data-en="future: budem / budeš… + infinitive">Budúci</div>' : ''}`;
    const BUD = ['budem', 'budeš', 'bude', 'budeme', 'budete', 'budú'];
    VPERS().forEach((p, pi) => {
      const pl = pi >= 3;
      const pm = pl ? v.past[3] : v.past[0], pf = pl ? v.past[3] : v.past[1];
      h += `<div class="rl vp" data-en="${attr(`<b>${p.sk}</b> = ${p.en}`)}"><small>${p.icon}</small><span class="full">${p.sk}</span><span class="abbr">${p.abbr}</span></div>`;
      h += `<div class="lcell ${simpleCls}${ms.some((m) => (m.kind === 'pres' || m.kind === 'fut') && m.pi === pi) ? ' hit' : ''}">${join(v.pres[pi], v.refl)}</div>`;
      h += `<div class="lcell t-past${ms.some((m) => m.kind === 'past' && m.gi === (pl ? 3 : 0)) ? ' hit' : ''}">${join(pm, AUXV[pi], v.refl)}</div>`;
      h += `<div class="lcell t-past${ms.some((m) => m.kind === 'past' && m.gi === (pl ? 3 : 1)) ? ' hit' : ''}">${join(pf, AUXV[pi], v.refl)}</div>`;
      if (showFut) h += `<div class="lcell t-fut fcol">${join(BUD[pi], v.refl, v.w)}</div>`;
    });
    h += '</div>';
    if (v.imp?.some(Boolean)) {
      h += `<div class="vimp"><span class="lg vp" data-en="<b>rozkazovací spôsob</b> = imperative (commands)">❗ Rozkazovací</span>` +
        v.imp.map((x, i) => x ? `<span class="vimpf${ms.some((m) => m.kind === 'imp' && m.ii === i) ? ' hit' : ''}"><small>${IMP_P[i][0]}</small> ${join(x, v.refl)}!</span>` : '').join('') + '</div>';
    }
    if (v.past[2]) h += `<p class="legend-note">Neuter (<i>ono</i>): <b>${join(v.past[2], v.refl)}</b>. Past tense: the -l form + <i>som/si/sme/ste</i> for ja/ty/my/vy.</p>`;
    return h;
  }
  // which school model verb (vzor) this one follows, side by side with the model, and others like it
  function vzorBlock(v) {
    const Z = window.PADYVzory; if (!Z) return '';
    const k = Z.vzorOf(v); if (!k) return '';
    const open = `<button class="btn small ghost" data-vzor-open="${attr(k)}" data-en="all 14 model verbs in Ťahák (verb side)">Všetky vzory →</button>`;
    if (k === 'irr') {
      return `<div class="vzbox"><div class="vzhead"><span class="vz" data-en="<b>nepravidelné</b> = irregular">nepravidelné</span>
        <span class="vzhow">follows none of the 14 school models: learn it by heart</span></div>${open}</div>`;
    }
    const def = Z.BYK[k], m = Z.modelOf(k), type = Z.TYPES.find((t) => t.k === def.t);
    const key = (x) => `<span><small>ja</small> ${esc(x.pres[0])}</span><span><small>oni</small> ${esc(x.pres[5])}</span><span><small>on</small> ${esc(x.past[0])}</span>`;
    const same = (Z.members()[k] || []).filter((x) => x.w !== v.w && x.w !== k).slice(0, 10);
    return `<div class="vzbox">
      <div class="vzhead"><span class="vz" data-en="<b>vzor</b> = the model verb it conjugates like">vzor</span>
        <button class="vzname" data-vzor-open="${attr(k)}" data-en="${attr(`<b>${k}</b> = ${m?.g || ''}<span class="tip-q">tap: the model and every verb like it</span>`)}">${esc(k)}</button>
        ${type ? `<span class="lg t-pres" data-en="${attr(`present tense type: ${type.en}`)}">${type.sk}</span>` : ''}<span class="vzhow">${def.how}</span></div>
      ${v.w !== k && m ? `<div class="vzcmp"><div class="vzrow"><b>${esc(k)}</b>${key(m)}</div><div class="vzrow me"><b>${esc(vname(v))}</b>${key(v)}</div></div>` : ''}
      <p class="vzrule">${def.rule}</p>
      ${same.length ? `<div class="vzsame"><span class="opt-label sm" data-en="<b>rovnako</b> = the same way">Rovnako</span>${same.map((x) => `<button class="vzchip${x.common ? ' common' : ''}" data-q="${attr(x.w)}" data-en="${attr(`${x.g}`)}">${esc(x.w)}</button>`).join('')}</div>` : ''}
      ${open}</div>`;
  }
  function renderVerbCard(v, f, el) {
    const ms = verbMatches(v, f);
    const asp = P.ASPECT[v.asp];
    const aspChip = asp ? `<span class="chip ghost" data-en="${attr(asp[1])}">${asp[0]}</span>` : '';
    const partner = v.partner ? `<button class="chip ghost" data-q="${attr(v.partner)}" data-en="${attr(`aspect partner: tap to look up <b>${v.partner}</b>`)}">↔ ${esc(v.partner)}</button>` : '';
    el.innerHTML = cardHead(f, vname(v), 'sloveso', '<b>sloveso</b> = verb', aspChip + partner, v.g) +
      `<div class="kcan"><span class="kcan-label" data-en="<b>tento tvar je</b> = this form is">Tento tvar je</span>${verbChips(v, ms)}</div>` +
      verbUse(v, ms) + verbTable(v, f, ms) + vzorBlock(v) + exBlock(v.w);
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

  // real sentences with English (Tatoeba); the form is coloured by case when it can only be one
  function exBlock(w, word) {
    const E = window.PADYEngine; if (!E) return '';
    const list = E.exList(w); if (!list.length) return '';
    return `<div class="kex"><h4 data-en="<b>v praxi</b> = in real use: short sentences from Tatoeba, with English">V praxi</h4>${list.map((x) => E.exHtml(x, word)).join('')}</div>`;
  }

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
      (t.extra ? '<p class="legend-note">⚠ Table loaded live from Wiktionary and <b>not double-checked</b>: our second source (the Ľ. Štúr Institute) doesn\'t confirm it. Usually right, but trust it a little less.</p>'
        : t.checked ? '<p class="legend-note">✓ Checked: Wiktionary and the Ľ. Štúr Institute agree on this table.</p>' : '') + exBlock(t.w, t);
  }

  const PVAR = { S: ['krátky', 'short, unstressed: never first in the sentence, never after a preposition'], N: ['po predložke', 'after a preposition: k nemu, pre neho, s ňou'] };
  function renderPronCard(p, f, el) {
    const ms = [];
    CASES.forEach((c) => (p.c[c.k] || []).forEach(([form, v]) => { if (form === f) ms.push({ ck: c.k, v }); }));
    const chips = ms.map((m) => {
      const c = caseOf(m.ck), vv = PVAR[m.v];
      return `<span class="kchip c-${m.ck}" data-en="${attr(`<b>${c.name}</b> = ${c.en}${vv ? `<span class="tip-q">${vv[1]}</span>` : ''}<span class="tip-q"><i>${c.q}</i> = ${c.qEn}</span>`)}">${c.name}${vv ? ` · ${vv[0]}` : ''}</span>`;
    }).join('');
    const hit = new Set(ms.map((m) => m.ck));
    let t = '<div class="ltable ktable ponly">';
    CASES.forEach((c) => {
      t += `<div class="rl c-${c.k}" data-en="${attr(P.caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span><small>${c.q}</small></div>`;
      t += `<div class="lcell c-${c.k}${hit.has(c.k) ? ' hit' : ''}">${(p.c[c.k] || []).map(([form, v]) => `<span class="pf v-${v}"${PVAR[v] ? ` data-en="${attr(PVAR[v][1])}"` : ''}>${form === f ? `<b>${esc(form)}</b>` : esc(form)}</span>`).join('')}</div>`;
    });
    t += '</div>';
    el.innerHTML = cardHead(f, p.k, 'zámeno', '<b>osobné zámeno</b> = personal pronoun', '', p.en) +
      `<div class="kcan"><span class="kcan-label" data-en="<b>tento tvar môže byť</b> = this form can be">Tento tvar môže byť</span>${chips}</div>` +
      useBlock(ms.map((m) => ({ ck: m.ck, num: 's' }))) + t +
      '<p class="legend-note"><i>Italic</i> = short form (unstressed), <u>underlined</u> = after a preposition. All pronouns side by side: Ťahák → Zámená a čísla.</p>';
  }

  function renderAdjCard(a, f, el) {
    const m = adjMatches(a, f);
    cardWords.set(`adj:${a.w}`, { type: 'adj', w: a.w, g: a.g, f: a.f });
    el.innerHTML = cardHead(f, a.w, 'príd. meno', '<b>prídavné meno</b> = adjective: it agrees with its noun in gender, number and case', '', a.g, myBtn('adj', a.w)) +
      `<div class="kcan"><span class="kcan-label" data-en="<b>tento tvar môže byť</b> = this form can be">Tento tvar môže byť</span>${matchChips(m, true)}</div>` +
      useBlock(m) + adjTable(a, f) +
      '<p class="legend-note">Look at the noun it goes with: its gender and case decide which of these it is.</p>' + exBlock(a.w, a);
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
    $('#kDia').innerHTML = DIA.map((ch, i) => `<button type="button" tabindex="-1" data-ch="${ch}">${ch}<small class="kk">${P.diaKey(i)}</small></button>`).join('');
    $('#kDia').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      const i = $('#kInput'); i.focus();
      i.setRangeText(b.dataset.ch, i.selectionStart ?? i.value.length, i.selectionEnd ?? i.value.length, 'end');
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    let t = null;
    $('#kInput').addEventListener('input', () => {
      clearTimeout(t);
      renderSuggest($('#kInput').value);
      t = setTimeout(() => search($('#kInput').value, false), 220);
    });
    $('#kInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search($('#kInput').value, true); } });
    $('#lookup').addEventListener('click', (e) => {
      const s = e.target.closest('[data-q]');
      if (s) { $('#kInput').value = s.dataset.q; $('#kSuggest').innerHTML = ''; search(s.dataset.q, true); return; }
      const vz = e.target.closest('[data-vzor-open]'); if (vz) { window.PADYLearn?.openVzor(vz.dataset.vzorOpen); return; }
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

  // ---------- suggestions while typing (accent-free prefix: "cerst" -> čerstvý, čerstvých…) ----------
  let SORTED = null;   // bare (accent-free) forms, sorted, for prefix search
  const lemmaOf = (h) => h.noun?.w || h.adj?.w || h.verb?.w || h.pron?.k;
  function suggest(raw) {
    const b = bare(norm(raw));
    if (b.length < 2 || !BARE) return [];
    if (!SORTED) SORTED = [...BARE.keys()].sort();
    let lo = 0, hi = SORTED.length;   // first key >= b
    while (lo < hi) { const m = (lo + hi) >> 1; if (SORTED[m] < b) lo = m + 1; else hi = m; }
    const common = new Set([...D.nouns.map((n) => n.w), ...D.adjs.map((a) => a.w), ...(D.conj || []).map((v) => v.w)]);
    const byLemma = new Map();   // one suggestion per word: the lemma itself if it matches, else its shortest matching form
    for (let i = lo, seen = 0; i < SORTED.length && SORTED[i].startsWith(b) && seen < 600; i++, seen++) {
      for (const form of BARE.get(SORTED[i])) {
        for (const h of IDX.get(form) || []) {
          const lem = lemmaOf(h); if (!lem) continue;
          const cur = byLemma.get(lem), isLem = form === lem;
          if (!cur || (isLem && !cur.isLem) || (!cur.isLem && !isLem && form.length < cur.form.length)) byLemma.set(lem, { form, lem, isLem });
        }
      }
    }
    return [...byLemma.values()]
      .sort((x, y) => (common.has(y.lem) - common.has(x.lem)) || (x.form.length - y.form.length) || x.form.localeCompare(y.form))
      .slice(0, 8);
  }
  function renderSuggest(raw) {
    const el = $('#kSuggest'); if (!el) return;
    if (!IDX) { loadData().then(() => { if ($('#kInput').value === raw) renderSuggest(raw); }).catch(() => {}); return; }
    const list = suggest(raw);
    // nothing to suggest when the typed word is already complete and the only match
    if (list.length === 1 && bare(list[0].form) === bare(norm(raw))) { el.innerHTML = ''; return; }
    el.innerHTML = list.map((s) => `<button class="exchip sug" data-q="${attr(s.form)}">${esc(s.form)}${s.isLem ? '' : `<small>${esc(s.lem)}</small>`}</button>`).join('');
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
    let form = f, hits = IDX.get(f) || [], accentNote = '';
    // searching is accent-insensitive: "muz" finds "muž" straight away
    if (!hits.length) {
      const cands = [...(BARE.get(bare(f)) || [])];
      if (cands.length) {
        const isHead = (c) => (IDX.get(c) || []).some((h) => (h.noun?.w || h.adj?.w || h.verb?.w) === c);
        cands.sort((a, b) => (isHead(b) - isHead(a)) || ((IDX.get(b) || []).length - (IDX.get(a) || []).length));
        form = cands[0]; hits = IDX.get(form);
        const others = cands.slice(1, 6);
        accentNote = `<div class="kaccent"><span data-en="no accents typed: showing the match with accents">bez diakritiky:</span> <b>${esc(f)}</b> → <b>${esc(form)}</b>
          ${others.length ? `<span class="kcan-label" data-en="<b>alebo</b> = or">alebo</span>${others.map((s) => `<button class="exchip" data-q="${attr(s)}">${esc(s)}</button>`).join('')}` : ''}</div>`;
      }
    }
    // a half-typed word: let the suggestions do the talking; Enter takes the first one
    if (!hits.length) {
      const sug = suggest(raw);
      if (sug.length && !commit) { out.innerHTML = ''; return; }
      if (sug.length && commit) { $('#kInput').value = sug[0].form; $('#kSuggest').innerHTML = ''; return search(sug[0].form, true); }
    }
    if (commit) {
      $('#kSuggest').innerHTML = '';
      history.replaceState(null, '', `#hladaj/${encodeURIComponent(form)}`);
      if (hits.length) pushRecent(form);
    }
    if (!hits.length) {
      out.innerHTML = `<div class="kmiss"><p><b>${esc(f)}</b> isn't in the dictionary. It may be a number, or a word we don't have.</p>
           <a class="btn small ghost" href="https://en.wiktionary.org/wiki/${encodeURIComponent(f)}#Slovak" target="_blank" rel="noopener">Wiktionary ↗</a></div>`;
      renderRecent();
      return;
    }
    // one card per word (a form can belong to several words: noun + adjective, two nouns…)
    const seen = new Set(); const cards = [];
    for (const h of hits) {
      const key = h.type + '|' + (h.noun?.w || h.adj?.w || h.verb?.w || h.pron?.k);
      if (seen.has(key)) continue; seen.add(key); cards.push(h);
    }
    out.innerHTML = accentNote + (cards.length > 1 ? `<p class="kmany">This form fits <b>${cards.length}</b> words:</p>` : '') +
      cards.map((_, i) => `<article class="kcard" id="kc${i}"></article>`).join('');
    cards.forEach((h, i) => {
      const el = $(`#kc${i}`);
      if (h.type === 'adj') renderAdjCard(h.adj, form, el);
      else if (h.type === 'verb') renderVerbCard(h.verb, form, el);
      else if (h.type === 'pron') renderPronCard(h.pron, form, el);
      else renderNounCard(h.noun, form, el);
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
