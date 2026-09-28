(function () {
  'use strict';

  const { all: questions, topics } = window.GAQuestions;
  const sources = window.GASources;
  const {
    loadState, saveState, recordResult, prioritySort, topicStats, buildReset, safeStorage,
  } = window.GACore;

  const HINTS = {
    'Plano cartesiano e coordenadas': 'Primeiro localize sinais, eixos e coordenadas. Não transforme desenho em hipótese: use apenas coordenadas e relações declaradas.',
    'Plano cartesiano e simetrias': 'Traduza a simetria em coordenadas. Antes de calcular, identifique qual coordenada muda de sinal — ou qual ponto funciona como centro da simetria.',
    'Distância entre dois pontos': 'Fixe a orientação: Δx_AB = x_B − x_A e Δy_AB = y_B − y_A. Só depois use d(A,B) = √(Δx² + Δy²).',
    'Razão, ponto médio, mediana e baricentro': 'Pergunte qual ponto precisa ser construído primeiro. Ponto médio usa a média das coordenadas; baricentro usa a média das coordenadas dos três vértices.',
    'Alinhamento, determinante e área': 'Monte o determinante com os três pontos. Determinante zero testa alinhamento; para área do triângulo, use metade do valor absoluto.',
    'Equação da reta e pertinência': 'Procure um ponto da reta e uma direção. Você pode chegar à forma geral Ax + By + C = 0 ou usar y − y₀ = m(x − x₀) quando o coeficiente angular estiver disponível.',
    'Coeficiente angular, paralelismo e perpendicularidade': 'Comece por m = Δy/Δx, mantendo a orientação escolhida. Paralelas têm o mesmo m; perpendiculares satisfazem m₁m₂ = −1 quando ambos existem.',
    'Posições relativas e interseções': 'Transforme a interseção em um sistema de equações. O ponto procurado precisa satisfazer simultaneamente as duas relações.',
    'Distância de ponto a reta': 'Coloque a reta em Ax + By + C = 0 e identifique P=(x₀,y₀). A ferramenta do caderno é |Ax₀+By₀+C|/√(A²+B²).',
    'Leitura de desigualdades no plano': 'Cada reta separa o plano em dois semiplanos. Use a fronteira e um ponto-teste para decidir qual desigualdade representa a região indicada.',
  };

  const $ = (id) => document.getElementById(id);
  const storage = safeStorage(window);
  let state = loadState(storage);
  let studyStep = 0;
  let activeId = state.activeQuestionId && window.GAQuestions.byId(state.activeQuestionId)
    ? state.activeQuestionId
    : prioritySort(questions, state)[0].id;

  function persist() {
    state.activeQuestionId = activeId;
    saveState(storage, state);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch]);
  }

  function currentQuestion() {
    return window.GAQuestions.byId(activeId) || questions[0];
  }

  function statusOf(question) {
    const result = state.results[question.id];
    if (!result) return 'unseen';
    if (!result.correct) return 'wrong';
    if (result.mastered) return 'mastered';
    return 'helped';
  }

  function statusLabel(status) {
    return ({ unseen:'não tentada', wrong:'erro recente', helped:'acerto com ajuda', mastered:'dominada' })[status] || status;
  }

  function statusIcon(status) {
    return ({ unseen:'○', wrong:'×', helped:'◐', mastered:'✓' })[status] || '○';
  }

  function draftFor(id) {
    if (!state.drafts[id]) state.drafts[id] = { dados:'', alvo:'', ferramenta:'', ledger:[], hintUsed:false };
    const draft = state.drafts[id];
    if (!Array.isArray(draft.ledger)) draft.ledger = [];
    return draft;
  }

  function filteredQuestions() {
    const source = $('source-filter').value;
    const topic = $('topic-filter').value;
    const status = $('status-filter').value;
    return prioritySort(questions.filter((q) =>
      (source === 'all' || q.source === source) &&
      (topic === 'all' || q.topic === topic) &&
      (status === 'all' || statusOf(q) === status)
    ), state);
  }

  function sourceTotal(source) {
    return questions.filter((q) => q.source === source).length;
  }

  function renderSessionProgress() {
    const q = currentQuestion();
    const total = sourceTotal(q.source);
    const percentage = total ? Math.max(0, Math.min(100, (q.number / total) * 100)) : 0;
    $('session-progress').style.width = `${percentage}%`;
  }

  function renderQueue() {
    const items = filteredQuestions();
    $('queue-count').textContent = String(items.length);
    const root = $('queue-list');
    root.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'Nenhuma questão corresponde aos filtros.';
      root.appendChild(empty);
      return;
    }
    items.slice(0, 24).forEach((q) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'queue-item' + (q.id === activeId ? ' active' : '');
      const st = statusOf(q);
      button.innerHTML = `<span class="queue-num">${q.source === 'lista2' ? 'L2' : 'L1'}·${q.number}</span><span class="queue-copy"><strong>${escapeHtml(q.topic)}</strong><small>Página ${q.page}</small></span><span class="queue-state" aria-label="${statusLabel(st)}">${statusIcon(st)}</span>`;
      button.addEventListener('click', () => selectQuestion(q.id));
      root.appendChild(button);
    });
  }

  function renderStats() {
    const attempted = questions.filter((q) => state.results[q.id]).length;
    const mastered = questions.filter((q) => state.results[q.id]?.mastered).length;
    $('overall-coverage').textContent = Math.round(attempted / questions.length * 100) + '%';
    $('overall-mastery').textContent = Math.round(mastered / questions.length * 100) + '%';
    const root = $('topic-stats');
    root.replaceChildren();
    for (const item of topicStats(questions, state)) {
      const row = document.createElement('div');
      row.className = 'topic-row';
      row.innerHTML = `<div class="topic-row-head"><strong>${escapeHtml(item.topic)}</strong><span>${item.mastered}/${item.total} · ${item.masteryPercent}%</span></div><div class="progress-track"><i style="width:${item.masteryPercent}%"></i></div>`;
      root.appendChild(row);
    }
  }

  function renderErrorLedger() {
    $('error-count').textContent = String(state.errors.length);
    const root = $('error-ledger');
    root.replaceChildren();
    if (!state.errors.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'Ainda vazio. Quando houver um erro, registre a causa — não só o resultado.';
      root.appendChild(empty);
      return;
    }
    [...state.errors].reverse().slice(0, 10).forEach((entry) => {
      const q = window.GAQuestions.byId(entry.questionId);
      const div = document.createElement('div');
      div.className = 'error-entry';
      div.innerHTML = `<strong>${q ? `${q.source === 'lista2' ? 'L2' : 'L1'} Q${q.number}` : escapeHtml(entry.questionId)} · ${escapeHtml(entry.type)}</strong><small>${entry.note ? escapeHtml(entry.note) : 'Sem nota adicional.'}</small>`;
      root.appendChild(div);
    });
  }

  function renderLedger() {
    const draft = draftFor(activeId);
    const root = $('ledger-list');
    root.replaceChildren();
    $('ledger-count').textContent = `${draft.ledger.length} ${draft.ledger.length === 1 ? 'item' : 'itens'}`;
    if (!draft.ledger.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-note';
      empty.textContent = 'Nenhum resultado calculado ainda.';
      root.appendChild(empty);
      return;
    }
    draft.ledger.forEach((value, index) => {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = value;
      const remove = document.createElement('button');
      remove.className = 'ledger-remove';
      remove.type = 'button';
      remove.textContent = 'remover';
      remove.addEventListener('click', () => {
        draft.ledger.splice(index, 1);
        persist();
        renderLedger();
      });
      li.append(text, remove);
      root.appendChild(li);
    });
  }

  function setStudyStep(nextStep, options = {}) {
    studyStep = Math.max(0, Math.min(3, Number(nextStep) || 0));
    document.querySelectorAll('[data-stage]').forEach((panel) => {
      const active = Number(panel.dataset.stage) === studyStep;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    document.querySelectorAll('#step-tabs [data-step]').forEach((button) => {
      const active = Number(button.dataset.step) === studyStep;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('step-indicator').textContent = `${studyStep + 1} / 4`;
    $('previous-step').disabled = studyStep === 0;
    $('previous-step').style.visibility = studyStep === 0 ? 'hidden' : 'visible';
    $('next-step').textContent = studyStep === 3 ? 'gabarito →' : 'continuar →';

    if (options.focus) {
      const focusIds = ['dados-input', 'alvo-input', 'ferramenta-input', 'ledger-input'];
      $(focusIds[studyStep])?.focus();
    }
  }

  function renderQuestion() {
    const q = currentQuestion();
    const draft = draftFor(q.id);
    $('question-source').textContent = q.source === 'lista2' ? 'Lista 2 · Reta' : 'Lista 1 · Coordenadas';
    $('question-topic').textContent = q.topic;
    $('question-status').textContent = statusLabel(statusOf(q));
    $('question-title').textContent = `Questão ${q.number}`;
    $('question-statement').textContent = q.statement;
    $('source-link').hidden = true;
    $('source-link').removeAttribute('href');
    $('source-page').textContent = `p. ${q.page} · fonte privada`;
    $('dados-input').value = draft.dados || '';
    $('alvo-input').value = draft.alvo || '';
    $('ferramenta-input').value = draft.ferramenta || '';
    renderLedger();
    renderSessionProgress();
    $('answer-panel').hidden = true;
    $('error-form').hidden = true;
    $('hint-panel').hidden = true;
    $('reset-panel').hidden = true;
    $('session-summary').hidden = true;
    setStudyStep(0);
  }

  function renderMode() {
    const exam = state.mode === 'exam';
    document.body.classList.toggle('exam-mode', exam);
    $('mode-toggle').setAttribute('aria-pressed', String(exam));
    $('mode-label').textContent = exam ? 'Prova' : 'Estudo';
    if (exam) {
      $('hint-panel').hidden = true;
      $('reset-panel').hidden = true;
    }
  }

  function renderCountdown() {
    const target = new Date('2026-10-02T00:00:00-03:00');
    const delta = target.getTime() - Date.now();
    if (delta <= 0) { $('countdown').textContent = 'prova'; return; }
    const days = Math.floor(delta / 86400000);
    const hours = Math.floor((delta % 86400000) / 3600000);
    $('countdown').textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

  function renderAll() {
    renderMode();
    renderQuestion();
    renderQueue();
    renderStats();
    renderErrorLedger();
    renderCountdown();
  }

  function closeDrawers() {
    ['queue-drawer', 'tools-drawer', 'review-drawer'].forEach((id) => { $(id).hidden = true; });
    $('drawer-backdrop').hidden = true;
    document.body.classList.remove('drawer-open');
  }

  function openDrawer(id) {
    closeDrawers();
    $(id).hidden = false;
    $('drawer-backdrop').hidden = false;
    document.body.classList.add('drawer-open');
    $(id).querySelector('button')?.focus();
  }

  function selectQuestion(id) {
    activeId = id;
    persist();
    closeDrawers();
    renderQuestion();
    renderQueue();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateDraftField(field, value) {
    draftFor(activeId)[field] = value;
    persist();
  }

  function addLedger() {
    const input = $('ledger-input');
    const value = input.value.trim();
    if (!value) return;
    draftFor(activeId).ledger.push(value);
    input.value = '';
    persist();
    renderLedger();
  }

  function showHint() {
    if (state.mode === 'exam') return;
    const q = currentQuestion();
    const draft = draftFor(q.id);
    draft.hintUsed = true;
    persist();
    $('hint-panel').textContent = HINTS[q.topic] || 'Identifique primeiro qual dado geométrico conecta o enunciado ao alvo.';
    $('hint-panel').hidden = false;
    $('hint-panel').scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function showReset() {
    if (state.mode === 'exam') return;
    const q = currentQuestion();
    const reset = buildReset(q, draftFor(q.id), state);
    const calculated = reset.calculated.length
      ? `<ol>${reset.calculated.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
      : '<p>Nada calculado entrou no LEDGER.</p>';
    $('reset-content').innerHTML = `<p class="stage-kicker">RESET · RECUPERAR A CADEIA</p><h2>Volte ao próximo passo verificável.</h2><div class="reset-grid"><div class="reset-box"><strong>1 · O que sabemos</strong><p>${escapeHtml(reset.known)}</p></div><div class="reset-box"><strong>2 · O que queremos</strong><p>${escapeHtml(reset.target)}</p></div><div class="reset-box"><strong>3 · O que já calculamos</strong>${calculated}</div><div class="reset-box"><strong>4 · Próximo passo</strong><p>${escapeHtml(reset.nextStep)}</p></div></div>`;
    $('reset-panel').hidden = false;
  }

  function revealAnswer() {
    const q = currentQuestion();
    $('answer-content').textContent = q.answer === null
      ? 'A fonte não fornece um resultado final confiável para este item.'
      : q.answer;
    $('answer-note').hidden = !q.answerNote;
    $('answer-note').textContent = q.answerNote || '';
    $('answer-panel').hidden = false;
    $('error-form').hidden = true;
    $('answer-panel').scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function latestErrorFor(questionId) {
    return [...state.errors].reverse().find((entry) => entry.questionId === questionId) || null;
  }

  function notebookLine(q, draft) {
    if (draft.ferramenta?.trim()) return `Antes da conta, nomeie a ferramenta: ${draft.ferramenta.trim()}.`;
    return `DADOS → ALVO → FERRAMENTA → LEDGER: só use resultados depois de calculá-los.`;
  }

  function renderSessionSummary(correct, errorType, errorNote) {
    const q = currentQuestion();
    const draft = draftFor(activeId);
    $('summary-heading').textContent = correct ? 'Exercício concluído.' : 'Erro registrado. Agora ele vira revisão.';
    $('summary-concept').textContent = draft.ferramenta?.trim() || q.topic;
    $('summary-insight').textContent = HINTS[q.topic] || 'Identifique a relação geométrica antes de começar a álgebra.';
    const latestError = latestErrorFor(activeId);
    $('summary-error').textContent = !correct
      ? `${errorType || 'Erro'}${errorNote ? ` — ${errorNote}` : ''}`
      : latestError
        ? `${latestError.type}${latestError.note ? ` — ${latestError.note}` : ''}`
        : 'Nenhum erro registrado para esta questão.';
    $('summary-result').textContent = q.answer === null
      ? 'A fonte não fornece resultado final confiável para este item.'
      : q.answer;
    $('summary-notebook').textContent = notebookLine(q, draft);
    $('session-summary').hidden = false;
  }

  function finishAttempt(correct, errorType, errorNote) {
    const draft = draftFor(activeId);
    state = recordResult(state, {
      questionId: activeId,
      correct,
      hintUsed: Boolean(draft.hintUsed),
      errorType,
      errorNote,
    });
    draft.hintUsed = false;
    state.drafts[activeId] = draft;
    persist();
    renderQueue();
    renderStats();
    renderErrorLedger();
    $('question-status').textContent = statusLabel(statusOf(currentQuestion()));
    renderSessionSummary(correct, errorType, errorNote);
  }

  function selectNextPriority() {
    const items = filteredQuestions();
    const next = items.find((q) => q.id !== activeId) || items[0];
    if (next) selectQuestion(next.id);
  }

  function populateTopics() {
    const select = $('topic-filter');
    [...topics].sort((a,b) => a.localeCompare(b,'pt-BR')).forEach((topic) => {
      const option = document.createElement('option');
      option.value = topic;
      option.textContent = topic;
      select.appendChild(option);
    });
  }

  ['dados','alvo','ferramenta'].forEach((field) => {
    $(`${field}-input`).addEventListener('input', (event) => updateDraftField(field, event.target.value));
  });

  document.querySelectorAll('#step-tabs [data-step]').forEach((button) => {
    button.addEventListener('click', () => setStudyStep(Number(button.dataset.step), { focus:true }));
  });
  $('previous-step').addEventListener('click', () => setStudyStep(studyStep - 1, { focus:true }));
  $('next-step').addEventListener('click', () => {
    if (studyStep === 3) revealAnswer();
    else setStudyStep(studyStep + 1, { focus:true });
  });

  $('ledger-add').addEventListener('click', addLedger);
  $('ledger-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addLedger(); }
  });
  $('hint-button').addEventListener('click', showHint);
  $('reset-button').addEventListener('click', showReset);
  $('reveal-answer').addEventListener('click', revealAnswer);
  $('grade-correct').addEventListener('click', () => {
    finishAttempt(true);
    $('answer-panel').hidden = true;
  });
  $('grade-wrong').addEventListener('click', () => {
    $('error-form').hidden = false;
    $('error-type').focus();
  });
  $('error-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!$('error-type').value) return;
    const errorType = $('error-type').value;
    const errorNote = $('error-note').value;
    finishAttempt(false, errorType, errorNote);
    $('error-form').reset();
    $('error-form').hidden = true;
    $('answer-panel').hidden = true;
  });

  $('mode-toggle').addEventListener('click', () => {
    state.mode = state.mode === 'exam' ? 'study' : 'exam';
    persist();
    renderMode();
  });

  $('open-queue').addEventListener('click', () => openDrawer('queue-drawer'));
  $('open-tools').addEventListener('click', () => openDrawer('tools-drawer'));
  $('open-review').addEventListener('click', () => openDrawer('review-drawer'));
  $('drawer-backdrop').addEventListener('click', closeDrawers);
  document.querySelectorAll('[data-close-drawer]').forEach((button) => button.addEventListener('click', closeDrawers));
  document.querySelector('[data-close-reset]').addEventListener('click', () => { $('reset-panel').hidden = true; });
  $('reset-panel').addEventListener('click', (event) => {
    if (event.target === $('reset-panel')) $('reset-panel').hidden = true;
  });

  ['source-filter','topic-filter','status-filter'].forEach((id) => $(id).addEventListener('change', renderQueue));
  $('next-priority').addEventListener('click', selectNextPriority);
  $('summary-next').addEventListener('click', () => {
    $('session-summary').hidden = true;
    selectNextPriority();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeDrawers();
    $('reset-panel').hidden = true;
    $('session-summary').hidden = true;
  });

  populateTopics();
  renderAll();
  setInterval(renderCountdown, 60000);
})();