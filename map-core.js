/* Map Initialization and Globals */
const info = document.getElementById('info');
let zoomEnabled = true; // Global variable to track zoom state
let cameraMovementEnabled = true; // Global variable to track camera movement
let map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.stadiamaps.com/styles/osm_bright.json',
  center: [10, 20],
  zoom: 2
})

/* ---------- HELPERS ---------- */
function exists(id) {
  return !!map.getLayer(id);
}

function hideInfo() {
  info.style.display = 'none';
}

function clearSelectedSources() {
  const empty = { type: 'FeatureCollection', features: [] };
  const selSources = ['country-selected','river-selected','strait-selected','lake-selected','sea-selected','city-selected'];
  selSources.forEach(s => {
    if (map.getSource(s)) {
      try { map.getSource(s).setData(empty); } catch (e) {}
    }
  });
  hideInfo();
}

/* find a readable name property on a feature */
function findNameProperty(feat) {
  if (!feat || !feat.properties) return null;
  const p = feat.properties;
  const candidates = ['name','name_en','NAME','Name','ADMIN','admin','admin_name','label','label_en'];
  for (const k of candidates) {
    if (k in p && p[k] !== null && String(p[k]).trim() !== '') {
      return { key: k, value: String(p[k]) };
    }
  }
  return null;
}

// --- Feature stats helpers ---
function findProp(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }
  return null;
}

function formatNumber(val) {
  const n = Number(String(val).replace(/[^0-9.-]/g, ''));
  if (!isFinite(n)) return String(val);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function formatDistance(val) {
  const s = String(val);
  const unitMatch = s.match(/\b(km|kilometres?|kilometers?|mi|miles?|m)\b/i);
  const unitRaw = unitMatch ? unitMatch[1] : null;
  const unit = unitRaw ? unitRaw.toLowerCase() : null;
  const numberMatch = s.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?/);
  const n = numberMatch ? Number(numberMatch[0].replace(/,/g, '')) : Number(s);
  if (!isFinite(n)) return String(val);
  const formattedNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  // Preserve any unit present in the source value; otherwise default to km.
  if (!unit) return formattedNumber + ' km';
  if (unit === 'kilometre' || unit === 'kilometres' || unit === 'kilometer' || unit === 'kilometers') return formattedNumber + ' km';
  if (unit === 'mile' || unit === 'miles') return formattedNumber + ' mi';
  return formattedNumber + ' ' + unit;
}

