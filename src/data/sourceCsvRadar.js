/**
 * CSV（id,f1..f6が入っている前提）を読み込んで Map(id -> {f1..f6}) を返す
 */
export async function loadRadarCsvMap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV取得に失敗: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim() !== "");
  if (lines.length < 2) return new Map();

  const headers = lines[0].split(",").map(h => h.trim());
  const idx = (name) => headers.indexOf(name);

  const idIdx = idx("id");
  if (idIdx === -1) throw new Error("CSVに id 列がありません");

  const fIdx = [1,2,3,4,5,6].map(i => idx(`f${i}`));
  if (fIdx.some(i => i === -1)) throw new Error("CSVに f1〜f6 列が揃っていません");

  const map = new Map();
  for (const line of lines.slice(1)) {
    const v = line.split(",");
    const id = String((v[idIdx] ?? "").trim());
    if (!id) continue;

    const obj = { id };
    for (let i = 0; i < 6; i++) {
      const raw = (v[fIdx[i]] ?? "").trim();
      const n = Number(raw);
      obj[`f${i+1}`] = Number.isFinite(n) ? n : null;
    }
    map.set(id, obj);
  }

  return map;
}