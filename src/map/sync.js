let highlightHandle = null;

export function syncToMap(layerView, objectIdsFiltered, objectIdsTop) {
  if (!layerView) return;

  layerView.filter = (objectIdsFiltered?.length)
    ? { objectIds: objectIdsFiltered }
    : null;

  if (highlightHandle) {
    highlightHandle.remove();
    highlightHandle = null;
  }
  if (objectIdsTop?.length) {
    highlightHandle = layerView.highlight(objectIdsTop);
  }
}
``