/* ---------- SIDEBAR FUNCTIONS ---------- */

function updateSidebar(data) {
  const sidebarEl = document.getElementById('sidebar');
  // store wiki/title for the "Explore on Wikipedia" button
  sidebarEl.dataset.wikiTitle = data.wikiTitle || data.title || '';
  document.getElementById('sidebar-title').textContent = data.title || 'Unknown Location';
  
  const heroImg = document.getElementById('sidebar-hero-img');
  if (data.imageURL) {
    heroImg.src = data.imageURL;
    heroImg.style.display = 'block';
  } else {
    heroImg.style.display = 'none';
  }
  
  document.getElementById('sidebar-description').textContent = data.description || 'No historical information available.';
  
  const statsContainer = document.getElementById('sidebar-stats');
  statsContainer.innerHTML = '';
  if (data.stats && data.stats.length > 0) {
    data.stats.forEach(stat => {
      if (!stat) return;
      const labelText = (stat.label === null || stat.label === undefined) ? '' : String(stat.label).trim();
      const valueText = (stat.value === null || stat.value === undefined) ? '' : String(stat.value).trim();
      if (!labelText || !valueText) return;

      const statItem = document.createElement('div');
      statItem.className = 'stat-item';

      const iconEl = document.createElement('div');
      iconEl.className = 'stat-icon';
      iconEl.textContent = stat.icon || '📍';

      const labelEl = document.createElement('div');
      labelEl.className = 'stat-label';
      labelEl.textContent = labelText;

      const valueEl = document.createElement('div');
      valueEl.className = 'stat-value';
      valueEl.textContent = valueText;

      statItem.appendChild(iconEl);
      statItem.appendChild(labelEl);
      statItem.appendChild(valueEl);
      statsContainer.appendChild(statItem);
    });
  }

  document.getElementById('sidebar').classList.add('active');
  
  if (window.innerWidth > 600) {
    map.easeTo({ 
      padding: { left: 350, top: 0, right: 0, bottom: 0 },
      duration: 600
    });
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('active');
  
  map.easeTo({ 
    padding: { left: 0, top: 0, right: 0, bottom: 0 },
    duration: 600
  });
  
  clearSelectedSources();
}

function openWikipediaPage() {
  const sidebarEl = document.getElementById('sidebar');
  const title = (sidebarEl && sidebarEl.dataset && sidebarEl.dataset.wikiTitle) ? sidebarEl.dataset.wikiTitle : (document.getElementById('sidebar-title')?.textContent || '');
  if (!title) {
    alert('No location selected to explore.');
    return;
  }
  const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title);
  window.open(url, '_blank', 'noopener');
}

function shareLocation() {
  const title = document.getElementById('sidebar-title').textContent;
  if (navigator.share) {
    navigator.share({
      title: title,
      text: `Check out ${title} on Netflix of Maps!`,
      url: window.location.href
    });
  } else {
    alert('Share: ' + title);
  }
}

function toggleCameraMovement() {
  cameraMovementEnabled = !cameraMovementEnabled;
  const btn = document.getElementById('camera-toggle');

  if (cameraMovementEnabled) {
    btn.textContent = ' Camera: ON';
    btn.style.background = 'rgba(255,150,150,0.2)';
  } else {
    btn.textContent = ' Camera: OFF';
    btn.style.background = 'rgba(150,150,150,0.25)';
  }
}

function generateHistoricalData(name, type) {
  const samples = {
    country: {
      imageURL: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600',
      description: `${name} has a rich history spanning thousands of years. From ancient civilizations to modern nation-states, this region has been home to countless empires and cultural movements.`,
      stats: []
    },
    city: {
      imageURL: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600',
      description: `${name} stands as one of the world's most historically significant cities. Its strategic location and cultural heritage have made it a center of commerce and learning.`,
      stats: []
    },
    river: {
      imageURL: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600',
      description: `The ${name} has been a lifeline for civilizations throughout history. Its waters have sustained agriculture and enabled trade routes.`,
      stats: []
    },
    default: {
      imageURL: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
      description: `${name} represents an important geographic feature with historical significance.`,
      stats: []
    }
  };
  
  return samples[type] || samples.default;
}

