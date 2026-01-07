  // --- Unified selection handler ---
  async function handleFeatureSelection(feat, hitLayer, clickLngLat) {
    clearSelectedSources();
    const nameInfo = findNameProperty(feat);
    const displayName = nameInfo ? nameInfo.value : (feat.properties && (feat.properties.name || feat.properties.NAME || feat.properties.ADMIN)) || 'Unknown';
    const selectedFeature = { type: 'Feature', geometry: feat.geometry, properties: Object.assign({}, feat.properties || {}, { displayName }) };

    const mapping = {
      'city-hit':'city-selected',
      'river-hit':'river-selected',
      'strait-hit':'strait-selected',
      'lake-hit':'lake-selected',
      'sea-hit':'sea-selected',
      'country-hit':'country-selected'
    };
    const selSource = mapping[hitLayer] || 'country-selected';
    if (map.getSource(selSource)) {
      try { map.getSource(selSource).setData({ type: 'FeatureCollection', features: [selectedFeature] }); } catch(e) { console.warn(e); }
    }

    // quick info
    info.style.display = 'block';
    info.innerHTML = `<h3>${displayName}</h3>`;

    // optimistic sidebar — prefer real stats from the feature when present
    const featureType = hitLayer.includes('city') ? 'city' : hitLayer.includes('river') ? 'river' : hitLayer.includes('country') ? 'country' : 'default';
    const baseData = generateHistoricalData(displayName, featureType);
    try {
      const realStats = extractFeatureStats(feat, hitLayer, feat.geometry);
      if (realStats && realStats.length) {
        baseData.stats = realStats;
      } else {
        const typeLabel = hitLayer.includes('city') ? 'City' : hitLayer.includes('river') ? 'River' : hitLayer.includes('lake') ? 'Lake' : hitLayer.includes('sea') ? 'Sea' : hitLayer.includes('country') ? 'Country' : 'Feature';
        baseData.stats = [{ icon: '📍', label: 'Type', value: typeLabel }];
      }
    } catch (e) { console.warn('stat extraction failed', e); }

    // show loading text while summary fetch runs
    updateSidebar({ title: displayName, description: 'Loading summary...', imageURL: baseData.imageURL, stats: baseData.stats, wikiTitle: displayName });

    // Build smart priority queries for disambiguation
    const props = feat.properties || {};
    const state = findFirstProp(props, ['admin_name', 'adm1_name', 'STATE', 'state', 'PROVINCE', 'province', 'REGION', 'region']);
    const country = findFirstProp(props, ['ADMIN', 'admin', 'sovereignt', 'SOVEREIGNT', 'COUNTRY', 'country']);
    const layerType = hitLayer.replace('-hit', ''); // city, river, etc.

    console.log(`[Map Selection]: ${displayName} (Layer: ${hitLayer})`);
    console.log(`[Context Extraction]: State=${state || 'N/A'}, Country=${country || 'N/A'}`);

    const priorityQueries = [];
    const baseName = displayName.trim();

    if (layerType === 'city') {
      if (state && country) {
        priorityQueries.push(`${baseName}, ${state}, ${country}`); // Highly specific
        priorityQueries.push(`${baseName}, ${state}`);
        priorityQueries.push(`${baseName}, ${country}`);
      } else if (state) {
        priorityQueries.push(`${baseName}, ${state}`);
      } else if (country) {
        priorityQueries.push(`${baseName}, ${country}`);
      }
      priorityQueries.push(`${baseName} city`); // Entity verification fallback
      priorityQueries.push(baseName); // Last resort
    } else if (layerType === 'river') {
      const riverName = baseName.toLowerCase().includes('river') ? baseName : `${baseName} River`;
      if (country) {
        priorityQueries.push(`${riverName} (${country})`);
        priorityQueries.push(`${riverName}, ${country}`);
      }
      priorityQueries.push(riverName);
      priorityQueries.push(`${baseName} River`); // Fallback
      priorityQueries.push(baseName); // Last resort
    } else if (layerType === 'lake') {
      const lakeName = baseName.toLowerCase().includes('lake') ? baseName : `${baseName} Lake`;
      if (country) {
        priorityQueries.push(`${lakeName} (${country})`);
        priorityQueries.push(`${lakeName}, ${country}`);
      }
      priorityQueries.push(lakeName);
      priorityQueries.push(`${baseName} Lake`);
      priorityQueries.push(baseName);
    } else if (layerType === 'sea') {
      const seaName = baseName.toLowerCase().includes('sea') ? baseName : `${baseName} Sea`;
      if (country) {
        priorityQueries.push(`${seaName} (${country})`);
        priorityQueries.push(`${seaName}, ${country}`);
      }
      priorityQueries.push(seaName);
      priorityQueries.push(baseName);
    } else if (layerType === 'strait') {
      const straitName = baseName.toLowerCase().includes('strait') ? baseName : `${baseName} Strait`;
      if (country) {
        priorityQueries.push(`${straitName} (${country})`);
        priorityQueries.push(`${straitName}, ${country}`);
      }
      priorityQueries.push(straitName);
      priorityQueries.push(baseName);
    } else { // country or default
      if (country) {
        priorityQueries.push(`${baseName} (${country})`);
        priorityQueries.push(`${baseName}, ${country}`);
      }
      priorityQueries.push(baseName);
    }

    // try wiki (summary + image + infobox stats)
    try {
      const wiki = await fetchWikipediaData(displayName, priorityQueries, hitLayer, feat);
      const desc = (wiki && wiki.extract) ? wiki.extract : 'No summary available.';
      const img = (wiki && wiki.image) ? wiki.image : baseData.imageURL;

      let finalStats = (wiki && wiki.stats && wiki.stats.length) ? wiki.stats.slice(0, 12) : [];
      const wikiTitle = (wiki && wiki.wikiTitle) ? wiki.wikiTitle : displayName;

      if (!finalStats || !finalStats.length) {
        const geo = extractGeoJsonFallbackStats(feat, hitLayer, 6);
        // Treat a single "Type" stat as non-informative.
        const informativeGeo = (geo && geo.length === 1 && String(geo[0].label || '').toLowerCase() === 'type') ? [] : geo;
        finalStats = (informativeGeo && informativeGeo.length) ? informativeGeo : [{ icon: 'ℹ️', label: 'Information', value: 'Discovery in progress.' }];
      }

      updateSidebar({ title: displayName, description: desc, imageURL: img, stats: finalStats, wikiTitle });
    } catch (e) {
      console.warn('Wiki fetch err', e);
      updateSidebar({ title: displayName, description: 'No summary available.', imageURL: baseData.imageURL, stats: baseData.stats, wikiTitle: displayName });
    }

    // cinematic flight
    const targetCoordinates = getGeometryCenter(feat.geometry, clickLngLat || map.getCenter());
    const isSidebarOpen = document.getElementById('sidebar').classList.contains('active');
    cinematicFlyTo(targetCoordinates, feat.geometry, isSidebarOpen, hitLayer);
  }

  map.on('click', e => {
        // clear previous selection
    clearSelectedSources();

    const order = [
      { hit: 'river-hit', selSource: 'river-selected' },
      { hit: 'city-hit', selSource: 'city-selected' },
      { hit: 'strait-hit', selSource: 'strait-selected' },
      { hit: 'lake-hit', selSource: 'lake-selected' },
      { hit: 'sea-hit', selSource: 'sea-selected' },
      { hit: 'country-hit', selSource: 'country-selected' }
    ];

    for (const item of order) {
      if (!exists(item.hit)) continue;
      const features = map.queryRenderedFeatures(e.point, { layers: [item.hit] });
      if (!features || !features.length) continue;
      const feat = features[0];

      // Delegate to unified handler (ensures wiki enrichment and consistent behavior)
      handleFeatureSelection(feat, item.hit, e.lngLat);
      return;
    }

  // nothing clicked
  hideInfo();
});

