/**
 * Standalone Search Engine for MapLibre Project
 * Works with existing coolmap.js without modifications
 */

// Global search index
let searchIndex = [];

// Simple fuzzy search using string similarity
function fuzzyMatch(query, text) {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match gets highest score
  if (textLower.includes(queryLower)) {
    return { score: 1.0, match: true };
  }
  
  // Check for word boundaries
  const words = textLower.split(/\s+/);
  for (const word of words) {
    if (word.includes(queryLower)) {
      return { score: 0.9, match: true };
    }
  }
  
  // Simple character matching for partial matches
  let matches = 0;
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches++;
      queryIndex++;
    }
  }
  
  const similarity = matches / queryLower.length;
  if (similarity >= 0.6) {
    return { score: similarity * 0.7, match: true };
  }
  
  return { score: 0, match: false };
}

// Search features with fuzzy matching
function searchFeatures(query, limit = 10) {
  if (!query || query.length < 2) return [];
  
  const results = searchIndex
    .map(item => {
      const titleMatch = fuzzyMatch(query, item.title);
      let bestAltMatch = { score: 0, match: false };
      
      // Check alternative name fields
      const altFields = ['name_en', 'ADMIN', 'admin', 'label', 'label_en'];
      for (const field of altFields) {
        if (item.properties && item.properties[field]) {
          const altMatch = fuzzyMatch(query, String(item.properties[field]));
          if (altMatch.score > bestAltMatch.score) {
            bestAltMatch = altMatch;
          }
        }
      }
      
      const bestMatch = titleMatch.score > bestAltMatch.score ? titleMatch : bestAltMatch;
      
      return {
        ...item,
        searchScore: bestMatch.score
      };
    })
    .filter(item => item.searchScore > 0)
    .sort((a, b) => b.searchScore - a.searchScore)
    .slice(0, limit);
  
  return results;
}

// Get center coordinates from geometry
function getGeometryCenter(geometry) {
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
  
  if (coords.length === 0) return [0, 0];
  
  let sumLng = 0, sumLat = 0;
  coords.forEach(coord => {
    sumLng += coord[0];
    sumLat += coord[1];
  });
  
  return [sumLng / coords.length, sumLat / coords.length];
}

// Calculate geometry size for smart zoom
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

// Find name property (same logic as coolmap.js)
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

// Build search index from existing map sources
async function buildSearchIndex() {
  searchIndex = [];
  
  // Wait for map to be ready
  if (!map || !map.getStyle()) {
    console.log('Map not ready, waiting...');
    setTimeout(buildSearchIndex, 1000);
    return;
  }
  
  console.log('Building search index from existing sources...');
  const startTime = performance.now();
  
  // Source URLs (same as coolmap.js)
  const sources = {
    countries: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
    seas: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson',
    lakes: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson',
    rivers: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
    straits: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_lines.geojson',
    cities: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
  };
  
  await Promise.all(Object.entries(sources).map(async ([key, url]) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const geojson = await response.json();
      if (!geojson.features) return;
      
      geojson.features.forEach((feature, idx) => {
        const nameInfo = findNameProperty(feature);
        if (!nameInfo) return;
        
        const centerCoords = getGeometryCenter(feature.geometry);
        
        searchIndex.push({
          id: `${key}-${idx}`,
          source: key,
          title: nameInfo.value,
          properties: feature.properties || {},
          geometry: feature.geometry,
          feature: feature,
          centerCoords: centerCoords
        });
      });
    } catch (error) {
      console.warn('Search index fetch error for', key, error);
    }
  }));
  
  // Remove duplicates while preserving priority
  const seen = new Map();
  searchIndex = searchIndex.filter(item => {
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
  console.log(`Search index built with ${searchIndex.length} features in ${(endTime - startTime).toFixed(0)}ms`);
}

// Render search results
function renderSearchResults(results) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  
  if (!results || results.length === 0) {
    resultsEl.style.display = 'none';
    return;
  }
  
  results.forEach(result => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.tabIndex = 0;
    
    // Create result HTML
    div.innerHTML = `
      <div>
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-sub">${result.source}</div>
      </div>
    `;
    
    // Handle click events
    div.onclick = () => {
      resultsEl.style.display = 'none';
      document.getElementById('global-search').value = '';
      
      // Map source to hit layer
      const hitMap = {
        countries: 'country-hit',
        seas: 'sea-hit', 
        lakes: 'lake-hit',
        rivers: 'river-hit',
        straits: 'strait-hit',
        cities: 'city-hit'
      };
      
      const hitLayer = hitMap[result.source] || 'country-hit';
      
      // Smart zoom logic
      const currentZoom = map.getZoom();
      let targetZoom = 8; // default
      
      if (result.source === 'countries') {
        // Countries: zoom out to country level (3-6)
        const geometrySize = calculateGeometrySize(result.geometry);
        if (geometrySize > 100) targetZoom = 3;
        else if (geometrySize > 50) targetZoom = 4;
        else if (geometrySize > 20) targetZoom = 5;
        else targetZoom = 6;
      } else if (result.source === 'cities') {
        // Cities: zoom to city level (8-12)
        targetZoom = 10;
      } else if (result.source === 'rivers') {
        // Rivers: zoom to river level (5-8)
        targetZoom = 6;
      } else {
        // Other features: moderate zoom
        targetZoom = 7;
      }
      
      // Use existing cinematicFlyTo if available, otherwise simple flyTo
      if (typeof cinematicFlyTo === 'function') {
        // For search results, use simple flyTo with our smart zoom
        map.flyTo({
          center: result.centerCoords,
          zoom: targetZoom,
          duration: 1500
        });
      } else {
        map.flyTo({
          center: result.centerCoords,
          zoom: targetZoom,
          duration: 1500
        });
      }
      
      // Use existing handleFeatureSelection if available
      if (typeof handleFeatureSelection === 'function') {
        handleFeatureSelection(result.feature, hitLayer);
      }
    };
    
    resultsEl.appendChild(div);
  });
  
  resultsEl.style.display = 'flex';
}

// Initialize search functionality
function initializeSearch() {
  const input = document.getElementById('global-search');
  const resultsEl = document.getElementById('search-results');
  
  if (!input || !resultsEl) {
    console.error('Search elements not found');
    return;
  }
  
  let searchTimeout;
  
  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (!query) {
      resultsEl.style.display = 'none';
      resultsEl.innerHTML = '';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      const matches = searchFeatures(query);
      renderSearchResults(matches);
    }, 200);
  });
  
  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    const container = document.getElementById('search-container');
    if (!container.contains(e.target)) {
      resultsEl.style.display = 'none';
    }
  });
}

// Wait for map to load, then initialize
map.on('load', () => {
  console.log('Map loaded, initializing search...');
  buildSearchIndex().then(() => {
    initializeSearch();
  });
});

// Also initialize if map is already loaded
if (map && map.isStyleLoaded()) {
  buildSearchIndex().then(() => {
    initializeSearch();
  });
}