function resolveInfoboxCategory(layerId) {
  const id = String(layerId || '').toLowerCase();
  if (id.includes('country')) return 'country';
  if (id.includes('city')) return 'city';
  if (id.includes('river')) return 'river';
  if (id.includes('lake') || id.includes('sea') || id.includes('strait')) return 'sea_lake';
  return 'default';
}

function extractInfoboxTemplate(wikitext) {
  if (!wikitext) return null;
  const s = String(wikitext);
  
  // Find the opening {{infobox
  const startMatch = s.match(/\{\{infobox/i);
  if (!startMatch) return null;
  
  const startPos = startMatch.index;
  let braceCount = 2; // Count of opening braces
  let pos = startPos + 2;
  
  while (pos < s.length && braceCount > 0) {
    if (s[pos] === '{' && s[pos + 1] === '{') {
      braceCount += 2;
      pos += 2;
    } else if (s[pos] === '}' && s[pos + 1] === '}') {
      braceCount -= 2;
      if (braceCount === 0) {
        // Found the matching closing braces
        return s.substring(startPos + 9, pos).trim(); // Skip "{{infobox"
      }
      pos += 2;
    } else {
      pos++;
    }
  }
  
  return null;
}

function extractInfoboxParam(infobox, key) {
  if (!infobox || !key) return null;
  const k = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\|\\s*' + k + '\\s*=\\s*([^\\|\\n\\r]+)', 'i');
  const m = infobox.match(re);
  return m ? m[1].trim() : null;
}

function parseNumberFromText(text) {
  if (!text) return null;
  const s = String(text);
  const m = s.match(/[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

const INFOBOX_KEY_SPECS = [
  { id: 'population', keys: ['population', 'population_total', 'population_estimate', 'population_est', 'population_urban', 'population_metro'] },
  { id: 'area', keys: ['area', 'area_km2', 'area_total', 'area_total_km2', 'area_total_km', 'surface_area'] },
  { id: 'elevation', keys: ['elevation', 'elevation_m', 'elevation_ft', 'elevation_max_m', 'elevation_max'] },
  { id: 'founded', keys: ['founded', 'established', 'established_date', 'established_title', 'inception', 'formed'] },
  { id: 'density', keys: ['population_density_km2', 'population_density', 'density_km2', 'density'] },
  { id: 'timezone', keys: ['timezone', 'time_zone', 'utc_offset', 'utc_offset1'] },
  { id: 'capital', keys: ['capital', 'capital_city'] },
  { id: 'gdp', keys: ['gdp', 'gdp_nominal', 'gdp_nominal_total', 'gdp_ppp', 'gdp_ppp_total'] },
  { id: 'currency', keys: ['currency', 'currency_code'] },
  { id: 'languages', keys: ['official_languages', 'official_language', 'languages', 'language'] },
  { id: 'leader_name', keys: ['leader_name', 'leader', 'leader_title', 'leader_name1', 'president', 'prime_minister', 'governor'] },
  { id: 'driving_side', keys: ['driving_side'] },
  { id: 'length', keys: ['length', 'length_km'] },
  { id: 'discharge', keys: ['discharge', 'discharge_avg', 'discharge1_avg', 'avg_discharge'] },
  { id: 'max_depth', keys: ['max_depth', 'max_depth_m', 'depth_max', 'depth_max_m'] },
  { id: 'basin_countries', keys: ['basin_countries', 'basin_countries1', 'basin_countries2'] },
  { id: 'source', keys: ['source', 'source1_location', 'source_location', 'source1'] },
  { id: 'mouth', keys: ['mouth', 'mouth_location', 'mouth1_location'] },
  { id: 'volume', keys: ['volume', 'volume_km3'] },
  { id: 'salinity', keys: ['salinity'] }
];

function toTitleCase(s) {
  return String(s || '')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.length ? (w[0].toUpperCase() + w.slice(1)) : w)
    .join(' ');
}

function labelForKey(id) {
  const k = String(id || '').toLowerCase();
  if (k === 'gdp') return 'GDP';
  if (k === 'leader_name') return 'Leader';
  if (k === 'max_depth') return 'Max depth';
  if (k === 'basin_countries') return 'Basin countries';
  if (k === 'driving_side') return 'Driving side';
  return toTitleCase(k);
}

function iconForKey(id) {
  const k = String(id || '').toLowerCase();
  if (k.includes('population')) return '👥';
  if (k.includes('gdp')) return '💰';
  if (k.includes('capital')) return '🏛️';
  if (k.includes('currency')) return '💱';
  if (k.includes('language')) return '🗣️';
  if (k.includes('timezone') || k.includes('utc')) return '🕒';
  if (k.includes('founded') || k.includes('established') || k.includes('inception')) return '📅';
  if (k.includes('area')) return '📐';
  if (k.includes('elevation') || k.includes('height')) return '⛰️';
  if (k.includes('depth')) return '⚓';
  if (k.includes('density')) return '🧮';
  if (k.includes('discharge') || k.includes('flow')) return '💧';
  if (k.includes('basin')) return '🗺️';
  if (k.includes('source') || k.includes('mouth')) return '🌊';
  if (k.includes('volume')) return '🧊';
  if (k.includes('salinity')) return '🧂';
  if (k.includes('driving')) return '🚗';
  if (k.includes('leader')) return '👤';
  if (k.includes('length')) return '📏';
  if (k === 'coordinates' || k.includes('lat') || k.includes('lon')) return '🗺️';
  return '📍';
}

function cleanWikiValue(val) {
  if (val === null || val === undefined) return null;
  let s = String(val);

  s = s.replace(/<!--([\s\S]*?)-->/g, '');
  s = s.replace(/<ref\b[^>]*\/>/gi, '');
  s = s.replace(/<ref\b[^>]*>([\s\S]*?)<\/ref>/gi, '');
  s = s.replace(/<[^>]+>/g, '');

  s = s.replace(/\[\s*(?:\d+|note\s*\d+|nb\s*\d+)\s*\]/gi, '');
  s = s.replace(/\(\s*(?:[12]\d{3}|census|approx|approximately|est\.?|estimate|estimated|as of|as at)[^)]*\)/gi, '');

  s = s.replace(/\{\{\s*(?:convert|cvt)\s*\|([^}]+)\}\}/gi, (_m, args) => {
    const parts = String(args).split('|').map(p => p.trim()).filter(Boolean);
    const amount = parts[0];
    const unit = parts[1];
    if (!amount || !unit) return '';
    return amount + ' ' + unit;
  });

  s = s.replace(/\{\{\s*(?:nowrap|nobr)\s*\|([\s\S]*?)\}\}/gi, '$1');

  s = s.replace(/\[\[([^\]|#]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
  s = s.replace(/\[https?:\/\/[^\s\]]+\]/g, '');

  s = s.replace(/''+/g, '');
  s = s.replace(/\{\{[\s\S]*?\}\}/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  if (!s) return null;
  if (/^[-–—,.;:]+$/.test(s)) return null;
  if (s.includes('{{') || s.includes('}}') || s.includes('|')) return null;
  if (s.length > 220) return null;
  if (/\b(?:citation needed|page needed)\b/i.test(s)) return null;
  return s;
}

// Baltimore-Proof Sanitizer: robust handling of numerical data
function cleanWikiNumericalValue(text) {
   if (text === null || text === undefined) return null;

   // First clean the text using the existing cleaner
   const cleaned = cleanWikiValue(text);
   if (!cleaned) return null;

   // Comma Stripping: Remove all commas before parsing
   const withoutCommas = cleaned.replace(/,/g, '');

   // First-Number Extraction: Use regex to find the first sequence of digits
   const numberMatch = withoutCommas.match(/(\d+)/);
   if (!numberMatch) return cleaned; // Return cleaned text if no number found

   const rawNumber = numberMatch[1];
   const num = parseInt(rawNumber, 10);

   if (isNaN(num)) return cleaned;

   // Formatting: Use toLocaleString() to put commas back for UI
   return num.toLocaleString();
}

function guessTypeTitle(layerId) {
  const id = String(layerId || '').toLowerCase();
  if (id.includes('country')) return 'Country';
  if (id.includes('city')) return 'City';
  if (id.includes('river')) return 'River';
  if (id.includes('lake')) return 'Lake';
  if (id.includes('sea')) return 'Sea';
  if (id.includes('strait')) return 'Strait';
  return '';
}

function buildTitleCandidates(featureName, layerId, feature = null) {
  const typeTitle = guessTypeTitle(layerId);
  const baseRaw = String(featureName || '').trim();
  const base = baseRaw.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const out = [];

  // Extract contextual properties from feature
  const props = feature && feature.properties ? feature.properties : {};
  const country = findFirstProp(props, ['COUNTRY', 'country', 'ADMIN', 'admin', 'sovereignt', 'SOVEREIGNT']);
  const stateProvince = findFirstProp(props, ['ADM1_NAME', 'adm1_name', 'STATE', 'state', 'PROVINCE', 'province', 'REGION', 'region']);

  const typeLower = String(typeTitle || '').toLowerCase();
  const baseLower = base.toLowerCase();

  // Contextual Query Builder - Put most specific candidates first
  if (typeLower === 'city' && (stateProvince || country)) {
    // For Cities: Search [City Name], [State/Province], [Country] - prioritize full context
    if (stateProvince && country) {
      out.push(`${base}, ${stateProvince}, ${country}`);
      out.push(`${base}, ${stateProvince}`);
      out.push(`${base}, ${country}`);
    } else if (stateProvince) {
      out.push(`${base}, ${stateProvince}`);
      out.push(`${base}, ${country}`);
    } else if (country) {
      out.push(`${base}, ${country}`);
    }
  } else if (typeLower === 'river') {
    // For Rivers: Always append the word 'River' and try [Name] River ([Country]) - prioritize with context
    const riverName = /\briver\b/i.test(base) ? base : base + ' River';
    if (country) {
      out.push(`${riverName} (${country})`);
      out.push(`${base} River, ${country}`);
      out.push(`${riverName}, ${country}`);
    }
    out.push(riverName);
    out.push(`${base} River`);
  } else {
    // For Features: If a feature has an ADMIN or country property, include it
    if (country) {
      out.push(`${base} (${country})`);
      if (typeTitle) {
        out.push(`${base} ${typeTitle} (${country})`);
        out.push(`${base}, ${country}`);
        out.push(`${typeTitle} of ${base}, ${country}`);
      }
    }
  }

  // Add base name and standard variations after contextual ones
  if (base) out.push(base);

  if (typeTitle) {
    // 1) "Name Type" form
    if (!baseLower.includes(typeLower)) {
      out.push(base + ' ' + typeTitle);
    }

    // 2) "Type of Name" form
    out.push(typeTitle + ' of ' + base);

    // 3) Special flip cases when the name already includes the type word
    if (typeLower === 'strait') {
      if (/\bstrait\b/i.test(base)) {
        const without = base.replace(/\bstrait\b/ig, '').replace(/\s+/g, ' ').trim();
        if (without) out.push('Strait of ' + without);
      }
      if (/^strait\s+of\s+/i.test(base)) {
        const without = base.replace(/^strait\s+of\s+/i, '').trim();
        if (without) out.push(without + ' Strait');
      }
    }

    if (typeLower === 'river') {
      if (/\briver\b/i.test(base)) {
        const without = base.replace(/\briver\b/ig, '').replace(/\s+/g, ' ').trim();
        if (without) out.push(without + ' River');
      }
    }

    if (typeLower === 'lake') {
      if (/\blake\b/i.test(base)) {
        const without = base.replace(/\blake\b/ig, '').replace(/\s+/g, ' ').trim();
        if (without) out.push(without + ' Lake');
      }
    }

    if (typeLower === 'sea') {
      if (/\bsea\b/i.test(base)) {
        const without = base.replace(/\bsea\b/ig, '').replace(/\s+/g, ' ').trim();
        if (without) out.push(without + ' Sea');
      }
      if (/\bocean\b/i.test(base)) {
        const without = base.replace(/\bocean\b/ig, '').replace(/\s+/g, ' ').trim();
        if (without) out.push(without + ' Ocean');
      }
    }
  }

  const seen = new Set();
  return out
    .map(t => String(t || '').trim())
    .filter(Boolean)
    .filter(t => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

function extractAllInfoboxParams(infoboxText) {
  if (!infoboxText) return null;
  const out = {};
  const lines = String(infoboxText).split('\n');
  let currentKey = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match parameter lines like "| population_total = 19,082,381"
    const m = trimmed.match(/^\|\s*([^=|]+?)\s*=\s*(.*)$/);
    if (m) {
      currentKey = String(m[1] || '').trim();
      if (!currentKey) continue;
      out[currentKey.toLowerCase()] = (m[2] || '').trim();
    } else if (currentKey && trimmed && !trimmed.startsWith('|') && !trimmed.startsWith('}}')) {
      // Continuation line for multi-line values
      const k = currentKey.toLowerCase();
      out[k] = (out[k] ? (out[k] + ' ' + trimmed) : trimmed);
    }
  }
  
  // Also try to extract using regex for the whole infobox
  const allParams = String(infoboxText).match(/\|\s*([^=|]+?)\s*=\s*([^|\n]+)/g);
  if (allParams) {
    for (const param of allParams) {
      const parts = param.match(/\|\s*([^=|]+?)\s*=\s*([^|\n]+)/);
      if (parts) {
        const key = parts[1].trim().toLowerCase();
        const value = parts[2].trim();
        if (key && value && !(key in out)) {
          out[key] = value;
        }
      }
    }
  }
  
  return out;
}

function extractInfoboxStatsFromWikitext(wikitext, maxStats = 12) {
  const infobox = extractInfoboxTemplate(wikitext);
  if (!infobox) return [];

  const params = extractAllInfoboxParams(infobox) || {};
  const stats = [];
  const used = new Set();

  for (const spec of INFOBOX_KEY_SPECS) {
    if (stats.length >= maxStats) break;
    if (!spec || !spec.id) continue;
    if (used.has(spec.id)) continue;

    let raw = null;
    for (const k of (spec.keys || [])) {
      const kk = String(k || '').toLowerCase();
      if (kk && kk in params && String(params[kk]).trim() !== '') {
        raw = params[kk];
        break;
      }
      const extracted = extractInfoboxParam(infobox, k);
      if (extracted !== null && extracted !== undefined && String(extracted).trim() !== '') {
        raw = extracted;
        break;
      }
    }

    const cleaned = cleanWikiValue(raw);
    if (!cleaned) continue;

    let value = cleaned;
    if (spec.id === 'population') {
      // Baltimore-Proof Sanitizer: robust handling of numerical data
      const cleanedNum = cleanWikiNumericalValue(cleaned);
      if (cleanedNum && typeof formatNumber === 'function') {
        value = formatNumber(cleanedNum);
      } else if (cleanedNum) {
        value = cleanedNum;
      }
    } else if (spec.id === 'area') {
      if (typeof formatArea === 'function') value = formatArea(cleaned);
    } else if (spec.id === 'length') {
      if (typeof formatDistance === 'function') value = formatDistance(cleaned);
    }

    const valueText = String(value || '').trim();
    if (!valueText) continue;

    stats.push({ icon: iconForKey(spec.id), label: labelForKey(spec.id), value: valueText });
    used.add(spec.id);
  }

  return stats;
}

function findFirstProp(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }
  return null;
}

function extractGeoJsonFallbackStats(feat, layerId, maxStats = 6) {
  const p = (feat && feat.properties) ? feat.properties : {};
  const stats = [];

  const push = (id, value) => {
    if (stats.length >= maxStats) return;
    const v = (value === null || value === undefined) ? null : String(value).trim();
    if (!v) return;
    stats.push({ icon: iconForKey(id), label: labelForKey(id), value: v });
  };

  const population = findFirstProp(p, ['POP_EST','POP_MAX','pop_est','population','population_total','POPULATION']);
  if (population !== null && population !== undefined) {
    const n = parseNumberFromText(population);
    push('population', (n !== null && typeof formatNumber === 'function') ? formatNumber(n) : population);
  }

  const area = findFirstProp(p, ['AREA_KM2','AREA','area','AREA_SQKM','area_km2']);
  if (area !== null && area !== undefined) {
    push('area', (typeof formatArea === 'function') ? formatArea(area) : area);
  }

  const elevation = findFirstProp(p, ['elevation','ELEVATION','elev_m','ELEV_M','elevation_m','ELEVFT','elevation_ft']);
  if (elevation !== null && elevation !== undefined) push('elevation', elevation);

  const founded = findFirstProp(p, ['founded','inception','established','established_year','formation','start_date','INCORPORAT']);
  if (founded !== null && founded !== undefined) push('founded', founded);

  const length = findFirstProp(p, ['length_km','LENGTH_KM','LENGTH','length','len_km','LEN_KM']);
  if (length !== null && length !== undefined) {
    push('length', (typeof formatDistance === 'function') ? formatDistance(length) : length);
  }

  // Always provide some context if available
  const typeTitle = guessTypeTitle(layerId);
  if (typeTitle) push('type', typeTitle);

  return stats;
}

const WIKI_CACHE = new Map();

async function fetchWikipediaData(featureName, titleCandidates, layerId, feature) {
  if (!featureName || !titleCandidates || !titleCandidates.length) return { extract: null, image: null, wikiTitle: null, found: false, stats: [] };

  const cacheKey = String(layerId || '') + '::' + String(featureName || '');
  if (WIKI_CACHE.has(cacheKey)) {
    const cached = WIKI_CACHE.get(cacheKey);
    return cached ? Object.assign({}, cached) : { extract: null, image: null, wikiTitle: null, found: false, stats: [] };
  }

  function isDisambiguationPage(wikitext) {
    if (!wikitext) return false;
    const s = String(wikitext).toLowerCase();
    return s.includes('{{disambiguation}}') || s.includes('may refer to') || s.includes('refer to:') || s.includes('disambiguation page');
  }

  function verifyEntityType(wikitext, extract, expectedType) {
    if (!expectedType) return true; // No verification needed
    const text = (wikitext + ' ' + (extract || '')).toLowerCase();

    if (expectedType === 'city') {
      // Check for city-related terms, but not film/ship/vehicle
      if (text.includes('film') || text.includes('ship') || text.includes('vehicle') || text.includes('album') || text.includes('book')) {
        return false;
      }
      return text.includes('city') || text.includes('town') || text.includes('municipality') || text.includes('settlement') || /\{\{infobox settlement/i.test(String(wikitext));
    } else if (expectedType === 'river') {
      return text.includes('river') || /\{\{infobox river/i.test(String(wikitext));
    } else if (expectedType === 'lake') {
      return text.includes('lake') || /\{\{infobox lake/i.test(String(wikitext));
    } else if (expectedType === 'sea') {
      return text.includes('sea') || text.includes('ocean') || /\{\{infobox body of water/i.test(String(wikitext));
    } else if (expectedType === 'strait') {
      return text.includes('strait') || /\{\{infobox strait/i.test(String(wikitext));
    }
    return true;
  }

  async function queryCanonicalTitleSummaryAndImage(title) {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&redirects=1&converttitles=1&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail|original&pithumbsize=800&titles=' + encodeURIComponent(title) + '&format=json&origin=*';
    try {
      const res = await fetch(url);
      if (!res.ok) return { found: false, title: null, extract: null, image: null };
      const j = await res.json();
      const pages = j && j.query && j.query.pages;
      if (!pages) return { found: false, title: null, extract: null, image: null };
      const page = pages[Object.keys(pages)[0]];
      if (!page || page.missing !== undefined || page.invalid !== undefined) return { found: false, title: null, extract: null, image: null };
      const resolvedTitle = page.title || title;
      const extract = page.extract || null;
      const image = (page.original && page.original.source) || (page.thumbnail && page.thumbnail.source) || null;
      return { found: true, title: resolvedTitle, extract, image };
    } catch (e) {
      console.error('[queryCanonicalTitleSummaryAndImage] exception', e);
      return { found: false, title: null, extract: null, image: null };
    }
  }

  async function fetchParseWikitext(title) {
    const url = 'https://en.wikipedia.org/w/api.php?action=parse&page=' + encodeURIComponent(title) + '&prop=wikitext&section=0&redirects=1&formatversion=2&format=json&origin=*';
    try {
      const res = await fetch(url);
      if (!res.ok) return { found: false, title: null, wikitext: null };
      const j = await res.json();
      if (j && j.error) return { found: false, title: null, wikitext: null };
      const resolvedTitle = j?.parse?.title || title;
      const wikitext = (j && j.parse && j.parse.wikitext && typeof j.parse.wikitext === 'object' && ('*' in j.parse.wikitext))
        ? j.parse.wikitext['*']
        : j?.parse?.wikitext;
      console.debug('[fetchParseWikitext] title=', title, 'resolvedTitle=', resolvedTitle, 'wikitext length=', wikitext ? wikitext.length : 0);
      return { found: true, title: resolvedTitle, wikitext };
    } catch (e) {
      console.error('[fetchParseWikitext] exception', e);
      return { found: false, title: null, wikitext: null };
    }
  }

  const expectedType = layerId.includes('city') ? 'city' :
                      layerId.includes('river') ? 'river' :
                      layerId.includes('lake') ? 'lake' :
                      layerId.includes('sea') ? 'sea' :
                      layerId.includes('strait') ? 'strait' : null;

  for (const cand of titleCandidates) {
    console.log(`[Wiki Attempt]: Searching for "${cand}"...`);
    const canonical = await queryCanonicalTitleSummaryAndImage(cand);
    if (!canonical.found || !canonical.title) {
      console.log(`[Wiki Result]: "${cand}" not found`);
      continue;
    }
    const parsed = await fetchParseWikitext(canonical.title);
    if (!parsed.found) {
      console.log(`[Wiki Result]: "${cand}" wikitext fetch failed`);
      continue;
    }

    // Check for disambiguation
    if (isDisambiguationPage(parsed.wikitext)) {
      console.log(`[Wiki Result]: "${cand}" is a disambiguation page, trying next candidate`);
      continue;
    }

    // Entity verification
    if (!verifyEntityType(parsed.wikitext, canonical.extract, expectedType)) {
      console.log(`[Wiki Result]: "${cand}" entity type mismatch, trying next candidate`);
      continue;
    }

    const stats = extractInfoboxStatsFromWikitext(parsed.wikitext, 12);
    const result = {
      found: true,
      wikiTitle: parsed.title || canonical.title,
      extract: canonical.extract,
      image: canonical.image,
      stats
    };
    console.log(`[Wiki Result]: Found Article "${result.wikiTitle}"`);
    WIKI_CACHE.set(cacheKey, result);
    return Object.assign({}, result);
  }

  console.log(`[Wiki Result]: No suitable article found for "${featureName}"`);
  const miss = { extract: null, image: null, wikiTitle: null, found: false, stats: [] };
  WIKI_CACHE.set(cacheKey, miss);
  return Object.assign({}, miss);
}

async function fetchWikidataStats(title) {
  return null;
}