/* cursor feedback */
map.on('mousemove', e => {
  const interactive = ['country-hit','river-hit','strait-hit','sea-hit','lake-hit','city-hit'];
  const available = interactive.filter(l => !!map.getLayer(l));
  const features = available.length ? map.queryRenderedFeatures(e.point, { layers: available }) : [];
  map.getCanvas().style.cursor = features.length ? 'pointer' : '';
});

/* ---------- CINEMATIC NAVIGATION ---------- */
/* ---------- CINEMATIC NAVIGATION ---------- */

/**
 * Calculate the bounding box area of a geometry (in approximate square degrees)
 */
function calculateGeometrySize(geometry) {
  if (!geometry) return 0;
  
  if (geometry.type === 'Point') {
    return 0;
  }
  
  let coords = [];
  
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0][0];
  } else if (geometry.type === 'LineString') {
    coords = geometry.coordinates;
  } else if (geometry.type === 'MultiLineString') {
    coords = geometry.coordinates[0];
  }
  
  if (coords.length === 0) return 0;
  
  let minLng = coords[0][0], maxLng = coords[0][0];
  let minLat = coords[0][1], maxLat = coords[0][1];
  
  coords.forEach(coord => {
    minLng = Math.min(minLng, coord[0]);
    maxLng = Math.max(maxLng, coord[0]);
    minLat = Math.min(minLat, coord[1]);
    maxLat = Math.max(maxLat, coord[1]);
  });
  
  const width = maxLng - minLng;
  const height = maxLat - minLat;
  
  return width * height;
}

