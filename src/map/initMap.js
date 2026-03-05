import "@arcgis/core/assets/esri/themes/light/main.css";

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

export async function initMap({ layerUrl, center, zoom }) {
  const map = new Map({ basemap: "streets" });

  const layer = new FeatureLayer({ url: layerUrl });
  map.add(layer);

  const view = new MapView({
    container: "viewDiv",
    map,
    center,
    zoom
  });

  await view.when();
  await layer.load();

  const layerView = await view.whenLayerView(layer);

  return { map, view, layer, layerView };
}