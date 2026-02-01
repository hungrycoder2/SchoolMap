/**
 * Timeline Engine for Historical World Map
 *
 * Architecture:
 * - Manages timeline state (current year)
 * - Handles snapshot selection for empires
 * - Controls rendering transitions with fade effects
 * - Separates static (geography) from temporal (borders) layers
 * - Optimized for performance with layer reuse and debouncing
 *
 * Data Structure:
 * empires: [
 *   {
 *     id: string,
 *     name: string,
 *     snapshots: [
 *       { year: number, geometry: GeoJSON },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 */

// Timeline Engine Class
class TimelineEngine {
  constructor(map) {
    this.map = map;
    this.currentYear = 0;
    this.empires = [];
    this.slider = document.getElementById('timeline-slider');
    this.yearDisplay = document.getElementById('current-year');
    this.isTransitioning = false;
    this.debounceTimer = null;
    this.transitionDuration = 500; // ms, adjustable for performance

    this.init();
  }

  init() {
    // Initialize slider
    this.slider.addEventListener('input', (e) => {
      this.setYear(parseInt(e.target.value));
    });

    // Initial render
    this.updateYearDisplay();
    this.renderEmpires();
  }

  // Set empires data (call this with historical data)
  setEmpires(empires) {
    this.empires = empires;
    this.renderEmpires();
  }

  // Set current year with debounced update
  setYear(year) {
    this.currentYear = year;
    this.updateYearDisplay();

    // Debounce rendering for smooth scrubbing
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.renderEmpires();
    }, 16); // ~60fps
  }

  updateYearDisplay() {
    const yearStr = this.currentYear < 0 ? `${Math.abs(this.currentYear)} BC` : `${this.currentYear} AD`;
    this.yearDisplay.textContent = yearStr;
  }

  // Snapshot Selection Logic
  getSnapshotForEmpire(empire) {
    // Find the snapshot with the largest year <= currentYear
    let selected = null;
    for (const snapshot of empire.snapshots) {
      if (snapshot.year <= this.currentYear) {
        if (!selected || snapshot.year > selected.year) {
          selected = snapshot;
        }
      }
    }
    return selected; // null if no valid snapshot
  }

  // Rendering with Transitions
  renderEmpires() {
    if (this.isTransitioning) return; // Prevent overlapping transitions

    this.isTransitioning = true;

    // Collect current and new snapshots
    const toRender = [];
    const toRemove = [];

    for (const empire of this.empires) {
      const snapshot = this.getSnapshotForEmpire(empire);
      const sourceId = `empire-${empire.id}`;
      const layerId = `empire-${empire.id}-fill`;

      if (snapshot) {
        // Check if geometry changed
        const currentData = this.map.getSource(sourceId)?.serialize?.()?.data;
        const geometryChanged = !this.geometriesEqual(currentData, snapshot.geometry);

        if (geometryChanged || !this.map.getLayer(layerId)) {
          toRender.push({ empire, snapshot, sourceId, layerId });
        }
      } else {
        // No snapshot, remove if exists
        if (this.map.getLayer(layerId)) {
          toRemove.push(layerId);
        }
      }
    }

    // Fade out removed layers
    toRemove.forEach(layerId => {
      this.fadeOutAndRemoveLayer(layerId);
    });

    // Update or add new layers
    toRender.forEach(({ empire, snapshot, sourceId, layerId }) => {
      if (this.map.getLayer(layerId)) {
        // Update existing layer
        this.updateLayerGeometry(sourceId, snapshot.geometry);
      } else {
        // Add new layer
        this.addEmpireLayer(empire, snapshot, sourceId, layerId);
      }
    });

    // Reset transition flag after duration
    setTimeout(() => {
      this.isTransitioning = false;
    }, this.transitionDuration);
  }

  addEmpireLayer(empire, snapshot, sourceId, layerId) {
    // Add source
    this.map.addSource(sourceId, {
      type: 'geojson',
      data: snapshot.geometry
    });

    // Add fill layer
    this.map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': this.getEmpireColor(empire.id),
        'fill-opacity': 0 // Start invisible for fade in
      }
    });

    // Add outline layer
    this.map.addLayer({
      id: `${layerId}-stroke`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': this.getEmpireColor(empire.id),
        'line-width': 2,
        'line-opacity': 0
      }
    });

    // Fade in
    this.fadeInLayer(layerId);
    this.fadeInLayer(`${layerId}-stroke`);
  }

  updateLayerGeometry(sourceId, geometry) {
    const source = this.map.getSource(sourceId);
    if (source) {
      source.setData(geometry);
    }
  }

  fadeOutAndRemoveLayer(layerId) {
    this.fadeOutLayer(layerId, () => {
      // Remove layers and sources after fade out
      const strokeLayerId = `${layerId}-stroke`;
      if (this.map.getLayer(strokeLayerId)) {
        this.map.removeLayer(strokeLayerId);
      }
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      const sourceId = layerId.replace('-fill', '');
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });
  }

  fadeOutLayer(layerId, callback) {
    const startOpacity = this.map.getPaintProperty(layerId, 'fill-opacity') || (layerId.includes('-stroke') ? this.map.getPaintProperty(layerId, 'line-opacity') : 1);
    this.animateOpacity(layerId, startOpacity, 0, this.transitionDuration, callback);
  }

  fadeInLayer(layerId) {
    const startOpacity = this.map.getPaintProperty(layerId, 'fill-opacity') || (layerId.includes('-stroke') ? this.map.getPaintProperty(layerId, 'line-opacity') : 0);
    const targetOpacity = layerId.includes('-stroke') ? 1 : 0.6;
    this.animateOpacity(layerId, startOpacity, targetOpacity, this.transitionDuration);
  }

  animateOpacity(layerId, start, end, duration, callback) {
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = this.easeInOut(progress);
      const opacity = start + (end - start) * easeProgress;

      if (layerId.includes('-stroke')) {
        this.map.setPaintProperty(layerId, 'line-opacity', opacity);
      } else {
        this.map.setPaintProperty(layerId, 'fill-opacity', opacity);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (callback) {
        callback();
      }
    };

    requestAnimationFrame(animate);
  }

  easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  geometriesEqual(geo1, geo2) {
    if (!geo1 || !geo2) return false;
    // For GeoJSON sources, data is the Feature object
    return JSON.stringify(geo1) === JSON.stringify(geo2);
  }

  getEmpireColor(empireId) {
    // Simple color assignment based on id hash
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'];
    let hash = 0;
    for (let i = 0; i < empireId.length; i++) {
      hash = empireId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Disable transitions if needed
  setTransitionsEnabled(enabled) {
    this.transitionDuration = enabled ? 500 : 0;
  }
}

// Initialize timeline when map loads
let timelineEngine;
let mapHistoryLayer;
let historicalEventService;

map.on('load', () => {
  // Services
  historicalEventService = new HistoricalEventService();
  mapHistoryLayer = new MapHistoryLayer(map, historicalEventService);
  mapHistoryLayer.init();

  // Timeline
  timelineEngine = new TimelineEngine(map);

  // Connect Timeline with History Layer
  // We override or hook into setYear to update history
  const originalSetYear = timelineEngine.setYear.bind(timelineEngine);
  timelineEngine.setYear = function (year) {
    originalSetYear(year);

    // Update history layer
    // We need the full set of events currently loaded. 
    // We'll store them in timelineEngine for now or manage via global state.
    if (timelineEngine.loadedEvents) {
      mapHistoryLayer.updateYear(year, timelineEngine.loadedEvents);
    }
  };
});

// Export for external use
window.TimelineEngine = TimelineEngine;
window.timelineEngine = timelineEngine;
