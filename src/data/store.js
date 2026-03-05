export function buildStore(rows, tagFields) {
  // 数値フィールドの型寄せ（必要最低限）
  for (const r of rows) {
    for (let i = 1; i <= 6; i++) {
      const k = `f${i}`;
      const n = Number(r[k]);
      r[k] = Number.isFinite(n) ? n : null;
    }
    for (const k of ["rank_overall","score_overall","rank_area","score_area"]) {
      const n = Number(r[k]);
      r[k] = Number.isFinite(n) ? n : null;
    }
  }

  // フィルターUI用の候補
  const uniq = (arr) => Array.from(new Set(arr.filter(v => v != null && String(v).trim() !== ""))).sort();

  const prefectures = uniq(rows.map(r => r.name_area));
  const categories = uniq(rows.map(r => r.category));

  return {
    rows,
    tagFields,
    prefectures,
    categories
  };
}