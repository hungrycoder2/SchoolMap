function addAllLayers() {
  // remove any leftover selected sources/layers first (safe re-add)
  const maybeRemove = id => {
    if (map.getLayer(id)) try { map.removeLayer(id); } catch(e) {}
    if (map.getSource(id)) try { map.removeSource(id); } catch(e) {}
  };

  // remove selected sources/layers so we can recreate them cleanly
  ['country-selected','river-selected','strait-selected','lake-selected','sea-selected','city-selected'].forEach(maybeRemove);

  // COUNTRIES
  if (map.getSource('countries')) map.removeSource('countries');
  map.addSource('countries', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
  });

  if (!map.getLayer('country-fill')) {
    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': '#3a86ff', 'fill-opacity': 0.25 }
    });
  }

  if (!map.getLayer('country-hit')) {
    map.addLayer({
      id: 'country-hit',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-opacity': 0 }
    });
  }

  // country selected source + glow layer (only the selected country will be here)
  map.addSource('country-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'country-selected-glow',
    type: 'line',
    source: 'country-selected',
    paint: {
      'line-color': '#9bf6ff',
      'line-width': 6,
      'line-opacity': 0.95,
      'line-blur': 3
    }
  });

  // SEAS
  if (map.getSource('seas')) map.removeSource('seas');
  map.addSource('seas', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson'
  });

  if (!map.getLayer('sea-fill')) {
    map.addLayer({
      id: 'sea-fill',
      type: 'fill',
      source: 'seas',
      paint: { 'fill-color': '#1e6091', 'fill-opacity': 0.25 }
    });
  }

  if (!map.getLayer('sea-hit')) {
    map.addLayer({
      id: 'sea-hit',
      type: 'fill',
      source: 'seas',
      paint: { 'fill-opacity': 0 }
    });
  }

  map.addSource('sea-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'sea-selected-glow',
    type: 'line',
    source: 'sea-selected',
    paint: {
      'line-color': '#80edff',
      'line-width': 6,
      'line-opacity': 0.9,
      'line-blur': 2
    }
  });

  // LAKES
  if (map.getSource('lakes')) map.removeSource('lakes');
  map.addSource('lakes', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson'
  });

  if (!map.getLayer('lake-fill')) {
    map.addLayer({
      id: 'lake-fill',
      type: 'fill',
      source: 'lakes',
      paint: { 'fill-color': '#1e6091', 'fill-opacity': 0.35 }
    });
  }

  if (!map.getLayer('lake-hit')) {
    map.addLayer({
      id: 'lake-hit',
      type: 'fill',
      source: 'lakes',
      paint: { 'fill-opacity': 0 }
    });
  }

  map.addSource('lake-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'lake-selected-glow',
    type: 'line',
    source: 'lake-selected',
    paint: {
      'line-color': '#80edff',
      'line-width': 6,
      'line-opacity': 0.9,
      'line-blur': 2
    }
  });

  // RIVERS
  if (map.getSource('rivers')) map.removeSource('rivers');
  map.addSource('rivers', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson'
  });

  if (!map.getLayer('river-line')) {
    map.addLayer({
      id: 'river-line',
      type: 'line',
      source: 'rivers',
      minzoom: 2,
      paint: { 
        'line-color': '#4cc9f0', 
        'line-width': 2,
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          2, 0,
          2.5, 0.2,
          3, 0.8,
          4, 1
        ]
      }
    });
  }

  if (!map.getLayer('river-hit')) {
    map.addLayer({
      id: 'river-hit',
      type: 'line',
      source: 'rivers',
      minzoom: 4, // Only active when rivers are visible
      paint: {
        'line-color': 'rgba(0, 0, 0, 0)',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          0, 10,
          4, 14,
          8, 22,
          12, 44
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          2, 0,
          2.5, 0,
          3, 0,
          4, 0.01,
          5, 0.01
        ]
      }
    });
  }

  map.addSource('river-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'river-selected-glow',
    type: 'line',
    source: 'river-selected',
    minzoom: 2,
    paint: {
      'line-color': '#90dbf4',
      'line-width': 8,
      'line-opacity': 0.95,
      'line-blur': 3
    }
  });

  // STRAITS (marine lines)
  if (map.getSource('straits')) map.removeSource('straits');
  map.addSource('straits', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_lines.geojson'
  });

  if (!map.getLayer('strait-hit')) {
    map.addLayer({
      id: 'strait-hit',
      type: 'line',
      source: 'straits',
      paint: {
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          0, 8,
          4, 12,
          8, 20
        ],
        'line-opacity': 0
      }
    });
  }

  map.addSource('strait-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'strait-selected-glow',
    type: 'line',
    source: 'strait-selected',
    paint: {
      'line-color': '#ffd166',
      'line-width': 8,
      'line-opacity': 0.95,
      'line-blur': 3
    }
  });

  // CITIES (tiered by population + capitals)
  if (map.getSource('cities')) map.removeSource('cities');
  map.addSource('cities', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
  });

  // helper expression to find the population property from various possible names
  const popExpr = ['coalesce', ['get', 'POP_MAX'], ['get', 'pop_max'], ['get', 'POP_EST'], ['get', 'pop_est'], ['get', 'population'], 0];
    
  const isCapital = ['any',
  ['==', ['get', 'capital'], 1],
  ['==', ['get', 'FEATURECLA'], 'Admin-0 capital'],
  ['==', ['get', 'featurecla'], 'Admin-0 capital']
];

 // Capitals (visible very early)
