const pilotBounds = [[56.08, 40.30], [56.47, 40.62]];
const fitOptions = { padding: [42, 42], maxZoom: 13, animate: false };
const osmCredit = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
const mapCopy = {
  ru: {
    kinds:{visit:'Достопримечательность',food:'Питание',stay:'Размещение'},
    statuses:{blocked:'Ограничение',unknown:'Требуется проверка',ready:'Подходит по условиям'},
    zoomIn:'Приблизить',zoomOut:'Отдалить',showPlaces:'Показать объекты',sharedAddress:'Объекты по одному адресу',
    nearby:'Объекты рядом',
    keyboard:'Используйте стрелки для панорамирования, плюс и минус для изменения масштаба. Клавиша Tab переводит фокус на точки карты.',
    stops:(day,order)=>'День '+day+', точка '+order, alternative:'Другой вариант', changed:'Условия изменились',
  },
  en: {
    kinds:{visit:'Attraction',food:'Dining',stay:'Accommodation'},
    statuses:{blocked:'Restriction',unknown:'Needs confirmation',ready:'Meets the requirements'},
    zoomIn:'Zoom in',zoomOut:'Zoom out',showPlaces:'Show sites',sharedAddress:'Sites at the same address',
    nearby:'Nearby sites',
    keyboard:'Use the arrow keys to pan, plus and minus to zoom, and Tab to move to map markers.',
    stops:(day,order)=>'Day '+day+', stop '+order, alternative:'Alternative', changed:'Conditions changed',
  },
  zh: {
    kinds:{visit:'景点',food:'餐饮',stay:'住宿'},
    statuses:{blocked:'有条件限制',unknown:'需要确认',ready:'满足条件'},
    zoomIn:'放大',zoomOut:'缩小',showPlaces:'查看地点',sharedAddress:'同一地址的地点',
    nearby:'附近地点',
    keyboard:'使用方向键移动地图，使用加号和减号缩放，使用 Tab 键切换至地图标记。',
    stops:(day,order)=>'第'+day+'天，第'+order+'站', alternative:'备选方案', changed:'条件已变更',
  },
};
const cityNames = {
  'Владимир':['Vladimir','弗拉基米尔'], 'Суздаль':['Suzdal','苏兹达尔'], 'Кидекша':['Kideksha','基杰克沙'],
  'Боголюбово':['Bogolyubovo','博戈柳博沃'], 'Александров':['Alexandrov','亚历山德罗夫'],
  'Муром':['Murom','穆罗姆'], 'Гусь-Хрустальный':['Gus-Khrustalny','古西-赫鲁斯塔利内'],
};

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

function routeGeometry(route, places, geodata, firstDay = 0) {
  const days = Array.isArray(route) ? [{ stops: route }] : route?.days ?? [];
  const stops = new Map();
  const segments = [];
  let last;

  function connect(from, to, schematic = true) {
    if (from && to && !samePoint(from, to)) segments.push({points:[from,to],schematic});
  }

  function transfer(from, to, departure, arrival) {
    const road = connectionBetween(geodata?.connections, from, to);
    if (road.length > 1) {
      connect(departure,road[0]);
      segments.push({points:road,schematic:false});
      connect(road.at(-1),arrival);
      return arrival ?? road.at(-1);
    }
    const start = departure ?? coordinates(geodata?.cities?.[from]);
    const end = arrival ?? coordinates(geodata?.cities?.[to]);
    connect(start,end);
    return end;
  }

  for (const [day, value] of days.entries()) {
    let order = 0;
    if (value.transfer?.distanceType==='straight-line') {
      const {from,to}=value.transfer;
      const origin=last?.city===from ? last.point : coordinates(geodata?.cities?.[from]);
      const destination=coordinates(geodata?.cities?.[to]);
      connect(origin,destination);
      if (destination) last={city:to,point:destination};
    }
    for (const stop of value.stops ?? []) {
      if (stop.type === 'travel') {
        const [parsedFrom,parsedTo] = (stop.name ?? '').split('→').map(name=>name.trim());
        const from = stop.from ?? parsedFrom;
        const to = stop.to ?? parsedTo;
        if (from && to) {
          const start = last?.city === from ? last.point : null;
          const end = transfer(from,to,start,null);
          if (end) last = {city:to,point:end};
        }
        continue;
      }
      const place = places.get(typeof stop === 'string' ? stop : stop.id);
      if (!place) continue;
      order += 1;
      if (!stops.has(place.id)) stops.set(place.id,{place,order,dayIndex:firstDay+day,start:stop.start,end:stop.end});
      if (last?.city && last.city !== place.city) transfer(last.city,place.city,last.point,place.point);
      else connect(last?.point,place.point);
      last = place;
    }
  }
  return {stops,segments};
}