function formatArea(val) {
  const s = String(val);
  const unitMatch = s.match(/(km\s*\^?2|km²|km2|sq\s*km|square\s*kilometers?|square\s*kilometres?|mi\s*\^?2|mi²|sq\s*mi|square\s*miles?)/i);
  const numberMatch = s.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?/);
  const n = numberMatch ? Number(numberMatch[0].replace(/,/g, '')) : Number(s);
  if (!isFinite(n)) return String(val);
  const formattedNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

  // Preserve any unit present in the source value; otherwise default to km².
  if (!unitMatch) return formattedNumber + ' km²';
  const u = unitMatch[1].toLowerCase();
  if (u.includes('km')) return formattedNumber + ' km²';
  if (u.includes('mi')) return formattedNumber + ' mi²';
  return formattedNumber + ' km²';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function extractFeatureStats(feat, hitLayer, geometry, wikipediaInfoboxFields = null) {
  const p = feat.properties || {};
  const stats = [];
  const wiki = wikipediaInfoboxFields || {};

  const getPopulation = () => {
    const w = wiki.population;
    if (w !== null && w !== undefined && String(w).trim() !== '') return { icon: '👥', label: 'Population', value: formatNumber(w) };
    const pop = findProp(p, ['POP_EST','POP_MAX','pop_est','population','population_total','POPULATION']);
    if (pop !== null && pop !== undefined && String(pop).trim() !== '') return { icon: '👥', label: 'Population', value: formatNumber(pop) };
    return null;
  };

  const getArea = () => {
    const w = wiki.area;
    if (w !== null && w !== undefined && String(w).trim() !== '') return { icon: '📐', label: 'Area (Total)', value: formatArea(w) };
    const areaProp = findProp(p, ['AREA_KM2','AREA','area','AREA_SQKM','area_km2','AREA_KM2_']);
    if (areaProp !== null && areaProp !== undefined && String(areaProp).trim() !== '') return { icon: '📐', label: 'Area (Total)', value: formatArea(areaProp) };
    return null;
  };

  const getFounded = () => {
    const w = wiki.founded;
    if (w !== null && w !== undefined && String(w).trim() !== '') return { icon: '📅', label: 'Founded/Inception', value: String(w).trim() };
    const founded = findProp(p, ['founded','inception','established','established_year','formation','start_date','INCORPORAT']);
    if (founded !== null && founded !== undefined && String(founded).trim() !== '') return { icon: '📅', label: 'Founded/Inception', value: String(founded).trim() };
    return null;
  };

  const getElevation = () => {
    const w = wiki.elevation;
    if (w !== null && w !== undefined && String(w).trim() !== '') {
      const s = String(w).trim();
      if (/\d/.test(s) && /\b(m|meters?|metres?|ft|feet)\b/i.test(s)) return { icon: '⛰️', label: 'Elevation', value: s.replace(/\bmeters?\b/i, 'm').replace(/\bmetres?\b/i, 'm').replace(/\bfeet\b/i, 'ft') };
      return { icon: '⛰️', label: 'Elevation', value: s };
    }
    const elev = findProp(p, ['elevation','ELEVATION','elev_m','ELEV_M','elevation_m','ELEVFT','elevation_ft']);
    if (elev !== null && elev !== undefined && String(elev).trim() !== '') {
      const s = String(elev).trim();
      if (/\d/.test(s) && /\b(m|meters?|metres?|ft|feet)\b/i.test(s)) return { icon: '⛰️', label: 'Elevation', value: s.replace(/\bmeters?\b/i, 'm').replace(/\bmetres?\b/i, 'm').replace(/\bfeet\b/i, 'ft') };
      if (/elevft|elevation_ft/i.test(String(Object.keys(p).join(',')))) return { icon: '⛰️', label: 'Elevation', value: formatNumber(s) + ' ft' };
      if (/elev_m|elevation_m/i.test(String(Object.keys(p).join(',')))) return { icon: '⛰️', label: 'Elevation', value: formatNumber(s) + ' m' };
      return { icon: '⛰️', label: 'Elevation', value: formatNumber(s) };
    }
    return null;
  };

  const getLength = () => {
    const w = wiki.length;
    if (w !== null && w !== undefined && String(w).trim() !== '') return { icon: '🌊', label: 'Length', value: formatDistance(w) };
    const lengthProp = findProp(p, ['length_km','LENGTH_KM','LENGTH','length','len_km','LEN_KM']);
    if (lengthProp !== null && lengthProp !== undefined && String(lengthProp).trim() !== '') return { icon: '🌊', label: 'Length', value: formatDistance(lengthProp) };
    return null;
  };

  const candidates = [getPopulation, getArea, getFounded, getElevation, getLength];
  for (const getter of candidates) {
    if (stats.length >= 3) break;
    const stat = getter();
    if (stat && stat.value !== null && stat.value !== undefined && String(stat.value).trim() !== '') stats.push(stat);
  }

  if (stats.length) return stats;
  return [{ icon: '❓', label: 'Data', value: 'Unknown' }];
}

/* ---------- THEMES ---------- */

function setTheme(theme) {
  const style = theme === 'paper'
    ? 'https://tiles.stadiamaps.com/styles/alidade_smooth.json'
    : 'https://tiles.stadiamaps.com/styles/osm_bright.json';

  map.setStyle(style);

  // Re-add layers after the new style loads
  map.once('load', () => {
    addAllLayers();
  });
}