map.addLayer({
  id: 'city-capitals',
  type: 'circle',
  source: 'cities',
  minzoom: 2.5,
  filter: isCapital,
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5, 5, 9, 8, 14],
    'circle-color': '#ff8b8b',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 1
  }
});

map.addLayer({
  id: 'city-5m',
  type: 'circle',
  source: 'cities',
  minzoom: 3,
  filter: ['all',
    ['>=', popExpr, 5000000],
    ['!', isCapital]
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 6, 9],
    'circle-color': '#ffd166',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 1
  }
});

map.addLayer({
  id: 'city-1m',
  type: 'circle',
  source: 'cities',
  minzoom: 4.5,
  filter: ['all',
    ['>=', popExpr, 1000000],
    ['<', popExpr, 5000000]
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 8],
    'circle-color': '#ffd166',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 1
  }
});

map.addLayer({
  id: 'city-500k',
  type: 'circle',
  source: 'cities',
  minzoom: 6,
  filter: ['all',
    ['>=', popExpr, 500000],
    ['<', popExpr, 1000000]
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 9, 6],
    'circle-color': '#ffd166',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 1
  }
});

map.addLayer({
  id: 'city-100k',
  type: 'circle',
  source: 'cities',
  minzoom: 7,
  filter: ['all',
    ['>=', popExpr, 100000],
    ['<', popExpr, 500000]
  ],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4],
    'circle-color': '#ffd166',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 0.8
  }
});

map.addLayer({
  id: 'city-small',
  type: 'circle',
  source: 'cities',
  minzoom: 9,
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4],
    'circle-color': '#ffd166',
    'circle-stroke-color': '#000',
    'circle-stroke-width': 0.6
  }
});


  // labels for major cities at low zooms (capitals included)
  if (!map.getLayer('city-labels-major')) {
    map.addLayer({
      id: 'city-labels-major',
      type: 'symbol',
      source: 'cities',
      minzoom: 3,
      filter: ['any', ['>=', popExpr, 5000000], ['==', ['get', 'capital'], 1], ['==', ['get', 'FEATURECLA'], 'Admin-0 capital'] ],
      layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']], 'text-size': 12, 'text-offset': [0, 1.0] },
      paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 }
    });
  }

  // existing general labels (appear at closer zooms)
  if (!map.getLayer('city-labels')) {
    map.addLayer({
      id: 'city-labels',
      type: 'symbol',
      source: 'cities',
      minzoom: 11,
      layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en']], 'text-size': 12, 'text-offset': [0, 1.0] },
      paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1 }
    });
  }

  // city hit layer (invisible larger circles to make clicking cities easier)
  if (!map.getLayer('city-hit')) {
    map.addLayer({
      id: 'city-hit',
      type: 'circle',
      source: 'cities',
      minzoom: 3,
      paint: {
        // larger radius than the visible circles so clicks are easier
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 6, 18, 8, 28, 10, 40],
        // tiny but non-zero opacity so hit-testing consistently finds this layer in all browsers
        'circle-opacity': 0.01
      },
      layout: {}
    });
  }

  // city selected source + highlight circle
  map.addSource('city-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'city-selected-circle',
    type: 'circle',
    source: 'city-selected',
    paint: {
      'circle-radius': 10,
      'circle-color': '#ff6b6b',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5
    }
  });

  // Move layers so selected glows are visible above everything else
  const order = [
    'country-selected-glow','country-hit','country-fill',
    'river-selected-glow','river-hit','river-line',
    'strait-selected-glow','strait-hit',
    'sea-selected-glow','sea-hit','sea-fill',
    'lake-selected-glow','lake-hit','lake-fill',
    'city-selected-circle','city-hit','city-capitals','city-capitals-symbol','city-major','city-1m','city-500k','city-100k','city-small','city-labels-major','city-labels'
  ];
  order.forEach(id => {
    if (map.getLayer(id)) {
      try { map.moveLayer(id); } catch (e) {}
    }
  });
}

// initial add
map.on('load', addAllLayers);
