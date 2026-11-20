/* PÁDY — Ťahák (learning zone) */
(() => {
  'use strict';
  const P = window.PADY, D = window.PADY_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { CASES, attr } = P;
  const CK = CASES.map((c) => c.k);
  const LETTER = { G: 'gen', D: 'dat', A: 'acc', L: 'loc', I: 'ins' };

  const GROUPS = [
    { g: 'm', sk: 'Mužský rod', en: 'masculine', pats: ['chlap', 'hrdina', 'dub', 'stroj'] },
    { g: 'f', sk: 'Ženský rod', en: 'feminine', pats: ['žena', 'ulica', 'dlaň', 'kosť'] },
    { g: 'n', sk: 'Stredný rod', en: 'neuter', pats: ['mesto', 'srdce', 'vysvedčenie', 'dievča'] },
  ];

  // What to notice in each pattern. Every claim is visible in the model table on the same page.
  const TIPS = {
    chlap: [
      'Masculine <b>people</b>: accusative = genitive in singular <i>and</i> plural (<i>vidím chlapa, chlapov</i>).',
      'Dative and locative singular both end in <b>-ovi</b>.',
      'Nominative plural <b>-i</b> (<i>chlapi</i>); many words take <b>-ia</b> or <b>-ovia</b> instead (<i>otcovia, hrdinovia</i>).',
      'Instrumental plural <b>-mi</b> (<i>chlapmi</i>).',
    ],
    hrdina: [
      'Ends in <b>-a</b> like <i>žena</i>, but it is <b>masculine</b> (a man): <i>ten hrdina</i>.',
      'Genitive = accusative singular <b>-u</b> (<i>hrdinu</i>); dative/locative <b>-ovi</b>, like <i>chlap</i>.',
      'Plural is pure <i>chlap</i>-style: <b>-ovia, -ov, -om, -ov, -och</b>, then <b>-ami</b>.',
    ],
    dub: [
      'Masculine <b>things</b>: accusative = nominative (<i>vidím dub, duby</i>).',
      'Genitive singular is <b>-a</b> or <b>-u</b> and there is no rule: learn it with the word (<i>duba</i> but <i>domu</i>).',
      'Locative singular <b>-e</b> (sometimes <b>-u</b>: <i>o dome</i> but <i>v rohu</i>).',
      'Plural: <b>-y, -ov, -om, -y, -och, -mi/-ami</b>.',
    ],
    stroj: [
      'Like <i>dub</i>, but the stem ends in a <b>soft</b> consonant (j, ľ, ň, č, š, ž, c…).',
      'Soft means: locative <b>-i</b> (<i>o stroji</i>), nominative/accusative plural <b>-e</b> (<i>stroje</i>).',
      'Genitive singular <b>-a</b>, accusative = nominative.',
    ],
    žena: [
      'Feminine <b>-a</b> after a hard consonant. The most common pattern of all.',
      'Genitive singular = nominative plural = <b>-y</b> (<i>ženy</i>).',
      'Dative = locative singular <b>-e</b> (<i>žene</i>).',
      'Genitive plural has <b>no ending</b>, and the stem often changes: <i>žena → žien</i>, <i>izba → izieb</i>, <i>hora → hôr</i>.',
    ],
    ulica: [
      'Feminine <b>-a</b> after a <b>soft</b> consonant (c, č, š, ž, j, ľ…).',
      'Soft means <b>-e</b> where <i>žena</i> has -y (<i>ulice</i>), and <b>-i</b> in dative/locative (<i>ulici</i>).',
      'Plural dative/locative <b>-iam, -iach</b>. Genitive plural: no ending, long vowel (<i>ulíc</i>).',
    ],
    dlaň: [
      'Feminine, ending in a <b>consonant</b>. Genitive singular <b>-e</b> (<i>dlane</i>).',
      'Dative/locative <b>-i</b>, instrumental <b>-ou</b>; accusative = nominative.',
      'Plural <b>-e, -í, -iam, -e, -iach, -ami</b>.',
      'Don\'t confuse with <i>kosť</i>: check the genitive (-e or -i).',
    ],
    kosť: [
      'Feminine, ending in a consonant, but genitive singular <b>-i</b> (<i>kosti</i>).',
      'All words in <b>-osť</b> go here (<i>radosť, možnosť</i>), plus many like <i>vec, noc, reč</i>.',
      'Singular: <b>-i</b> everywhere except nominative/accusative and instrumental <b>-ou</b>.',
      'Plural <b>-i, -í, -iam, -i, -iach, -ami</b>.',
    ],
    mesto: [
      'Neuter <b>-o</b>. Accusative = nominative (singular and plural).',
      'Locative singular <b>-e</b> (<i>v meste</i>), nominative plural <b>-á/-a</b> (<i>mestá</i>).',
      'Genitive plural: <b>no ending</b> + stem change (<i>miest</i>, <i>slov</i>, <i>okien</i>).',
    ],
    srdce: [
      'Neuter <b>-e</b>. Accusative = nominative.',
      'Locative singular <b>-i</b> (<i>v srdci</i>), nominative plural <b>-ia</b> (<i>srdcia</i>).',
      'Genitive plural: no ending, often with a long vowel or inserted vowel (<i>sŕdc</i>).',
    ],
    vysvedčenie: [
      'Neuter <b>-ie</b>. Very regular. Thousands of verbal nouns (<i>stretnutie, učenie</i>).',
      'Locative singular and genitive plural are both <b>-í</b> (<i>vysvedčení</i>); instrumental singular <b>-ím</b>.',
      'Plural <b>-ia, -í, -iam, -ia, -iach, -iami</b>.',
    ],
    dievča: [
      'Neuter <b>-a/-ä</b> for <b>young beings</b> (<i>dievča, mača, kura</i>).',
      'Adds <b>-ť-</b> in the singular (<i>dievčaťa, dievčaťu</i>) and <b>-at-</b> in the plural (<i>dievčatá</i>).',
      'Some words have a second plural with <b>-enc-</b>: <i>dievčence, dievčeniec</i>.',
    ],
  };

  // Prepositions per case (with English)
  const PREPS = {
    nom: [],
    gen: [['bez', 'without'], ['do', 'into, to, until'], ['od', 'from (a person/point)'], ['z / zo', 'out of, from'], ['u', 'at someone\'s'], ['okolo', 'around'], ['počas', 'during'], ['podľa', 'according to'], ['vedľa', 'next to'], ['blízko', 'near']],
    dat: [['k / ku', 'towards, to'], ['proti', 'against'], ['vďaka', 'thanks to'], ['kvôli', 'because of'], ['napriek', 'despite'], ['oproti', 'opposite']],
    acc: [['pre', 'for'], ['cez', 'through, across'], ['na', 'onto (movement); for (time)'], ['za', 'for (in exchange); behind (movement)'], ['o', 'in (time): o týždeň; against'], ['v', 'on (a day): v pondelok'], ['pod / nad / pred / medzi', 'under / above / in front of / between (movement)']],
    loc: [['o', 'about'], ['v / vo', 'in'], ['na', 'on, at'], ['po', 'after; along, around'], ['pri', 'by, near']],
    ins: [['s / so', 'with'], ['za', 'behind'], ['nad', 'above'], ['pod', 'under'], ['pred', 'in front of; ago'], ['medzi', 'between']],
  };

  const models = Object.fromEntries(D.models.map((m) => [m.w, m]));
  const examplesFor = (p) => D.nouns.filter((n) => n.pat === p && n.w !== p).slice(0, 5);
  const countFor = (p) => D.nouns.filter((n) => n.pat === p).length;
  const patOfGroup = (p) => GROUPS.find((g) => g.pats.includes(p));

  // ---------- stem / ending highlighting ----------
  const stemOf = (w) => w.replace(/(ie|[aeiouyáéíóúýäô])$/, '');
  // spelling, not a stem change: ď ť ň ľ lose the háček before e / i (kosť → kosti, dlaň → dlani)
  const HARD = { 'ď': 'd', 'ť': 't', 'ň': 'n', 'ľ': 'l' };
  function split(form, stem) {
    const last = stem.slice(-1);
    if (HARD[last] && !form.startsWith(stem)) {
      const s2 = stem.slice(0, -1) + HARD[last];
      if (form.startsWith(s2) && /^[eiíé]/.test(form.slice(s2.length))) return { a: s2, b: form.slice(s2.length), changed: false };
    }
    let k = 0;
    while (k < form.length && k < stem.length && form[k] === stem[k]) k++;
    return { a: form.slice(0, k), b: form.slice(k), changed: k < stem.length };
  }
  const CHG_EN = attr('The stem itself changes here: a vowel is inserted, lengthened or dropped (<i>izba → izieb</i>, <i>mesto → miest</i>).');
  const ZERO_EN = attr('<b>∅</b> = zero ending: the bare stem, nothing added.');
  function fmt(form, stem, endOnly) {
    const { a, b, changed } = split(form, stem);
    if (endOnly && !changed) return b ? `<span class="end">-${b}</span>` : `<span class="zero" data-en="${ZERO_EN}">∅</span>`;
    if (changed) return `<span class="stem">${a}</span><span class="end chg" data-en="${CHG_EN}">${b}</span>`;
    return `<span class="stem">${a}</span>${b ? `<span class="end">${b}</span>` : `<span class="zero" data-en="${ZERO_EN}">∅</span>`}`;
  }

  // ---------- accuracy from game stats ----------
  function acc(pat, ck, num) {
    const s = P.stats()[`${pat}|${ck}_${num}`];
    if (!s || s[0] + s[1] < 3) return null;
    return { pct: Math.round((100 * s[0]) / (s[0] + s[1])), n: s[0] + s[1] };
  }
  const accClass = (a) => (!a ? '' : a.pct < 60 ? ' acc-bad' : a.pct < 85 ? ' acc-mid' : ' acc-good');

  // ---------- state ----------
  const S = { tab: 'vzory', pat: 'žena', word: null, endOnly: false, finder: [], col: { ck: 'gen', num: 'p' } };

  // ---------- weak spots ----------
  function renderWeak() {
    const rows = Object.entries(P.stats())
      .map(([k, s]) => ({ k, n: s[0] + s[1], pct: Math.round((100 * s[0]) / (s[0] + s[1])) }))
      .filter((r) => r.n >= 3 && r.pct < 85 && models[r.k.split('|')[0]])
      .sort((a, b) => a.pct - b.pct || b.n - a.n)
      .slice(0, 4);
    const el = $('#weakSpots');
    if (!rows.length) {
      el.innerHTML = `<span class="weak-title" data-en="<b>tvoje slabé miesta</b> = your weak spots">Tvoje slabé miesta</span>
        <span class="weak-empty">Play a few rounds and the cells you keep missing will show up here.</span>`;
      return;
    }
    el.innerHTML = `<span class="weak-title" data-en="<b>tvoje slabé miesta</b> = your weak spots. Tap one to open its pattern.">Tvoje slabé miesta</span>` +
      rows.map((r) => {
        const [pat, slot] = r.k.split('|');
        const [ck, num] = slot.split('_');
        const c = CASES.find((x) => x.k === ck);
        return `<button class="weak-chip c-${ck}" data-pat="${pat}" data-en="${attr(`pattern <b>${pat}</b>, ${c.en} ${num === 's' ? 'singular' : 'plural'}: ${r.pct}% right over ${r.n} tries`)}">
          <b>${pat}</b> · ${c.abbr} ${num === 's' ? 'sg' : 'pl'} <span>${r.pct}%</span></button>`;
      }).join('');
  }
  $('#weakSpots').addEventListener('click', (e) => {
    const b = e.target.closest('.weak-chip'); if (!b) return;
    S.pat = b.dataset.pat; S.word = null; setTab('vzory');
  });

  // ---------- tabs ----------
  function setTab(t) {
    S.tab = t;
    $$('#learnTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $$('.ltab').forEach((s) => { s.hidden = s.id !== `tab-${t}`; });
    ({ vzory: renderVzory, ktory: renderFinder, stlpec: renderColumn, pady: renderCases })[t]();
  }
  $('#learnTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });

  // ---------- Vzory ----------
  function caseTable(word, pat) {
    const stem = stemOf(word.w);
    let h = `<div class="ltable">
      <div></div><div class="bh" data-en="<b>singulár</b> = singular">Singulár</div><div class="bh" data-en="<b>plurál</b> = plural">Plurál</div>`;
    CASES.forEach((c, ci) => {
      h += `<div class="rl c-${c.k}" data-en="${attr(P.caseTip(c))}"><span class="full">${c.name}</span><span class="abbr">${c.abbr}</span><small>${c.q}</small></div>`;
      ['s', 'p'].forEach((num) => {
        const form = word[num][ci];
        const alts = (word.alt && word.alt[`${c.k}_${num}`]) || [];
        const a = acc(pat, c.k, num);
        const badge = a ? `<span class="accb" data-en="${attr(`Your accuracy on this cell for pattern ${pat}: ${a.pct}% over ${a.n} tries`)}">${a.pct}%</span>` : '';
        const altH = alts.length ? `<span class="alt" data-en="${attr('also possible: ' + alts.join(', '))}">/${alts[0]}</span>` : '';
        h += `<div class="lcell c-${c.k}${accClass(a)}">${fmt(form, stem, S.endOnly)}${altH}${badge}</div>`;
      });
    });
    return h + '</div>';
  }

  function renderVzory() {
    const pat = S.pat;
    const model = models[pat];
    const word = S.word || model;
    const g = patOfGroup(pat);
    const ex = examplesFor(pat);
    const n = countFor(pat);
    const picker = GROUPS.map((gr) => `
      <div class="pgroup">
        <span class="pgroup-label" data-en="<b>${gr.sk.toLowerCase()}</b> = ${gr.en}">${gr.sk}</span>
        ${gr.pats.map((p) => `<button class="pchip${p === pat ? ' on' : ''}" data-pat="${p}" data-en="${attr(P.patternTip(p))}">${p}</button>`).join('')}
      </div>`).join('');
    const exChips = [model, ...ex].map((w) => `<button class="exchip${w.w === word.w ? ' on' : ''}" data-w="${w.w}" data-en="${attr(w.g ? `<b>${w.w}</b> = ${w.g}` : `<b>${w.w}</b> = ${P.PATTERN_EN[pat][0]} (the model word)`)}">${w.w}</button>`).join('');
    $('#tab-vzory').innerHTML = `
      <div class="ppicker">${picker}</div>
      <article class="ppage">
        <header class="phead">
          <div>
            <h2><span class="vz" data-en="<b>vzor</b> = model / pattern">vzor</span> ${pat}</h2>
            <p class="prule">${P.PATTERN_EN[pat][0]} · model for ${P.PATTERN_EN[pat][1]}</p>
          </div>
          <span class="chip" data-en="${attr(P.GENDER_EN[model.gen])}">${P.GENDER_LABEL[model.gen]}</span>
        </header>
        <div class="pcontrols">
          <div class="exrow"><span class="opt-label sm" data-en="<b>príklady</b> = examples. Tap a word to see the same endings on it.">Príklady</span>${exChips}</div>
          <label class="toggle" data-en="<b>len koncovky</b> = endings only"><input type="checkbox" id="endOnly" ${S.endOnly ? 'checked' : ''}> Len koncovky</label>
        </div>
        ${caseTable(word, pat)}
        <div class="pfoot">
          <ul class="tips">${TIPS[pat].map((t) => `<li>${t}</li>`).join('')}</ul>
          <div class="drill">
            <span class="opt-label sm" data-en="<b>precvič</b> = practise (drill this pattern)">Precvič</span>
            <button class="btn small go" data-drill="smash" ${n ? '' : 'disabled'} data-en="Drag game with only ${pat}-pattern words">Rozbi to!</button>
            <button class="btn small go blue" data-drill="grid" ${n ? '' : 'disabled'} data-en="Typing game with only ${pat}-pattern words">Tabuľka</button>
            <span class="drill-n" data-en="${n} words in the game follow this pattern">${n} slov</span>
          </div>
        </div>
        <p class="legend-note"><span class="end">koncovka</span> = ending <span class="end chg">zmena</span> = stem changes <span class="zero">∅</span> = no ending</p>
      </article>`;
  }
  $('#tab-vzory').addEventListener('click', (e) => {
    const pc = e.target.closest('.pchip');
    if (pc) { S.pat = pc.dataset.pat; S.word = null; return renderVzory(); }
    const ex = e.target.closest('.exchip');
    if (ex) { S.word = models[ex.dataset.w] || D.nouns.find((n) => n.w === ex.dataset.w); return renderVzory(); }
    const dr = e.target.closest('[data-drill]');
    if (dr && !dr.disabled) P.drill(dr.dataset.drill, S.pat);
  });
  $('#tab-vzory').addEventListener('change', (e) => {
    if (e.target.id === 'endOnly') { S.endOnly = e.target.checked; renderVzory(); }
  });

  // ---------- Ktorý vzor? ----------
  const SOFT = 'ď ť ň ľ c dz č dž š ž j';
  const TREE = {
    start: {
      q: 'Aký je rod?', en: 'What gender is it?',
      hint: 'Not sure? A consonant at the end usually means masculine, <b>-a</b> feminine, <b>-o / -e / -ie</b> neuter. Exceptions: men in -a (<i>hrdina</i>), and some feminines ending in a consonant (<i>dlaň, kosť, vec, noc</i>).',
      opts: [['Mužský', 'masculine', 'm'], ['Ženský', 'feminine', 'f'], ['Stredný', 'neuter', 'n']],
    },
    m: {
      q: 'Čo to je?', en: 'What is it?',
      opts: [['osoba', 'a person', 'm_pers'], ['zviera', 'an animal', '=anim'], ['vec', 'a thing / idea', 'm_inan']],
    },
    m_pers: { q: 'Končí na -a?', en: 'Does it end in -a?', opts: [['áno', 'yes (hrdina, kolega)', '=hrdina'], ['nie', 'no (chlap, otec)', '=chlap']] },
    m_inan: {
      q: 'Aká je posledná spoluhláska?', en: 'What is the last consonant?',
      hint: `Soft consonants: <b>${SOFT}</b>.`,
      opts: [['mäkká', 'soft (stroj, čaj, kôň)', '=stroj'], ['iná', 'anything else (dub, dom, stôl)', '=dub']],
    },
    f: { q: 'Ako končí?', en: 'How does it end?', opts: [['na -a', 'in -a (žena, ulica)', 'f_a'], ['na spoluhlásku', 'in a consonant (dlaň, kosť)', 'f_c']] },
    f_a: {
      q: 'Aká spoluhláska je pred -a?', en: 'Which consonant comes before the -a?',
      hint: `Soft consonants: <b>${SOFT}</b>.`,
      opts: [['mäkká', 'soft (ulica, duša, stanica)', '=ulica'], ['iná', 'anything else (žena, škola, izba)', '=žena']],
    },
    f_c: {
      q: 'Ako končí genitív?', en: 'How does the genitive end?',
      hint: 'All <b>-osť</b> words go with <i>kosť</i>, and so do many in <b>-c, -č, -s</b> (<i>vec, noc, reč, os</i>). If you can, look up the genitive.',
      opts: [['-e', 'dlane, piesne, postele', '=dlaň'], ['-i', 'kosti, veci, radosti', '=kosť'], ['neviem', 'I don\'t know', '=f_unknown']],
    },
    n: {
      q: 'Ako končí?', en: 'How does it end?',
      opts: [['-o', 'mesto, auto, slovo', '=mesto'], ['-e', 'srdce, more, pole', '=srdce'], ['-ie', 'vysvedčenie, stretnutie', '=vysvedčenie'], ['-a / -ä (mláďa)', 'a young being: dievča, mača', '=dievča']],
    },
  };
  const RESULTS = {
    anim: { pats: ['chlap', 'dub', 'stroj'], note: 'Animals mix two patterns: <b>singular like <i>chlap</i></b> (<i>psa, psovi</i>), <b>plural like <i>dub</i></b> (hard) or <b><i>stroj</i></b> (soft): <i>psy, psov</i>.' },
    f_unknown: { pats: ['kosť', 'dlaň'], note: '<b>-osť</b> words are always <i>kosť</i>. For the rest, look up the genitive singular: <b>-i</b> → <i>kosť</i>, <b>-e</b> → <i>dlaň</i>.' },
  };

  function lookup(word) {
    const w = word.trim().toLowerCase();
    if (!w) return null;
    if (models[w]) return { word: models[w], pat: w };
    const n = D.nouns.find((x) => x.w === w);
    if (n) return { word: n, pat: n.pat };
    // an inflected form? search every cell of the model words, then the game words
    const has = (x) => x.s.includes(w) || x.p.includes(w) || Object.values(x.alt || {}).some((a) => a.includes(w));
    const m = D.models.find(has);
    if (m) return { word: m, pat: m.w, form: w };
    const hit = D.nouns.find(has);
    if (hit) return { word: hit, pat: hit.pat, form: w };
    return null;
  }

  function resultCard(pats, note) {
    return `<div class="fresult">
      ${note ? `<p class="fnote">${note}</p>` : ''}
      <div class="fpats">${pats.map((p) => {
        const m = models[p];
        return `<button class="fpat" data-open="${p}" data-en="${attr('Open the pattern page for ' + p)}">
          <span class="vz">vzor</span> <b>${p}</b>
          <span class="fmini">${m.s[0]} · ${m.s[1]} · ${m.p[0]} · ${m.p[1]}</span>
          <span class="fgo">otvor →</span></button>`;
      }).join('')}</div></div>`;
  }

  function renderFinder() {
    const path = S.finder;
    const node = TREE[path.length ? path[path.length - 1] : 'start'];
    let steps = '';
    let cur = 'start';
    const trail = [];
    for (const key of path) {
      const nd = TREE[cur];
      const opt = nd.opts.find((o) => o[2] === key || o[2] === '=' + key);
      trail.push(`<span class="crumb">${opt ? opt[0] : key}</span>`);
      cur = key;
    }
    const last = path[path.length - 1];
    const isResult = last && last.startsWith('=');
    if (isResult) {
      const id = last.slice(1);
      const r = RESULTS[id] || { pats: [id] };
      steps = resultCard(r.pats, r.note);
    } else {
      steps = `<div class="fq">
        <h3 data-en="${attr(node.en)}">${node.q}</h3>
        ${node.hint ? `<p class="fhint">${node.hint}</p>` : ''}
        <div class="fopts">${node.opts.map((o) => `<button class="fopt" data-next="${o[2]}" data-en="${attr(o[1])}"><b>${o[0]}</b><small>${o[1]}</small></button>`).join('')}</div>
      </div>`;
    }
    $('#tab-ktory').innerHTML = `
      <div class="fsearch">
        <label for="fInput" data-en="<b>napíš podstatné meno</b> = type a noun (any form)">Napíš podstatné meno</label>
        <input id="fInput" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="napr. hodina, stroja, ľudia…" value="${attr(S.fq || '')}">
        <div id="fSearchOut"></div>
      </div>
      <div class="fdivider" data-en="or answer three questions"><span>alebo</span></div>
      <div class="fwizard">
        ${trail.length ? `<div class="trail">${trail.join('<span class="arr">›</span>')}<button class="link" id="fReset" data-en="start again">znova</button></div>` : ''}
        ${steps}
      </div>`;
    runSearch();
  }
  function runSearch() {
    const out = $('#fSearchOut'); if (!out) return;
    const q = S.fq || '';
    if (!q.trim()) { out.innerHTML = ''; return; }
    const r = lookup(q);
    if (!r) { out.innerHTML = '<p class="fnone">Not in the game\'s word list. Answer the questions below instead.</p>'; return; }
    const gl = r.word.g || P.PATTERN_EN[r.pat]?.[0] || '';
    const formNote = r.form && r.form !== r.word.w ? `<i>${r.form}</i> is a form of <b>${r.word.w}</b> (${gl}). ` : `<b>${r.word.w}</b>${gl ? ` (${gl})` : ''}: `;
    out.innerHTML = resultCard([r.pat], `${formNote}${P.GENDER_EN[r.word.gen] || ''}`);
  }
  $('#tab-ktory').addEventListener('input', (e) => { if (e.target.id === 'fInput') { S.fq = e.target.value; runSearch(); } });
  $('#tab-ktory').addEventListener('click', (e) => {
    const o = e.target.closest('.fopt');
    if (o) { S.finder.push(o.dataset.next); return renderFinder(); }
    if (e.target.closest('#fReset')) { S.finder = []; return renderFinder(); }
    const p = e.target.closest('[data-open]');
    if (p) { S.pat = p.dataset.open; S.word = null; setTab('vzory'); }
  });

  // ---------- Stĺpec ----------
  function renderColumn() {
    const { ck, num } = S.col;
    const ci = CK.indexOf(ck);
    const c = CASES[ci];
    const caseChips = CASES.map((x) => `<button class="lg c-${x.k}${x.k === ck ? ' on' : ''}" data-ck="${x.k}" data-en="${attr(P.caseTip(x))}">${x.name}</button>`).join('');
    const rows = GROUPS.map((g) => `
      <div class="cgroup"><span class="pgroup-label" data-en="<b>${g.sk.toLowerCase()}</b> = ${g.en}">${g.sk}</span></div>
      ${g.pats.map((p) => {
        const m = models[p];
        const ex = examplesFor(p).slice(0, 2);
        const a = acc(p, ck, num);
        return `<button class="crow" data-open="${p}" data-en="${attr(P.patternTip(p))}">
          <span class="cpat">${p}</span>
          <span class="cform lcell c-${ck}${accClass(a)}">${fmt(m[num][ci], stemOf(m.w), false)}${a ? `<span class="accb">${a.pct}%</span>` : ''}</span>
          ${ex.map((w) => `<span class="cex c-${ck}">${fmt(w[num][ci], stemOf(w.w), false)}</span>`).join('')}
        </button>`;
      }).join('')}`).join('');
    $('#tab-stlpec').innerHTML = `
      <div class="ccontrols">
        <div class="legend cchips">${caseChips}</div>
        <div class="seg" id="colNum">
          <button data-num="s" class="${num === 's' ? 'on' : ''}" data-en="singular">Singulár</button>
          <button data-num="p" class="${num === 'p' ? 'on' : ''}" data-en="plural">Plurál</button>
        </div>
      </div>
      <h3 class="ctitle c-${ck}"><span>${c.name} ${num === 's' ? 'singulár' : 'plurál'}</span> <small>${c.q}</small></h3>
      <div class="ctable">${rows}</div>
      <p class="legend-note">Model word first, then two real words from the same pattern. Tap a row to open the pattern.</p>`;
  }
  $('#tab-stlpec').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ck]');
    if (b) { S.col.ck = b.dataset.ck; return renderColumn(); }
    const nb = e.target.closest('[data-num]');
    if (nb) { S.col.num = nb.dataset.num; return renderColumn(); }
    const r = e.target.closest('[data-open]');
    if (r) { S.pat = r.dataset.open; S.word = null; setTab('vzory'); }
  });

  // ---------- Pády ----------
  function verbsFor(ck) {
    const bare = [], prep = [];
    for (const v of D.verbs) {
      for (const f of v.fr) {
        if (LETTER[f.c] !== ck) continue;
        (f.p ? prep : bare).push({ v, f });
      }
    }
    bare.sort((a, b) => b.f.n - a.f.n);
    prep.sort((a, b) => b.f.n - a.f.n);
    // skip the hundreds of ordinary transitive verbs for accusative: show the most frequent only
    return { bare: bare.slice(0, 8), prep: prep.slice(0, 6) };
  }
  function renderCases() {
    $('#tab-pady').innerHTML = `<div class="cases">${CASES.map((c) => {
      const { bare, prep } = c.k === 'nom' ? { bare: [], prep: [] } : verbsFor(c.k);
      const ex = (bare[0] || prep[0])?.f.ex?.[0];
      const verbChip = ({ v, f }) => `<span class="vchip" data-en="${attr(`<b>${v.v}</b> = ${v.g}<span class="tip-q">${f.n}× in the corpus</span>`)}">${v.v}${f.p ? ` <b>${f.p}</b>` : ''}</span>`;
      return `<article class="casecard c-${c.k}">
        <header>
          <h3 data-en="${attr(`<b>${c.name}</b> = ${c.en}`)}">${c.name}</h3>
          <span class="cq" data-en="${attr(c.qEn)}">${c.q}</span>
        </header>
        <div class="cbody">
          <p class="cuse">${c.use}</p>
          ${PREPS[c.k].length ? `<h4 data-en="<b>predložky</b> = prepositions">Predložky</h4>
            <div class="chipline">${PREPS[c.k].map(([sk, en]) => `<span class="prep" data-en="${attr(en)}">${sk}</span>`).join('')}</div>` : ''}
          ${bare.length ? `<h4 data-en="<b>slovesá</b> = verbs that take this case directly">Slovesá + ${c.abbr}</h4>
            <div class="chipline">${bare.map(verbChip).join('')}</div>` : ''}
          ${prep.length ? `<h4 data-en="<b>slovesá s predložkou</b> = verbs + preposition + this case">Slovesá s predložkou</h4>
            <div class="chipline">${prep.map(verbChip).join('')}</div>` : ''}
          ${c.k === 'nom' ? `<p class="cex-s">The form in the dictionary, and the subject: <i><b>Žena</b> číta.</i> Also after <i>byť</i>: <i>To je <b>pes</b>.</i></p>` : ''}
          ${ex ? `<p class="cex-s" data-en="A real sentence from the Slovak treebank">„${ex}“</p>` : ''}
        </div>
      </article>`;
    }).join('')}</div>
    <p class="legend-note">Verbs and their counts come from real annotated Slovak text (UD treebank SNK).</p>`;
  }

  // ---------- public ----------
  window.PADYLearn = {
    render() { renderWeak(); setTab(S.tab); },
    // shared with the Hľadaj (lookup) page
    fmt, stemOf, PREPS, models,
    openPattern(p) { S.pat = p; S.word = null; S.tab = 'vzory'; P.show('learn'); },
  };
})();
