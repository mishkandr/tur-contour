const pilotBounds = [[56.08, 40.30], [56.47, 40.62]];
const fitOptions = { padding: [42, 42], maxZoom: 13, animate: false };
const placeKinds = { visit: 'Достопримечательность', food: 'Питание', stay: 'Размещение' };
const statuses = { blocked: 'Ограничение', unknown: 'Требуется проверка', ready: 'Подходит по условиям' };
const osmCredit = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

function coordinates(value) {
  const pair = value?.coordinates ?? value;
  if (Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) &&
      Math.abs(pair[0]) <= 85 && Math.abs(pair[1]) <= 180) return pair;
  return null;
}

function groupCoordinates(places) {
  return places.reduce(([lat, lon], place) =>
    [lat + place.point[0] / places.length, lon + place.point[1] / places.length], [0, 0]);
}

function placeEntries(places, geodata) {
  return new Map((places ?? []).flatMap(place => {
    const point = coordinates(place.coordinates) ?? coordinates(geodata?.places?.[place.id]);
    return point ? [[place.id, { ...place, point }]] : [];
  }));
}

function routeEntries(route, places) {
  const stops = Array.isArray(route) ? route : route?.days?.flatMap(day => day.stops) ?? [];
  return stops.flatMap(stop => {
    const place = places.get(typeof stop === 'string' ? stop : stop.id);
    return place ? [place] : [];
  });
}

function addLandmark(pane, text, tag = 'span') {
  const label = document.createElement(tag);
  label.textContent = text;
  pane.append(label);
  return label;
}