/**
 * Determine optimal zoom level based on geometry size
 */
function getOptimalZoom(geometrySize, geometryType, hitLayer) {
  // For cities, zoom to country level (4-6) instead of city level (12)
  if (hitLayer && hitLayer.includes('city')) {
    // Use country-level zoom ranges for cities
    if (geometrySize > 100) {
      return 4;
    } else if (geometrySize > 50) {
      return 5;
    } else if (geometrySize > 20) {
      return 6;
    } else if (geometrySize > 5) {
      return 6.5;
    } else if (geometrySize > 1) {
      return 7;
    } else if (geometrySize > 0.1) {
      return 7.5;
    } else {
      return 8;
    }
  }
  
  // For rivers, use country-level zoom based on their location
  if (hitLayer && hitLayer.includes('river')) {
    // Always zoom to country level for rivers (4-6)
    // This ensures rivers show their geographical context
    return 5; // Fixed country-level zoom for all rivers
  }
  
  if (geometryType === 'Point') {
    return 12;
  }
  
  if (geometrySize > 100) {
    return 4;
  } else if (geometrySize > 50) {
    return 5;
  } else if (geometrySize > 20) {
    return 6;
  } else if (geometrySize > 5) {
    return 7;
  } else if (geometrySize > 1) {
    return 7.5;
  } else if (geometrySize > 0.1) {
    return 8;
  } else {
    return 10;
  }
}

/**
 * Get the center point of a geometry
 */
function getGeometryCenter(geometry, clickLngLat) {
  if (geometry.type === 'Point') {
    return geometry.coordinates;
  }
  
  let coords = [];
  
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0][0];
  } else if (geometry.type === 'LineString') {
    coords = geometry.coordinates;
  } else if (geometry.type === 'MultiLineString') {
    coords = geometry.coordinates[0];
  }
  
  if (coords.length === 0) {
    return [clickLngLat.lng, clickLngLat.lat];
  }
  
  let sumLng = 0, sumLat = 0;
  coords.forEach(coord => {
    sumLng += coord[0];
    sumLat += coord[1];
  });
  
  return [sumLng / coords.length, sumLat / coords.length];
}
/**
 * Cinematic fly-to with parabolic curve, smart zoom, and 3D tilt
 * @param {Array} coordinates - [lng, lat] destination
 * @param {Boolean} isSidebarOpen - whether sidebar is currently open
 */
/**
 * Cinematic fly-to with size-aware zoom and 3D tilt
 */
