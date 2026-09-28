(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GASources = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
  "caderno": {
    "title": "Geometria Analítica — Caderno Parrudo Leandro",
    "file": "sources/caderno.pdf",
    "pages": 33,
    "role": "conceitos, fórmulas, checklist e prova reconstruída"
  },
  "lista1": {
    "title": "Lista 1 — Coordenadas Cartesianas no Plano",
    "file": "sources/lista-1.pdf",
    "pages": 7,
    "role": "30 exercícios e gabarito"
  },
  "lista2": {
    "title": "Lista 2 — Reta",
    "file": "sources/lista-2.pdf",
    "pages": 11,
    "role": "49 exercícios e gabarito"
  }
};
});