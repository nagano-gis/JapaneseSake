// src/data/sourceFeatureLayer.stub.js
export async function loadLayerRows() {
  // 仮データ（実際はCSV読む方が現実的）
  const rows = [
    {
      objectId: 1,
      id: "1",
      name: "テストA",
      name_area: "長野",
      category: "純米",
      f1: 0.7, f2: 0.2, f3: 0.4, f4: 0.6, f5: 0.5, f6: 0.3,
      rank_overall: 10, score_overall: 0.88,
      rank_area: 2, score_area: 0.91,
      flavortags_fruity: 1,
      flavortags_dry: 0
    },
    {
      objectId: 2,
      id: "2",
      name: "テストB",
      name_area: "新潟",
      category: "吟醸",
      f1: 0.2, f2: 0.8, f3: 0.5, f4: 0.2, f5: 0.1, f6: 0.9,
      rank_overall: 3, score_overall: 0.95,
      rank_area: 1, score_area: 0.97,
      flavortags_fruity: 1,
      flavortags_dry: 1
    }
  ];

  const tagFields = ["flavortags_fruity", "flavortags_dry"];

  return {
    layer: null,
    rows,
    objectIdField: "OBJECTID",
    allFieldNames: Object.keys(rows[0]),
    tagFields,
    outFields: Object.keys(rows[0])
  };
}