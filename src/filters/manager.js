export class FilterManager {
  constructor({ topN = 10 } = {}) {
    this.topN = topN;
    this.filters = [];
    this.lastFilteredRows = [];
    this.lastSortLabel = "";
  }

  register(filter) {
    this.filters.push(filter);
  }

  initAll({ rootMap, data, onChange }) {
    for (const f of this.filters) {
      const rootEl = rootMap?.[f.id] ?? null;
      f.init?.({ rootEl, data, onChange });
    }
  }

  applyAll(data) {
    // 1) predicates（AND）
    const predicates = this.filters
      .map(f => f.getPredicate?.())
      .filter(Boolean);

    const filtered = predicates.length
      ? data.filter(row => predicates.every(p => p(row)))
      : data.slice();

    this.lastFilteredRows = filtered;

    // 2) ranker（priority最大を採用）
    const rankers = this.filters
      .map(f => f.getRanker?.())
      .filter(Boolean);

    let ranker = null;
    if (rankers.length) {
      ranker = rankers.reduce((best, cur) => {
        const pb = best?.priority ?? 0;
        const pc = cur?.priority ?? 0;
        return pc >= pb ? cur : best;
      }, null);
    }

    this.lastSortLabel = ranker?.label ?? "";

    // 3) results
    let results = filtered.map(item => ({ item, score: null }));

    if (ranker?.scoreOf) {
      for (const r of results) r.score = ranker.scoreOf(r.item);

      results = results
        .filter(r => r.score != null && Number.isFinite(r.score))
        .sort((a, b) => b.score - a.score);
    }

    // 表示用のフォーマット（任意）
    const formatScore = ranker?.formatScore ?? ((x) => (x == null ? "-" : String(x)));

    const top = results.slice(0, this.topN).map(r => ({
      ...r,
      sortLabel: ranker?.label ?? "",
      sortValueText: formatScore(r.score)
    }));

    return {
      top,
      filteredObjectIds: filtered.map(r => r.objectId),
      sortLabel: ranker?.label ?? ""
    };
  }

  getFilteredRows() {
    return this.lastFilteredRows;
  }
}