function segmentKey(points) {
  const direct = JSON.stringify(points);
  const reversed = JSON.stringify([...points].reverse());
  return direct < reversed ? direct : reversed;
}

export function createRouteMap(element, { onSelect, onStatus, locale: initialLocale } = {}) {
  const L = globalThis.L;
  if (!element || !L) return null;

  element.classList.add('route-map');
  const map = L.map(element, {
    zoomControl: false, attributionControl: false, scrollWheelZoom: false,
    minZoom: 6, maxZoom: 18, zoomSnap: 0.5,
  });
  const referencePane = map.createPane('routeBase');
  referencePane.style.zIndex = 205;
  map.createPane('routeLabels').style.zIndex = 380;
  map.createPane('routeTraffic').style.zIndex = 390;
  const attribution = L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
  const zoom = L.control.zoom({ position: 'bottomright' }).addTo(map);
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
  let cycleErrors = 0;
  let fallbackTimer;
  let credits = [];
  let geodata;
  let entries = new Map();
  let initialFrame = true;
  let selectedId;
  let changedIds = new Set();
  let current = {stops:new Map(),segments:[]};
  let alternative = {stops:new Map(),segments:[]};
  const markersByPlace = new Map();
  const markerElements = new Map();
  let showPlaces = true;
  let inactive = false;
  let locale;
  let copy;

  function setLocale(value) {
    const language = typeof value === 'string' ? value.toLowerCase().split('-')[0] : 'ru';
    const next = Object.hasOwn(mapCopy,language) ? language : 'ru';
    if (next === locale) return;
    locale = next;
    copy = mapCopy[next];
    element.setAttribute('aria-description',copy.keyboard);
    for (const [selector,title] of [['.leaflet-control-zoom-in',copy.zoomIn],['.leaflet-control-zoom-out',copy.zoomOut]]) {
      const button = zoom.getContainer().querySelector(selector);
      button.title = title;
      button.setAttribute('aria-label',title);
    }
  }

  function placeLabel(place) {
    return (locale==='zh' ? place.cn : locale==='en' ? place.en : null) ?? place.name;
  }

  function cityLabel(city) {
    if (locale==='ru') return city;
    const entry=geodata?.cities?.[city];
    const label=locale==='en' ? entry?.en : entry?.cn;
    if (label) return label;
    return cityNames[city]?.[locale==='en' ? 0 : 1] ?? city;
  }

  setLocale(initialLocale);

  function report(status) {
    if (tileStatus === status || inactive) return;
    tileStatus = status;
    element.classList.toggle('map--fallback',status === 'fallback' || status === 'partial');
    element.dataset.tiles = status;
    referencePane.style.visibility = status === 'ready' ? 'hidden' : '';
    if (!initialFrame) drawMarkers();
    onStatus?.({ tiles: status, base });
  }

  tiles.on('loading', () => {
    if (base !== 'streets') return;
    cycleLoads = 0;
    cycleErrors = 0;
    clearTimeout(fallbackTimer);
    if (tileStatus !== 'ready') fallbackTimer = setTimeout(() => report('fallback'), 2500);
  });
  tiles.on('tileload', () => {
    if (base !== 'streets') return;
    cycleLoads += 1;
  });
  tiles.on('tileerror', () => { cycleErrors += 1; });
  tiles.on('load', () => {
    if (base !== 'streets') return;
    clearTimeout(fallbackTimer);
    if (cycleLoads) report(cycleErrors ? 'partial' : 'ready');
    else if (cycleErrors) report('fallback');
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
    const line = (points, weight, color, options = {}) => {
      if (points.length > 1) L.polyline(points, {
        weight, color, pane: 'routeTraffic', interactive: false, lineJoin: 'round', lineCap: 'round', ...options,
      }).addTo(paths);
    };
    for (const { points, schematic } of current.segments) {
      if (!schematic) line(points, 9, '#f8fcf7', { opacity: 0.92, className: 'map-path-outline' });
      line(points, schematic ? 2.5 : 4.5, '#0d7763', {
        opacity: 0.95, dashArray: schematic ? '2 6' : null, className: 'map-path-main',
      });
    }
    const mainKeys = new Set(current.segments.map(segment => segmentKey(segment.points)));
    for (const { points, schematic } of alternative.segments) {
      if (!mainKeys.has(segmentKey(points))) {
        line(points, 3.5, '#6352a9', { opacity: 0.86, dashArray: schematic ? '3 6' : '8 9', className: 'map-path-alternative' });
      }
    }
    for (const walk of activeWalks()) {
      line(walk,3.2,'#375d85',{opacity:0.91,dashArray:'5 6',className:'map-path-walking'});
    }
  }

  function activeWalks() {
    const active = new Set([...current.stops.keys(),...alternative.stops.keys(),selectedId]);
    return Object.entries(geodata?.walks ?? {}).filter(([id,walk])=>active.has(id) && walk.kind==='walk')
      .map(([,walk])=>(walk.coordinates ?? []).filter(coordinates));
  }

  function selectPlace(id, { focus = false, keyboardFocus = false } = {}) {
    const place = entries.get(id);
    if (!place || inactive) return false;
    selectedId = id;
    if (focus) map.setView(place.point, Math.max(14, map.getZoom()), { animate: false });
    drawPaths();
    drawMarkers();
    if (keyboardFocus) markersByPlace.get(id)?.focus({preventScroll:true});
    return true;
  }

  function handleSelection(place, keyboard = false) {
    selectPlace(place.id);
    const stop = current.stops.get(place.id) ?? alternative.stops.get(place.id);
    onSelect?.(place.id,place,{dayIndex:stop?.dayIndex,keyboard});
    if (keyboard && !element.contains(document.activeElement)) {
      if (document.activeElement === document.body) markersByPlace.get(place.id)?.focus({preventScroll:true});
    }
  }

  function decorateMarker(marker, label, key, places, selected) {
    marker.on('add', () => {
      const content = marker.getElement();
      content.setAttribute('aria-label', label);
      content.setAttribute('role','button');
      if (selected !== undefined) content.setAttribute('aria-pressed',String(selected));
      content.dataset.mapMarker = key;
      markerElements.set(key,content);
      for (const place of places) markersByPlace.set(place.id,content);
      content.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          marker.fire('click',{keyboard:true});
        }
      });
    });
  }

  function drawPlace(place) {
    const stop = current.stops.get(place.id);
    const order = stop?.order;
    const isSelected = place.id === selectedId;
    const changed = changedIds.has(place.id);
    const candidate = alternative.stops.has(place.id) && !order;
    const body = document.createElement('div');
    body.className = 'map-pin';
    if (order) body.classList.add('map-pin--route');
    if (candidate) body.classList.add('map-pin--alternative');
    if (isSelected) body.classList.add('map-pin--selected');
    if (changed) body.classList.add('map-pin--changed');
    if (Object.hasOwn(copy.statuses,place.status)) body.classList.add('map-pin--' + place.status);
    const glyph = changed ? '!' : order ? String(order) : candidate ? '+' :
      place.kind === 'food' ? '•' : place.kind === 'stay' ? '▪' : '·';
    const core = addLandmark(body, glyph);
    core.className = 'map-pin__core';
    core.setAttribute('aria-hidden', 'true');
    const name = placeLabel(place);
    if (isSelected || changed) addLandmark(body,name).className = 'map-pin__caption';

    const visit = stop ? copy.stops(stop.dayIndex+1,order) : candidate ? copy.alternative : '';
    const time = stop?.start && stop?.end ? stop.start+'–'+stop.end : '';
    const details = [visit,time,copy.kinds[place.kind],copy.statuses[place.status]].filter(Boolean);
    if (changed) details.push(copy.changed);
    const title = [name,...details].join(' · ');
    const marker = L.marker(place.point, {
      title, keyboard: true,
      zIndexOffset: isSelected ? 900 : changed ? 700 : order ? 500 : candidate ? 400 : 100,
      icon: L.divIcon({ className: 'map-marker', html: body, iconSize: [30, 30], iconAnchor: [15, 15] }),
    });
    decorateMarker(marker,title,'place:'+place.id,[place],isSelected);
    if (!isSelected && !changed) {
      const tooltip = document.createElement('div');
      addLandmark(tooltip,name,'strong');
      if (details.length) addLandmark(tooltip,details.join(' · '),'small');
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16], className: 'map-tooltip' });
    }
    marker.on('click',event => handleSelection(place,event.keyboard)).addTo(markers);
  }

  function cityPoints(group, city) {
    const cityPoint = coordinates(geodata?.cities?.[city]);
    return cityPoint ?? groupCoordinates(group);
  }

  function drawGroup(city,group,type='city') {
    const popup = type!=='city';
    const action = popup ? copy[type] : copy.showPlaces;
    const cityGroup = document.createElement('div');
    cityGroup.className = 'map-city';
    if (group.some(place => current.stops.has(place.id))) cityGroup.classList.add('map-city--route');
    if (group.some(place => changedIds.has(place.id))) cityGroup.classList.add('map-city--changed');
    if (group.some(place => place.id === selectedId)) cityGroup.classList.add('map-city--selected');
    const label = cityLabel(city);
    if (!popup) {
      addLandmark(cityGroup,label).className = 'map-city__name';
      cityGroup.append(document.createTextNode(' '));
    }
    addLandmark(cityGroup,String(group.length)).className = 'map-city__count';
    const title = label+' · '+action+' · '+group.length;
    const accessibleName = (popup ? String(group.length) : label+' '+group.length)+' · '+action;
    const marker = L.marker(popup ? group[0].point : cityPoints(group,city), {
      title,keyboard:true,zIndexOffset:popup && group.some(place=>place.id===selectedId) ? 900 : 0,
      icon: L.divIcon({ className: 'map-marker', html: cityGroup, iconSize: [30, 30], iconAnchor: [15, 15] }),
    });
    decorateMarker(marker,accessibleName,(popup ? 'cluster:'+group[0].point.join(',') : 'city:'+city),group);
    if (popup) {
      const contents = document.createElement('div');
      contents.className = 'map-places-popup';
      addLandmark(contents,action,'strong');
      for (const place of group) {
        const option = addLandmark(contents,placeLabel(place),'button');
        option.type = 'button';
        option.dataset.mapPopupPlace = place.id;
        option.addEventListener('click', event => handleSelection(place,event.detail===0));
      }
      contents.addEventListener('keydown',event=>{
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        marker.closePopup();
        marker.getElement()?.focus({preventScroll:true});
      });
      marker.bindPopup(contents);
      marker.on('popupopen',()=>marker.getElement()?.setAttribute('aria-expanded','true'));
      marker.on('popupclose',()=>marker.getElement()?.setAttribute('aria-expanded','false'));
      marker.on('add',()=>marker.getElement()?.setAttribute('aria-expanded','false'));
      marker.on('click',event=>{
        if (event.keyboard) contents.querySelector('button')?.focus({preventScroll:true});
      });
    } else {
      marker.on('click',event=>{
        map.fitBounds(L.latLngBounds(group.map(place=>place.point)), {padding:[42,42],maxZoom:16,animate:false});
        if (event.keyboard) markersByPlace.get(group[0].id)?.focus({preventScroll:true});
      });
    }
    marker.addTo(markers);
  }

  function drawStreetMarkers(places) {
    const groups = [];
    const ordered = places.toSorted((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId));
    for (const place of ordered) {
      const {x,y} = map.latLngToLayerPoint(place.point);
      const group = groups.find(item=>Math.abs(item.x-x)<36 && Math.abs(item.y-y)<36);
      if (group) group.places.push(place);
      else groups.push({x,y,places:[place]});
    }
    for (const {places:nearby} of groups) {
      const first = nearby[0];
      if (nearby.length===1) drawPlace(first);
      else drawGroup(first.city,nearby,nearby.every(place=>samePoint(place.point,first.point))?'sharedAddress':'nearby');
    }
  }

  function drawMarkers() {
    const focused = document.activeElement;
    const key = focused?.dataset.mapMarker;
    const focusId = focused?.dataset.mapPopupPlace ?? [...markersByPlace].find(([,target])=>target===focused)?.[0];
    markers.clearLayers();
    labels.clearLayers();
    markersByPlace.clear();
    markerElements.clear();
    const visible = [...entries.values()].filter(place =>
      showPlaces || current.stops.has(place.id) || alternative.stops.has(place.id) || changedIds.has(place.id) || place.id === selectedId);
    const cluster = map.getZoom() < 13;
    if (!cluster) {
      drawStreetMarkers(visible);
      if (key || focusId) (markerElements.get(key) ?? markersByPlace.get(focusId) ?? element).focus({preventScroll:true});
      return;
    }
    const groups = new Map();
    for (const place of visible) {
      const key = place.point.join(',');
      const group = groups.get(key) ?? [];
      group.push(place);
      groups.set(key, group);
    }
    const cityGroups = new Map();
    for (const atAddress of groups.values()) {
      const place = atAddress[0];
      const highlight = atAddress.some(item=>item.id===selectedId || changedIds.has(item.id) ||
        (alternative.stops.has(item.id) && !current.stops.has(item.id)));
      if (!highlight) {
        const cityGroup = cityGroups.get(place.city) ?? [];
        cityGroups.set(place.city,[...cityGroup,...atAddress]);
      } else if (atAddress.length > 1) drawGroup(place.city,atAddress,'sharedAddress');
      else drawPlace(place);
    }
    for (const [city, group] of cityGroups) {
      if (group.length > 1) drawGroup(city,group,group.every(place=>samePoint(place.point,group[0].point))?'sharedAddress':'city');
      else drawPlace(group[0]);
    }
    const streetTiles = tileStatus === 'ready';
    if (!streetTiles) {
      for (const [city, entry] of Object.entries(geodata?.cities ?? {})) {
        const point = coordinates(entry);
        if (!point || (cityGroups.get(city)?.length ?? 0) > 1) continue;
        if (!cityGroups.has(city) && visible.some(place=>
          map.latLngToContainerPoint(point).distanceTo(map.latLngToContainerPoint(place.point)) < 100)) continue;
        const body = document.createElement('span');
        body.textContent = cityLabel(city);
        L.marker(point, {
          pane: 'routeLabels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'map-base-label', html: body, iconSize: [1, 1], iconAnchor: [-11, 8] }),
        }).addTo(labels);
      }
    }
    if (key || focusId) (markerElements.get(key) ?? markersByPlace.get(focusId) ?? element).focus({preventScroll:true});
  }

  function fit({ routeOnly = false, allPlaces = false } = {}) {
    if (inactive) return;
    const activePoints = [...current.segments,...alternative.segments].flatMap(segment=>segment.points).concat(activeWalks().flat());
    for (const id of new Set([...current.stops.keys(),...alternative.stops.keys(),...changedIds])) {
      if (entries.has(id)) activePoints.push(entries.get(id).point);
    }
    const focus = allPlaces ? [...entries.values()].map(place=>place.point) : routeOnly ? activePoints : [];
    const bounds = L.latLngBounds(focus.length ? focus : geodata?.bounds ?? pilotBounds);
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
    selectedId: selected, changedIds: changed, showPlaces: show = true, base: nextBase = 'scheme', frame = false, dayIndex = 0,
    locale: nextLocale = locale,
  } = {}) {
    if (inactive) return;
    if (mapData !== geodata) {
      geodata = mapData;
      drawBase();
    }
    entries = placeEntries(places, geodata);
    selectedId = selected;
    changedIds = new Set(changed ?? []);
    current = routeGeometry(route,entries,geodata,dayIndex);
    alternative = routeGeometry(comparison,entries,geodata,dayIndex);
    showPlaces = show;
    setLocale(nextLocale);
    setBase(nextBase);
    if (initialFrame || frame) {
      fit({ routeOnly: frame === 'route' || initialFrame, allPlaces:frame === 'places' });
      initialFrame = false;
    }
    drawPaths();
    drawMarkers();
  }

  map.on('zoomend', drawMarkers);
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (!inactive) map.invalidateSize({ pan: false, debounceMoveend: true });
  }) : null;
  resize?.observe(element);

  return {
    update, select: selectPlace, fit, focusCity,
    setBase(next) {
      setBase(next);
      if (!inactive) drawMarkers();
    },
    destroy() {
      if (inactive) return;
      inactive = true;
      clearTimeout(fallbackTimer);
      resize?.disconnect();
      map.off('zoomend',drawMarkers);
      map.remove();
    },
  };
}
