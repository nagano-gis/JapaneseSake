export function overwriteRadarFromCsv(rows, radarCsvMap) {
  let hit = 0;
  for (const r of rows) {
    const key = r.id == null ? "" : String(r.id);
    if (!key) continue;

    const c = radarCsvMap.get(key);
    if (!c) continue;

    for (let i = 1; i <= 6; i++) {
      const k = `f${i}`;
      if (c[k] != null) r[k] = c[k];
    }
    hit++;
  }
  return hit;
}