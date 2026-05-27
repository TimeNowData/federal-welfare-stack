/* Federal-Level Welfare Stack BETA — interactive logic
   - Loads static JSON, builds filters, renders cards/table,
   - Handles search/filter state, KPI counts, modal detail.
*/
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    all: [],
    expansion: [],
    initial: [],
    filtered: [],
    view: 'cards',
    q: '',
    filters: {
      agency: new Set(),
      need: new Set(),
      recipient: new Set(),
      mech: new Set(),
      stack: new Set(),
      flags: new Set(),
      batch: new Set(),
      verif: new Set(),
    },
  };

  // --- Theme ---
  function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    $('#themeToggle').addEventListener('click', () => {
      document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    });
  }

  // --- Load ---
  async function load() {
    const [progs, exp, init] = await Promise.all([
      fetch('data/programs.json').then(r => r.json()),
      fetch('data/expansion_batches.json').then(r => r.json()),
      fetch('data/initial_batches.json').then(r => r.json()),
    ]);
    state.all = progs;
    state.expansion = exp;
    state.initial = init;
  }

  // --- KPIs ---
  function renderKPIs() {
    const allMech = new Set();
    const allAgency = new Set();
    state.all.forEach(p => {
      p.benefit_mechanisms.forEach(m => allMech.add(m));
      allAgency.add(p.federal_agency);
    });
    $('#kpi-total').textContent = state.all.length;
    $('#kpi-direct').textContent = state.all.filter(p => p.direct_household_value).length;
    $('#kpi-state').textContent = state.all.filter(p => p.state_administered).length;
    $('#kpi-db').textContent = state.all.filter(p => p.links_to_state_database_candidate).length;
    $('#kpi-mech').textContent = allMech.size;
    $('#kpi-agencies').textContent = allAgency.size;
  }

  // --- Filter chip builders ---
  function unique(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }
  function countOccurrences(list, val) {
    return list.filter(v => v === val).length;
  }

  function buildChipFilter(key, containerId, items, options = {}) {
    const container = $(containerId);
    const counts = options.counts || {};
    container.innerHTML = '';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.filter = key;
      btn.dataset.value = item.value || item;
      const label = item.label || item;
      const count = counts[item.value || item] || 0;
      btn.innerHTML = `<span>${escapeHtml(label)}</span>` + (count > 0 ? `<span class="chip-c">${count}</span>` : '');
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        const set = state.filters[key];
        if (set.has(val)) { set.delete(val); btn.setAttribute('aria-pressed', 'false'); }
        else { set.add(val); btn.setAttribute('aria-pressed', 'true'); }
        applyFilters();
      });
      container.appendChild(btn);
    });
  }

  function renderFilters() {
    // Agencies
    const agencyCounts = {};
    state.all.forEach(p => { agencyCounts[p.federal_agency] = (agencyCounts[p.federal_agency] || 0) + 1; });
    const agencies = unique(state.all.map(p => p.federal_agency))
      .sort((a, b) => (agencyCounts[b] - agencyCounts[a]) || a.localeCompare(b));
    buildChipFilter('agency', '#filter-agency', agencies, { counts: agencyCounts });

    // Need categories — top 24 most common
    const needCounts = {};
    state.all.forEach(p => p.need_categories.forEach(c => { needCounts[c] = (needCounts[c] || 0) + 1; }));
    const needs = Object.keys(needCounts).sort((a,b) => needCounts[b] - needCounts[a]).slice(0, 24);
    buildChipFilter('need', '#filter-need', needs, { counts: needCounts });

    // Recipient types — top 20
    const recCounts = {};
    state.all.forEach(p => p.recipient_types.forEach(c => { recCounts[c] = (recCounts[c] || 0) + 1; }));
    const recs = Object.keys(recCounts).sort((a,b) => recCounts[b] - recCounts[a]).slice(0, 20);
    buildChipFilter('recipient', '#filter-recipient', recs, { counts: recCounts });

    // Mechanisms
    const mechCounts = {};
    state.all.forEach(p => p.benefit_mechanisms.forEach(m => { mechCounts[m] = (mechCounts[m] || 0) + 1; }));
    const mechs = Object.keys(mechCounts).sort((a,b) => mechCounts[b] - mechCounts[a]);
    buildChipFilter('mech', '#filter-mech', mechs, { counts: mechCounts });

    // Welfare-stack relationship — keyword tags rather than full sentences
    const stackTags = [
      'Categorical eligibility',
      'Gateway to other programs',
      'State block grant',
      'Tax expenditure',
      'Triggers Medicaid',
      'Triggers Medicare',
      'Co-located with',
      'Anchor program',
      'Insurance backstop',
    ];
    // Map each stackTag to a count of programs whose welfare_stack_relationship contains keywords
    const stackCounts = {};
    const matchStack = (p, tag) => {
      const s = p.welfare_stack_relationship.toLowerCase();
      const t = tag.toLowerCase();
      // simple keyword mapping
      const KW = {
        'categorical eligibility': 'categorical',
        'gateway to other programs': 'gateway',
        'state block grant': 'block grant',
        'tax expenditure': 'tax expenditure',
        'triggers medicaid': 'medicaid',
        'triggers medicare': 'medicare',
        'co-located with': 'co-located',
        'anchor program': 'anchor',
        'insurance backstop': 'insurance',
      };
      const needle = KW[t] || t;
      return s.includes(needle);
    };
    stackTags.forEach(tag => { stackCounts[tag] = state.all.filter(p => matchStack(p, tag)).length; });
    buildChipFilter('stack', '#filter-stack', stackTags.filter(t => stackCounts[t] > 0), { counts: stackCounts });
    // store matcher for applyFilters
    state._matchStack = matchStack;

    // Flags
    const flagDefs = [
      { value: 'direct_household_value', label: 'Direct household value' },
      { value: 'state_administered', label: 'State-administered' },
      { value: 'state_supplement_or_waiver_possible', label: 'State supplement/waiver possible' },
      { value: 'links_to_state_database_candidate', label: 'State database candidate' },
    ];
    const flagCounts = {};
    flagDefs.forEach(f => { flagCounts[f.value] = state.all.filter(p => p[f.value]).length; });
    buildChipFilter('flags', '#filter-flags', flagDefs, { counts: flagCounts });

    // Batches
    const batchCounts = {};
    state.all.forEach(p => { batchCounts[p.priority_batch] = (batchCounts[p.priority_batch] || 0) + 1; });
    const batches = Object.keys(batchCounts).sort((a,b) => {
      const na = parseInt((a.match(/\d+/)||[0])[0], 10);
      const nb = parseInt((b.match(/\d+/)||[0])[0], 10);
      return na - nb;
    });
    buildChipFilter('batch', '#filter-batch', batches, { counts: batchCounts });

    // Verification
    const verifCounts = {};
    state.all.forEach(p => {
      const v = p.verification_status.split('—')[0].trim() || p.verification_status;
      verifCounts[v] = (verifCounts[v] || 0) + 1;
    });
    const verifs = Object.keys(verifCounts);
    buildChipFilter('verif', '#filter-verif', verifs, { counts: verifCounts });
  }

  // --- Apply ---
  function programMatches(p) {
    const f = state.filters;
    if (f.agency.size && !f.agency.has(p.federal_agency)) return false;
    if (f.need.size && !p.need_categories.some(c => f.need.has(c))) return false;
    if (f.recipient.size && !p.recipient_types.some(c => f.recipient.has(c))) return false;
    if (f.mech.size && !p.benefit_mechanisms.some(m => f.mech.has(m))) return false;
    if (f.stack.size) {
      let ok = false;
      for (const tag of f.stack) {
        if (state._matchStack(p, tag)) { ok = true; break; }
      }
      if (!ok) return false;
    }
    if (f.flags.size) {
      for (const flag of f.flags) {
        if (!p[flag]) return false;
      }
    }
    if (f.batch.size && !f.batch.has(p.priority_batch)) return false;
    if (f.verif.size) {
      const v = p.verification_status.split('—')[0].trim() || p.verification_status;
      if (!f.verif.has(v)) return false;
    }
    if (state.q) {
      const q = state.q.toLowerCase();
      const blob = [
        p.program_name, p.federal_agency, p.subagency,
        p.welfare_stack_relationship, p.rationale,
        p.benefit_mechanism_raw,
        ...(p.need_categories || []),
        ...(p.recipient_types || []),
      ].join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }

  function activeFilterCount() {
    return Object.values(state.filters).reduce((s, set) => s + set.size, 0);
  }

  function applyFilters() {
    state.filtered = state.all.filter(programMatches);
    render();
    updateActiveBadge();
    updateGroupCounts();
  }

  function updateActiveBadge() {
    const n = activeFilterCount();
    const badge = $('#activeCount');
    if (n > 0) { badge.hidden = false; badge.textContent = n; } else { badge.hidden = true; }
  }

  function updateGroupCounts() {
    const m = {
      agency: '#cnt-agency', need: '#cnt-need', recipient: '#cnt-recipient',
      mech: '#cnt-mech', stack: '#cnt-stack', flags: '#cnt-flags',
      batch: '#cnt-batch', verif: '#cnt-verif'
    };
    for (const k in m) {
      const n = state.filters[k].size;
      const el = $(m[k]);
      if (el) el.textContent = n ? `${n} selected` : '';
    }
  }

  // --- Render ---
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function flagTags(p) {
    const tags = [];
    if (p.direct_household_value) tags.push('<span class="tag flag-dhv" title="Direct household value">DHV</span>');
    if (p.state_administered) tags.push('<span class="tag flag-state" title="State-administered">STATE</span>');
    if (p.links_to_state_database_candidate) tags.push('<span class="tag flag-db" title="State database candidate">DB</span>');
    return tags.join('');
  }

  function programCard(p) {
    const mechs = p.benefit_mechanisms.map(m => `<span class="tag mech">${escapeHtml(m)}</span>`).join('');
    return `
      <article class="card" data-id="${p.program_id}" tabindex="0" role="button" aria-label="${escapeHtml(p.program_name)}">
        <div class="card-top">
          <span class="card-id">#${String(p.program_id).padStart(2, '0')}</span>
          <span class="card-batch">${escapeHtml(p.priority_batch)}</span>
        </div>
        <h3>${escapeHtml(p.program_name)}</h3>
        <div class="card-agency">
          ${escapeHtml(p.federal_agency)}${p.subagency && p.subagency !== 'N/A' ? ` <span class="sub">· ${escapeHtml(p.subagency)}</span>` : ''}
        </div>
        <div class="card-mech">${mechs}</div>
        <p class="card-rationale">${escapeHtml(p.rationale)}</p>
        <div class="card-bottom">
          <div class="card-flags">${flagTags(p)}</div>
          <a href="${escapeHtml(p.official_source_url)}" class="card-source" target="_blank" rel="noopener" onclick="event.stopPropagation()">
            Source ↗
          </a>
        </div>
      </article>
    `;
  }

  function renderCards() {
    const root = $('#results');
    if (!state.filtered.length) {
      root.innerHTML = `
        <div class="empty">
          <h3>No programs match these filters</h3>
          <p>Adjust your search or clear filters to see more programs.</p>
        </div>`;
      return;
    }
    root.innerHTML = state.filtered.map(programCard).join('');
    root.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openModal(parseInt(card.dataset.id, 10)));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(parseInt(card.dataset.id, 10)); }
      });
    });
  }

  function renderTable() {
    const tb = $('#resultsTbody');
    if (!state.filtered.length) {
      tb.innerHTML = `<tr><td colspan="7" class="empty">No programs match these filters</td></tr>`;
      return;
    }
    tb.innerHTML = state.filtered.map(p => `
      <tr data-id="${p.program_id}">
        <td class="col-id">${String(p.program_id).padStart(2, '0')}</td>
        <td class="col-name">${escapeHtml(p.program_name)}<br><span class="agency-sub">${escapeHtml(p.federal_agency)}</span></td>
        <td>${escapeHtml(p.federal_agency)}</td>
        <td>${p.benefit_mechanisms.map(m => `<span class="tag mech">${escapeHtml(m)}</span>`).join(' ')}</td>
        <td>${escapeHtml(p.priority_batch)}</td>
        <td>${flagTags(p)}</td>
        <td><a href="${escapeHtml(p.official_source_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Source ↗</a></td>
      </tr>
    `).join('');
    tb.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => openModal(parseInt(tr.dataset.id, 10)));
    });
  }

  function render() {
    $('#resultCount').textContent =
      `${state.filtered.length} of ${state.all.length} programs`;
    if (state.view === 'cards') {
      $('#results').hidden = false;
      $('#resultsTable').hidden = true;
      renderCards();
    } else {
      $('#results').hidden = true;
      $('#resultsTable').hidden = false;
      renderTable();
    }
  }

  // --- Modal ---
  function openModal(id) {
    const p = state.all.find(x => x.program_id === id);
    if (!p) return;
    const content = $('#modal-content');
    const verif = p.verification_status || '';
    content.innerHTML = `
      <div class="modal-eyebrow">Program #${String(p.program_id).padStart(2, '0')} · ${escapeHtml(p.priority_batch)}</div>
      <h2 id="modal-title">${escapeHtml(p.program_name)}</h2>
      <div class="modal-agency">${escapeHtml(p.federal_agency)}${p.subagency && p.subagency !== 'N/A' ? ` · ${escapeHtml(p.subagency)}` : ''}</div>

      <dl class="modal-meta">
        <dt>Mechanism</dt>
        <dd>${p.benefit_mechanisms.map(m => `<span class="tag mech">${escapeHtml(m)}</span>`).join(' ')}
          <div style="margin-top:6px; color:hsl(var(--ink-muted)); font-size:12.5px;">${escapeHtml(p.benefit_mechanism_raw)}</div>
        </dd>
        <dt>Need categories</dt>
        <dd>${p.need_categories.map(c => `<span class="tag">${escapeHtml(c)}</span>`).join(' ')}</dd>
        <dt>Recipients</dt>
        <dd>${p.recipient_types.map(c => `<span class="tag">${escapeHtml(c)}</span>`).join(' ')}</dd>
        <dt>Flags</dt>
        <dd>
          <span class="tag ${p.direct_household_value ? 'flag-dhv' : ''}">${p.direct_household_value ? '✓' : '○'} Direct household value</span>
          <span class="tag ${p.state_administered ? 'flag-state' : ''}">${p.state_administered ? '✓' : '○'} State-administered</span>
          <span class="tag ${p.state_supplement_or_waiver_possible ? 'flag-state' : ''}">${p.state_supplement_or_waiver_possible ? '✓' : '○'} State supplement/waiver possible</span>
          <span class="tag ${p.links_to_state_database_candidate ? 'flag-db' : ''}">${p.links_to_state_database_candidate ? '✓' : '○'} State database candidate</span>
        </dd>
      </dl>

      <div class="modal-section">
        <h3>Welfare-stack relationship</h3>
        <p>${escapeHtml(p.welfare_stack_relationship)}</p>
      </div>

      <div class="modal-section">
        <h3>Rationale for inclusion</h3>
        <p>${escapeHtml(p.rationale)}</p>
      </div>

      <div class="modal-section">
        <h3>Official source</h3>
        <a class="modal-source" href="${escapeHtml(p.official_source_url)}" target="_blank" rel="noopener">
          ${escapeHtml(p.official_source_url)} ↗
        </a>
        <p style="margin-top:10px; font-size:12.5px; color:hsl(var(--ink-muted));">
          <strong style="color:hsl(var(--ok));">${escapeHtml(verif)}</strong>
        </p>
      </div>
    `;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
  }

  // --- Expansion / initial-batch panels ---
  function renderExpansion() {
    const root = $('#expansion-grid');
    root.innerHTML = state.expansion.map(b => `
      <div class="exp-card">
        <div class="exp-card-head">
          <span class="exp-code">BATCH ${escapeHtml(b.code)}</span>
          <span class="exp-est">${escapeHtml(b.estimate)}</span>
        </div>
        <div class="exp-name">${escapeHtml(b.name)}</div>
        <p class="exp-focus">${escapeHtml(b.focus)}</p>
        ${b.examples && b.examples.length ? `
        <div class="exp-examples">
          <strong>Examples</strong>
          ${b.examples.map(e => escapeHtml(e)).join(' · ')}
        </div>` : ''}
      </div>
    `).join('');
  }

  function renderInitialBatches() {
    const root = $('#initial-grid');
    root.innerHTML = state.initial.map((b, i) => `
      <div class="batch-cell">
        <div class="batch-num">B${String(i + 1).padStart(2, '0')}</div>
        <div class="batch-name">${escapeHtml(b.name.replace(/^Batch \d+ — /, ''))}</div>
        <div class="batch-focus">${escapeHtml(b.focus)}</div>
        <div class="batch-count">${b.programs}</div>
      </div>
    `).join('');
  }

  // --- Wire up ---
  function wire() {
    const q = $('#q'); const clr = $('#clearQ');
    q.addEventListener('input', () => {
      state.q = q.value.trim();
      clr.hidden = !state.q;
      applyFilters();
    });
    clr.addEventListener('click', () => {
      q.value = ''; state.q = ''; clr.hidden = true; applyFilters(); q.focus();
    });

    $$('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.toggle-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.view = btn.dataset.view;
        render();
      });
    });

    $('#resetFilters').addEventListener('click', () => {
      Object.values(state.filters).forEach(set => set.clear());
      $$('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
      q.value = ''; state.q = ''; clr.hidden = true;
      applyFilters();
    });

    $('#filtersToggle').addEventListener('click', () => {
      const filters = $('#filters');
      const isHidden = filters.style.display === 'none';
      filters.style.display = isHidden ? '' : 'none';
      $('#filtersToggle').setAttribute('aria-expanded', String(isHidden));
    });

    $$('#modal [data-close]').forEach(el => el.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
    });
  }

  async function main() {
    initTheme();
    await load();
    renderKPIs();
    renderFilters();
    renderExpansion();
    renderInitialBatches();
    wire();
    state.filtered = state.all.slice();
    render();
    updateGroupCounts();
  }

  main().catch(err => {
    console.error(err);
    $('#results').innerHTML = `<div class="empty"><h3>Failed to load data</h3><p>${escapeHtml(err.message)}</p></div>`;
  });
})();
