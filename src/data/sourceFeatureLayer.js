import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

/**
 * FeatureLayer から属性のみロード（geometryなし）
 */
export async function loadLayerRows({
  layerUrl,
  baseOutFields = [],
  where = "1=1",
  pageSize = 2000
}) {
  const layer = new FeatureLayer({ url: layerUrl });
  await layer.load();

  const objectIdField = layer.objectIdField;      // "OBJECTID"
  const allFieldNames = layer.fields.map(f => f.name);

  // tag列を動的に拾う
  const tagFields = allFieldNames.filter(n => n.startsWith("flavortags_"));

  const outFields = Array.from(new Set([
    objectIdField,
    ...baseOutFields,
    ...tagFields
  ]));

  const total = await layer.queryFeatureCount({ where });

  const rows = [];
  for (let offset = 0; offset < total; offset += pageSize) {
    const res = await layer.queryFeatures({
      where,
      outFields,
      returnGeometry: false,
      start: offset,
      num: pageSize
    });

    for (const f of res.features) {
      rows.push({ objectId: f.attributes[objectIdField], ...f.attributes });
    }
  }

  return { layer, rows, objectIdField, allFieldNames, tagFields, outFields };
}