function cinematicFlyTo(coordinates, geometry, isSidebarOpen, hitLayer) {
  if (!cameraMovementEnabled) { return; }
  
  const currentZoom = map.getZoom();
  const currentCenter = map.getCenter();
  
  const distance = calculateDistance(
    currentCenter.lat, 
    currentCenter.lng, 
    coordinates[1], 
    coordinates[0]
  );
  
  // Calculate geometry size and determine optimal zoom
  const geometrySize = calculateGeometrySize(geometry);
  
  // Use current zoom if zoom is disabled, otherwise calculate optimal zoom
  const targetZoom = zoomEnabled 
    ? getOptimalZoom(geometrySize, geometry?.type || 'Point', hitLayer)
    : currentZoom;
  
  // For cities: if we're already at country-level zoom, don't zoom further
  let finalTargetZoom = targetZoom;
  if (hitLayer && hitLayer.includes('city') && targetZoom <= 8) {
    // If current zoom is already at country level (4-8), stay at current zoom
    if (currentZoom >= 4 && currentZoom <= 8) {
      finalTargetZoom = currentZoom;
    } else {
      finalTargetZoom = targetZoom;
    }
  }
  
  // City-specific zoom cap
  if (hitLayer && hitLayer.includes('city')) {
    finalTargetZoom = Math.min(finalTargetZoom, 8); // Max zoom 8 for cities
  }
  
  const targetPitch = zoomEnabled ? 45 : 0;
  const targetBearing = zoomEnabled ? 20 : 0;

  if (zoomEnabled) {
    console.log(`Flying to feature - Size: ${geometrySize.toFixed(4)} sq deg, Target Zoom: ${finalTargetZoom}`);
  } else {
    console.log(`Zoom disabled - panning only to feature`);
  }
  
  // Dynamic speed and curve based on distance - much slower for cinematic feel
  let speed, curve;
  if (distance < 200) { // Short distance (city to city)
    speed = 0.3; // Much slower
    curve = 1.2; // Gentler arc
  } else { // Long distance (country to city)
    speed = 0.5; // Much slower
    curve = 1.6; // More dramatic arc
  }
  
  // Wait for sidebar to be fully open before applying padding
  setTimeout(() => {
    const padding = isSidebarOpen ? 
      { left: 350, top: 0, right: 0, bottom: 0 } : 
      { left: 0, top: 0, right: 0, bottom: 0 };
    
    // Single unified flyTo call
    map.flyTo({
      center: coordinates,
      zoom: finalTargetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      speed: speed,
      curve: curve,
      padding: padding,
      essential: true,
      easing: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 // Ease-In-Out-Cubic
    });
  }, isSidebarOpen ? 100 : 0); // Small delay if sidebar is opening
}

/**
* Reset map to original view
 */
function resetMap() {
  const sidebar = document.getElementById('sidebar');
  const wasOpen = sidebar.classList.contains('active');
  
  if (wasOpen) {
    closeSidebar();
  }
  
  clearSelectedSources();
  
  map.flyTo({
    center: [10, 20],
    zoom: 2,
    pitch: 0,
    bearing: 0,
    speed: 0.7,
    curve: 1.42,
    padding: { left: 0, top: 0, right: 0, bottom: 0 },
    essential: true,
    duration: 2000
  });
}

/*Toggle zoom on/off for click interactions*/
function toggleZoom() {
  zoomEnabled = !zoomEnabled;
  const btn = document.getElementById('zoom-toggle');
  
  if (zoomEnabled) {
    btn.textContent = '🔍 Zoom: ON';
    btn.style.background = 'rgba(100,255,100,0.2)';
  } else {
    btn.textContent = '🔍 Zoom: OFF';
    btn.style.background = 'rgba(255,255,100,0.2)';
  }
}

