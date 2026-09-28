(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GACore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'geometria-analitica-cockpit-v1';
  const ERROR_TYPES = [
    'conceitual',
    'algébrico',
    'notacional',
    'interpretação do enunciado',
    'representação geométrica',
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function freshState(at = nowIso()) {
    return {
      version: 1,
      mode: 'study',
      activeQuestionId: null,
      results: {},
      drafts: {},
      errors: [],
      startedAt: at,
      lastStudyAt: at,
    };
  }

  function validResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const attempts = Number(value.attempts);
    if (!Number.isInteger(attempts) || attempts < 1 || typeof value.correct !== 'boolean') return null;
    return {
      correct: value.correct,
      hintUsed: Boolean(value.hintUsed),
      mastered: Boolean(value.correct && !value.hintUsed),
      attempts,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  function validDrafts(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const drafts = {};
    for (const [id, candidate] of Object.entries(value)) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      drafts[id] = {
        dados: typeof candidate.dados === 'string' ? candidate.dados : '',
        alvo: typeof candidate.alvo === 'string' ? candidate.alvo : '',
        ferramenta: typeof candidate.ferramenta === 'string' ? candidate.ferramenta : '',
        ledger: Array.isArray(candidate.ledger)
          ? candidate.ledger.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
          : [],
        hintUsed: Boolean(candidate.hintUsed),
      };
    }
    return drafts;
  }

  function normalizeState(value) {
    const base = freshState();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
    const results = {};
    if (value.results && typeof value.results === 'object' && !Array.isArray(value.results)) {
      for (const [id, candidate] of Object.entries(value.results)) {
        const valid = validResult(candidate);
        if (valid) results[id] = valid;
      }
    }
    const drafts = validDrafts(value.drafts);
    const errors = Array.isArray(value.errors)
      ? value.errors.filter((entry) => entry && typeof entry === 'object' && typeof entry.questionId === 'string')
      : [];
    return {
      ...base,
      version: 1,
      mode: value.mode === 'exam' ? 'exam' : 'study',
      activeQuestionId: typeof value.activeQuestionId === 'string' ? value.activeQuestionId : null,
      results,
      drafts,
      errors,
      startedAt: typeof value.startedAt === 'string' ? value.startedAt : base.startedAt,
      lastStudyAt: typeof value.lastStudyAt === 'string' ? value.lastStudyAt : base.lastStudyAt,
    };
  }

  function safeStorage(windowLike) {
    try {
      if (!windowLike) return null;
      return windowLike.localStorage || null;
    } catch {
      return null;
    }
  }

  function loadState(storage) {
    try {
      if (!storage || typeof storage.getItem !== 'function') return freshState();
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      return normalizeState(JSON.parse(raw));
    } catch {
      return freshState();
    }
  }

  function saveState(storage, state) {
    try {
      if (!storage || typeof storage.setItem !== 'function') return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function recordResult(state, payload) {
    const at = payload.at || nowIso();
    const previous = state.results[payload.questionId];
    const nextResult = {
      correct: Boolean(payload.correct),
      hintUsed: Boolean(payload.hintUsed),
      mastered: Boolean(payload.correct && !payload.hintUsed),
      attempts: (previous?.attempts || 0) + 1,
      updatedAt: at,
    };
    const errors = [...state.errors];
    if (!payload.correct && ERROR_TYPES.includes(payload.errorType)) {
      errors.push({
        questionId: payload.questionId,
        type: payload.errorType,
        note: typeof payload.errorNote === 'string' ? payload.errorNote.trim() : '',
        at,
      });
    }
    return {
      ...state,
      results: { ...state.results, [payload.questionId]: nextResult },
      errors,
      lastStudyAt: at,
    };
  }

  function statusRank(question, state) {
    const result = state.results[question.id];
    if (!result) return 1;
    if (!result.correct) return 0;
    if (result.hintUsed || !result.mastered) return 2;
    return 3;
  }

  function prioritySort(questions, state) {
    return [...questions].sort((a, b) => {
      const rankA = statusRank(a, state);
      const rankB = statusRank(b, state);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA === 0) {
        const dateA = state.results[a.id]?.updatedAt || '';
        const dateB = state.results[b.id]?.updatedAt || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
      }
      if (a.source !== b.source) return a.source === 'lista2' ? -1 : 1;
      return Number(a.number) - Number(b.number);
    });
  }

  function topicStats(questions, state) {
    const grouped = new Map();
    for (const question of questions) {
      if (!grouped.has(question.topic)) grouped.set(question.topic, []);
      grouped.get(question.topic).push(question);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([topic, items]) => {
        const attempted = items.filter((q) => state.results[q.id]).length;
        const mastered = items.filter((q) => state.results[q.id]?.mastered).length;
        return {
          topic,
          total: items.length,
          attempted,
          mastered,
          coveragePercent: items.length ? Math.round((attempted / items.length) * 100) : 0,
          masteryPercent: items.length ? Math.round((mastered / items.length) * 100) : 0,
        };
      });
  }

  function buildReset(question, draft = {}, state = freshState()) {
    const known = typeof draft.dados === 'string' && draft.dados.trim()
      ? draft.dados.trim()
      : 'Ainda não registrado. Volte ao enunciado e transcreva apenas os dados fornecidos.';
    const target = typeof draft.alvo === 'string' && draft.alvo.trim()
      ? draft.alvo.trim()
      : 'Ainda não registrado. Escreva exatamente o que a questão pede.';
    const calculated = Array.isArray(draft.ledger)
      ? draft.ledger.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : [];

    let nextStep;
    if (!draft.dados?.trim()) nextStep = 'Registre os DADOS do enunciado antes de calcular.';
    else if (!draft.alvo?.trim()) nextStep = 'Defina o ALVO: qual quantidade, ponto, reta ou condição precisa ser encontrada?';
    else if (!draft.ferramenta?.trim()) nextStep = `Escolha a FERRAMENTA compatível com o tópico “${question.topic}”.`;
    else if (!calculated.length) nextStep = `Use a ferramenta “${draft.ferramenta.trim()}” para produzir o primeiro resultado e só então adicione-o ao LEDGER.`;
    else nextStep = 'Continue a partir do último item do LEDGER; use somente resultados já registrados e a ferramenta escolhida.';

    return { known, target, calculated, nextStep };
  }

  return {
    ERROR_TYPES,
    STORAGE_KEY,
    safeStorage,
    freshState,
    loadState,
    saveState,
    recordResult,
    prioritySort,
    topicStats,
    buildReset,
  };
});