function sourceAttribution(item) {
  if (item.url === 'https://www.openstreetmap.org/copyright') return osmCredit;
  try {
    const url = new URL(item.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const link = document.createElement('a');
    link.href = url.href;
    link.textContent = item.label;
    return link.outerHTML;
  } catch {
    return '';
  }
}

function connectionBetween(connections, from, to) {
  for (const connection of connections ?? []) {
    if (connection.from === from && connection.to === to) return (connection.coordinates ?? []).filter(coordinates);
    if (connection.from === to && connection.to === from) return (connection.coordinates ?? []).filter(coordinates).reverse();
  }
  return [];
}

function routeSegments(entries, connections) {
  const segments = [];
  for (let index = 1; index < entries.length; index += 1) {
    const before = entries[index - 1];
    const next = entries[index];
    const road = before.city !== next.city ? connectionBetween(connections, before.city, next.city) : [];
    if (road.length > 1) {
      segments.push({ points: [before.point, road[0]], schematic: true });
      segments.push({ points: road, schematic: false });
      segments.push({ points: [road.at(-1), next.point], schematic: true });
    } else if (before.point[0] !== next.point[0] || before.point[1] !== next.point[1]) {
      segments.push({ points: [before.point, next.point], schematic: true });
    }
  }
  return segments;
}

export function createRouteMap(element, { onSelect, onStatus } = {}) {
  const L = globalThis.L;
  if (!element || !L) return null;

  const map = L.map(element, {
    zoomControl: false, attributionControl: false, scrollWheelZoom: false, preferCanvas: true,
    minZoom: 6, maxZoom: 18, zoomSnap: 0.5,
  });
  const referencePane = map.createPane('routeBase');
  referencePane.style.zIndex = 205;
  map.createPane('routeLabels').style.zIndex = 380;
  map.createPane('routeTraffic').style.zIndex = 390;
  const attribution = L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 90 }).addTo(map);
  const baseLayer = L.layerGroup().addTo(map);
  const labels = L.layerGroup().addTo(map);
  const paths = L.layerGroup().addTo(map);
  const markers = L.layerGroup().addTo(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: osmCredit,
    referrerPolicy: 'strict-origin-when-cross-origin',
    maxNativeZoom: 19,
    updateWhenIdle: true,
    keepBuffer: 1,
    className: 'map-tiles',
  });
  let base = null;
  let tileStatus;
  let cycleLoads = 0;
  let fallbackTimer;
  let credits = [];
  let geodata;
  let entries = new Map();
  let initialFrame = true;
  let selectedId;
  let changedIds = new Set();
  let alternativeIds = new Set();
  let routeIds = new Map();
  let current = [];
  let alternative = [];
  let showPlaces = true;
  let inactive = false;

  function report(status) {
    if (tileStatus === status || inactive) return;
    tileStatus = status;
    element.classList.toggle('map--fallback', status === 'fallback');
    element.dataset.tiles = status;
    referencePane.style.visibility = status === 'ready' ? 'hidden' : '';
    if (!initialFrame) drawMarkers();
    onStatus?.({ tiles: status, base });
  }

  tiles.on('loading', () => {
    if (base !== 'streets') return;
    cycleLoads = 0;
    clearTimeout(fallbackTimer);
    if (tileStatus !== 'ready') fallbackTimer = setTimeout(() => report('fallback'), 2500);
  });
  tiles.on('tileload', () => {
    if (base !== 'streets') return;
    cycleLoads += 1;
    clearTimeout(fallbackTimer);
    report('ready');
  });
  tiles.on('load', () => {
    if (base === 'streets' && !cycleLoads) report('fallback');
  });

  function setBase(next) {
    const mode = next === 'schematic' || next === 'scheme' ? 'schematic' : 'streets';
    if (mode === base || inactive) return;
    base = mode;
    element.dataset.mapBase = mode;
    clearTimeout(fallbackTimer);
    if (mode === 'schematic') {
      map.removeLayer(tiles);
      report('fallback');
    } else {
      cycleLoads = 0;
      report('loading');
      map.addLayer(tiles);
    }
  }

  function drawBase() {
    baseLayer.clearLayers();
    for (const credit of credits) attribution.removeAttribution(credit);
    credits = (geodata?.attribution ?? []).map(sourceAttribution).filter(Boolean);
    for (const credit of credits) attribution.addAttribution(credit);

    const featureSets = [geodata?.features, geodata?.context].filter(Boolean);
    const containsRoads = geodata?.features?.features?.some(feature => feature.properties?.kind === 'road');
    if (!containsRoads) {
      for (const connection of geodata?.connections ?? []) {
        const points = (connection.coordinates ?? []).filter(coordinates);
        if (points.length > 1) L.polyline(points, {
          color: '#b9c5b3', weight: 1.75, opacity: 0.76, pane: 'routeBase', interactive: false,
        }).addTo(baseLayer);
      }
    }
    const style = feature => {
      const kind = feature.properties?.kind;
      if (kind === 'water' || kind === 'river') return { color: '#73a3b7', weight: 2, opacity: 0.72, fillOpacity: 0.2 };
      if (kind === 'road') return { color: '#b5b6a5', weight: 1, opacity: 0.72 };
      if (kind === 'rail') return { color: '#b2ad9b', weight: 1, opacity: 0.6, dashArray: '3 5' };
      if (kind === 'forest') return { color: '#9ab09a', weight: 0.6, opacity: 0.22, fillColor: '#bccfbb', fillOpacity: 0.38 };
      return { color: '#8fb3a0', weight: 1.2, opacity: 0.68, fillColor: '#dce7db', fillOpacity: 0.38 };
    };
    for (const features of featureSets) {
      L.geoJSON(features, { pane: 'routeBase', interactive: false, style }).addTo(baseLayer);
    }
  }

  function drawPaths() {
    paths.clearLayers();
    const main = routeSegments(current, geodata?.connections);
    const candidate = routeSegments(alternative, geodata?.connections);
    const line = (points, weight, color, options = {}) => {
      if (points.length > 1) L.polyline(points, {
        weight, color, pane: 'routeTraffic', interactive: false, lineJoin: 'round', lineCap: 'round', ...options,
      }).addTo(paths);
    };
    for (const { points, schematic } of main) {
      if (!schematic) line(points, 9, '#f8fcf7', { opacity: 0.92, className: 'map-path-outline' });
      line(points, schematic ? 2.5 : 4.5, '#0d7763', {
        opacity: 0.95, dashArray: schematic ? '2 6' : null, className: 'map-path-main',
      });
    }
    const mainKeys = new Set(main.map(segment => JSON.stringify(segment.points)));
    for (const { points, schematic } of candidate) {
      if (!mainKeys.has(JSON.stringify(points))) {
        line(points, 3.5, '#6352a9', { opacity: 0.86, dashArray: schematic ? '3 6' : '8 9', className: 'map-path-alternative' });
      }
    }
  }

  function selectPlace(id, { focus = false } = {}) {
    const place = entries.get(id);
    if (!place || inactive) return false;
    selectedId = id;
    if (focus) map.setView(place.point, Math.max(14, map.getZoom()), { animate: false });
    drawMarkers();
    return true;
  }

  function handleSelection(place) {
    selectPlace(place.id);
    onSelect?.(place.id, place);
  }

  function decorateMarker(marker, label) {
    marker.on('add', () => {
      const content = marker.getElement();
      content?.setAttribute('aria-label', label);
      content?.addEventListener('keydown', event => {
        if (event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          marker.fire('click');
        }
      });
    });
  }

  function drawPlace(place) {
    const order = routeIds.get(place.id);
    const isSelected = place.id === selectedId;
    const changed = changedIds.has(place.id);
    const candidate = alternativeIds.has(place.id) && !order;
    const body = document.createElement('div');
    body.className = 'map-pin';
    if (order) body.classList.add('map-pin--route');
    if (candidate) body.classList.add('map-pin--alternative');
    if (isSelected) body.classList.add('map-pin--selected');
    if (changed) body.classList.add('map-pin--changed');
    if (Object.hasOwn(statuses, place.status)) body.classList.add('map-pin--' + place.status);
    const glyph = changed ? '!' : order ? String(order) : candidate ? '+' :
      place.kind === 'food' ? '•' : place.kind === 'stay' ? '▪' : '·';
    const core = addLandmark(body, glyph);
    core.className = 'map-pin__core';
    core.setAttribute('aria-hidden', 'true');
    if (isSelected || changed) addLandmark(body, place.name).className = 'map-pin__caption';

    const title = [place.name, placeKinds[place.kind], statuses[place.status]].filter(Boolean).join(' · ');
    const marker = L.marker(place.point, {
      title, keyboard: true,
      zIndexOffset: isSelected ? 900 : changed ? 700 : order ? 500 : candidate ? 400 : 100,
      icon: L.divIcon({ className: 'map-marker', html: body, iconSize: [30, 30], iconAnchor: [15, 15] }),
    });
    decorateMarker(marker, title);
    if (!isSelected && !changed) {
      const tooltip = document.createElement('span');
      tooltip.textContent = place.name;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16], className: 'map-tooltip' });
    }
    marker.on('click', () => handleSelection(place)).addTo(markers);
  }

  function cityPoints(group, city) {
    const cityPoint = coordinates(geodata?.cities?.[city]);
    return cityPoint ?? groupCoordinates(group);
  }

  function drawCity(city, group, coincident = false) {
    const cityGroup = document.createElement('div');
    cityGroup.className = 'map-city';
    if (group.some(place => routeIds.has(place.id))) cityGroup.classList.add('map-city--route');
    if (group.some(place => changedIds.has(place.id))) cityGroup.classList.add('map-city--changed');
    addLandmark(cityGroup, String(group.length)).className = 'map-city__count';
    if (!coincident) addLandmark(cityGroup, city).className = 'map-city__name';
    const title = 'Объекты в локации «' + city + '» · ' + group.length;
    const marker = L.marker(coincident ? group[0].point : cityPoints(group, city), {
      title, keyboard: true,
      icon: L.divIcon({ className: 'map-marker', html: cityGroup, iconSize: [30, 30], iconAnchor: [15, 15] }),
    });
    decorateMarker(marker, title);
    if (coincident) {
      const contents = document.createElement('div');
      contents.className = 'map-places-popup';
      for (const place of group) {
        const option = addLandmark(contents, place.name, 'button');
        option.type = 'button';
        option.addEventListener('click', () => handleSelection(place));
      }
      marker.bindPopup(contents);
    } else {
      marker.on('click', () => map.fitBounds(L.latLngBounds(group.map(x => x.point)), {
        padding: [38, 38], maxZoom: 16, animate: false,
      }));
    }
    marker.addTo(markers);
  }

  function drawMarkers() {
    markers.clearLayers();
    labels.clearLayers();
    const visible = [...entries.values()].filter(place =>
      showPlaces || routeIds.has(place.id) || alternativeIds.has(place.id) || changedIds.has(place.id) || place.id === selectedId);
    const groups = new Map();
    const cluster = map.getZoom() < 13;
    for (const place of visible) {
      if (changedIds.has(place.id) || place.id === selectedId || (alternativeIds.has(place.id) && !routeIds.has(place.id))) {
        drawPlace(place);
        continue;
      }
      const key = cluster ? place.city : place.point.join(',');
      const group = groups.get(key) ?? [];
      group.push(place);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.length > 1) drawCity(group[0].city, group, !cluster);
      else drawPlace(group[0]);
    }
    if (tileStatus !== 'ready' && cluster) {
      for (const [city, entry] of Object.entries(geodata?.cities ?? {})) {
        const point = coordinates(entry);
        if (!point || (groups.get(city)?.length ?? 0) > 1) continue;
        const ownGroup = groups.get(city);
        if (!ownGroup && [...groups.values()].some(group =>
          map.latLngToContainerPoint(point).distanceTo(map.latLngToContainerPoint(group[0].point)) < 100)) continue;
        const body = document.createElement('span');
        body.textContent = city;
        L.marker(point, {
          pane: 'routeLabels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'map-base-label', html: body, iconSize: [1, 1], iconAnchor: [-11, 8] }),
        }).addTo(labels);
      }
    }
  }

  function fit({ routeOnly = false, allPlaces = false } = {}) {
    if (inactive) return;
    const activePlaces = [...current, ...alternative, ...[...changedIds].flatMap(id => entries.get(id) ?? [])];
    const focus = allPlaces ? [...entries.values()] : routeOnly ? activePlaces : [];
    const bounds = L.latLngBounds(focus.length ? focus.map(place => place.point) : geodata?.bounds ?? pilotBounds);
    if (bounds.isValid()) map.fitBounds(bounds, fitOptions);
  }

  function focusCity(city) {
    if (inactive) return;
    const places = [...entries.values()].filter(place => place.city === city);
    if (places.length > 1) map.fitBounds(places.map(place => place.point), { ...fitOptions, maxZoom: 16 });
    else if (places.length === 1) map.setView(places[0].point, 15, { animate: false });
  }

  function update({
    places, geodata: mapData, route, alternative: comparison,
    selectedId: selected, changedIds: changed, showPlaces: show = true, base: nextBase = 'scheme', frame = false,
  } = {}) {
    if (inactive) return;
    if (mapData !== geodata) {
      geodata = mapData;
      drawBase();
    }
    entries = placeEntries(places, geodata);
    selectedId = selected;
    changedIds = new Set(changed ?? []);
    current = routeEntries(route, entries);
    alternative = routeEntries(comparison, entries);
    routeIds = new Map();
    current.forEach(place => {
      if (!routeIds.has(place.id)) routeIds.set(place.id, routeIds.size + 1);
    });
    alternativeIds = new Set(alternative.map(place => place.id));
    showPlaces = show;
    setBase(nextBase);
    if (initialFrame || frame) {
      fit({ routeOnly: frame === 'route' });
      initialFrame = false;
    }
    drawPaths();
    drawMarkers();
  }

  map.on('zoomend', drawMarkers);
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    map.invalidateSize({ pan: false, debounceMoveend: true });
  }) : null;
  resize?.observe(element);

  return {
    update, select: selectPlace, fit, focusCity,
    setBase(next) {
      setBase(next);
      if (!inactive) drawMarkers();
    },
    destroy() {
      inactive = true;
      clearTimeout(fallbackTimer);
      resize?.disconnect();
      map.remove();
    },
  };
}