// --- Enhanced Search Index with Fuzzy Search ---
  let geoSearchIndex = [];
  
  // Fuzzy search implementation using Levenshtein distance
  function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    return matrix[str2.length][str1.length];
  }
  
  function fuzzyMatch(query, text, threshold = 0.6) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower.includes(queryLower)) {
      return { score: 1.0, match: true, type: 'exact' };
    }
    
    // Check for word boundaries
    const words = textLower.split(/\s+/);
    for (const word of words) {
      if (word.includes(queryLower)) {
        return { score: 0.9, match: true, type: 'word' };
      }
    }
    
    // Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(queryLower, textLower);
    const maxLength = Math.max(queryLower.length, textLower.length);
    const similarity = 1 - (distance / maxLength);
    
    if (similarity >= threshold) {
      return { score: similarity * 0.8, match: true, type: 'fuzzy' };
    }
    
    return { score: 0, match: false, type: 'none' };
  }
  
  function searchFeatures(query, limit = 10) {
    if (!query || query.length < 2) return [];
    
    const results = geoSearchIndex
      .map(item => {
        // Primary search on title
        const titleMatch = fuzzyMatch(query, item.title);
        
        // Secondary search on alternative name properties
        let bestAltMatch = { score: 0, match: false, type: 'none' };
        const altFields = ['name_en', 'ADMIN', 'admin', 'label', 'label_en'];
        
        for (const field of altFields) {
          if (item.properties && item.properties[field]) {
            const altMatch = fuzzyMatch(query, String(item.properties[field]));
            if (altMatch.score > bestAltMatch.score) {
              bestAltMatch = altMatch;
            }
          }
        }
        
        // Use the best match
        const bestMatch = titleMatch.score > bestAltMatch.score ? titleMatch : bestAltMatch;
        
        return {
          ...item,
          searchScore: bestMatch.score,
          matchType: bestMatch.type
        };
      })
      .filter(item => item.searchScore > 0)
      .sort((a, b) => {
        // Sort by score first, then by source priority
        if (Math.abs(a.searchScore - b.searchScore) > 0.01) {
          return b.searchScore - a.searchScore;
        }
        
        // Source priority: cities > countries > rivers > seas > lakes > straits
        const sourcePriority = {
          cities: 6, countries: 5, rivers: 4, seas: 3, lakes: 2, straits: 1
        };
        
        return (sourcePriority[a.source] || 0) - (sourcePriority[b.source] || 0);
      })
      .slice(0, limit);
    
    return results;
  }
  
  async function buildSearchIndex() {
    geoSearchIndex = [];
    const sources = {
      countries: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
      seas: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson',
      lakes: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
      rivers: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
      straits: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_lines.geojson',
      cities: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
    };
    
    console.log('Building search index...');
    const startTime = performance.now();
    
    await Promise.all(Object.entries(sources).map(async ([key, url]) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        const g = await r.json();
        if (!g.features) return;
        
        g.features.forEach((f, idx) => {
          const n = findNameProperty(f);
          if (!n) return;
          
          // Calculate center coordinates for flyTo
          let centerCoords = [0, 0];
          if (f.geometry) {
            centerCoords = getGeometryCenter(f.geometry, { lng: 0, lat: 0 });
          }
          
          geoSearchIndex.push({
            id: `${key}-${idx}`,
            source: key,
            title: n.value,
            properties: f.properties || {},
            geometry: f.geometry,
            feature: f,
            centerCoords: centerCoords
          });
        });
      } catch (e) {
        console.warn('Index fetch error for', key, e);
      }
    }));
    
    // Dedupe by title while preserving highest priority source
    const seen = new Map();
    geoSearchIndex = geoSearchIndex.filter(item => {
      const existing = seen.get(item.title);
      const sourcePriority = {
        cities: 6, countries: 5, rivers: 4, seas: 3, lakes: 2, straits: 1
      };
      const itemPriority = sourcePriority[item.source] || 0;
      const existingPriority = existing ? sourcePriority[existing.source] || 0 : 0;
      
      if (!existing || itemPriority > existingPriority) {
        seen.set(item.title, item);
        return true;
      }
      return false;
    });
    
    const endTime = performance.now();
    console.log(`Search index built with ${geoSearchIndex.length} features in ${(endTime - startTime).toFixed(0)}ms`);
  }

  function renderSearchResults(results) {
    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '';
    if (!results || results.length === 0) { resultsEl.style.display = 'none'; return; }
    results.forEach(r => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.tabIndex = 0;
      div.innerHTML = `<div>
        <div class="search-result-title">${r.title}</div>
        <div class="search-result-sub">${r.source}</div>
      </div>`;
      div.onclick = () => {
        resultsEl.style.display = 'none';
        document.getElementById('global-search').value = '';
        const hitMap = { countries: 'country-hit', seas: 'sea-hit', lakes: 'lake-hit', rivers: 'river-hit', straits: 'strait-hit', cities: 'city-hit' };
        const hitLayer = hitMap[r.source] || 'country-hit';
        handleFeatureSelection(r.feature, hitLayer);
      };
      resultsEl.appendChild(div);
    });
    resultsEl.style.display = 'flex';
  }

  // wire search input
  (function() {
    const input = document.getElementById('global-search');
    const resultsEl = document.getElementById('search-results');
    let t = null;
    input.addEventListener('input', e => {
      const q = e.target.value.trim();
      clearTimeout(t);
      if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
      t = setTimeout(() => {
        const ql = q.toLowerCase();
        const matches = geoSearchIndex.filter(item =>
          item.title.toLowerCase().includes(ql) ||
          (item.properties && (String(item.properties.name_en || '').toLowerCase().includes(ql) || String(item.properties.ADMIN || '').toLowerCase().includes(ql)))
        ).slice(0, 10);
        renderSearchResults(matches);
      }, 200);
    });

    document.addEventListener('click', (ev) => {
      const container = document.getElementById('search-container');
      if (!container.contains(ev.target)) {
        resultsEl.style.display = 'none';
      }
    });
  })();
