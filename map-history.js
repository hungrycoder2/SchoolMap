/**
 * Map History Layer
 * Manages the visualization and interaction of historical events.
 */

class MapHistoryLayer {
    constructor(map, dataService) {
        this.map = map;
        this.dataService = dataService;
        this.events = [];
        this.markers = []; // Array of { marker, event }
        this.activeYear = 0;
        this.isVisible = false;
    }

    init() {
        // Initial setup if needed
        // We don't add a map source/layer in the traditional sense because we are using DOM Markers for the pulse effect
        // as per the requirement for CSS animations ("breathing" ring).
        // Although MapLibre layers are more performant for thousands of points, DOM markers are better for complex CSS animations 
        // and we likely won't have thousands of events *per year* visible at once.
        // "On This Day" usually returns ~50-100 events total, filtered by year window.
    }

    /**
     * Update the map with events for the given year window.
     * We typically want to show events that happened IN this year.
     */
    updateYear(year, allEvents) {
        this.activeYear = year;

        // Filter events: 
        // Show events exactly from this year?
        // Or accumulative? 
        // Requirement says "see significant events appear globally... see event markers for that period."
        // Timeline scroller usually implies a point in time. Let's show events for the specific year.
        // Maybe a small window? Let's stick to exact year matches for "On This Day" context.

        const relevantEvents = allEvents.filter(e => e.year === year);

        this.renderMarkers(relevantEvents);
    }

    renderMarkers(events) {
        // Clear existing
        this.clearMarkers();

        events.forEach(event => {
            this.createMarker(event);
        });
    }

    clearMarkers() {
        this.markers.forEach(m => m.marker.remove());
        this.markers = [];
    }

    createMarker(event) {
        // Create DOM element for the marker
        const el = document.createElement('div');
        el.className = 'history-marker';

        const pulse = document.createElement('div');
        pulse.className = 'history-marker-pulse';
        el.appendChild(pulse);

        const center = document.createElement('div');
        center.className = 'history-marker-center';
        el.appendChild(center);

        // Click interaction
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            this.onEventClick(event, el);
        });

        // Add to map
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat(event.coordinates)
            .addTo(this.map);

        this.markers.push({ marker, event, element: el });
    }

    onEventClick(event, element) {
        // Highlight visual
        // Reset others
        document.querySelectorAll('.history-marker').forEach(el => el.classList.remove('active'));
        element.classList.add('active');

        // Cinematic Fly-To
        // Pitch 45-60 deg, bearing rotation
        const targetParams = {
            center: event.coordinates,
            zoom: 12, // Close up
            pitch: 55,
            bearing: this.map.getBearing() + 45, // Rotate 45 deg from current
            duration: 3000,
            essential: true
        };

        this.map.flyTo(targetParams);

        // Update Sidebar
        this.showSidebar(event);
    }

    showSidebar(event) {
        // Transform event data to sidebar format
        const sidebarData = {
            title: `${Math.abs(event.year)} ${event.year < 0 ? 'BC' : 'AD'}: ${event.title}`,
            description: event.text,
            imageURL: null, // "On This Day" feed API doesn't always give images directly in the event list, need to check 'pages'
            stats: [],
            wikiTitle: event.title
        };

        // Try to find image from pages
        if (event.pages && event.pages[0] && event.pages[0].thumbnail) {
            sidebarData.imageURL = event.pages[0].thumbnail.source;
        } else if (event.pages && event.pages[0] && event.pages[0].original) {
            sidebarData.imageURL = event.pages[0].original.source;
        }

        // Add metadata cards
        if (event.year) {
            sidebarData.stats.push({ icon: '📅', label: 'Year', value: event.year });
        }

        // Call global sidebar update (assuming it exists from previous files)
        if (typeof updateSidebar === 'function') {
            updateSidebar(sidebarData);

            // Switch to "Historical Narrative" mode styling if needed
            // For now, the generic updateSidebar works well enough.
        }
    }
}

// Global export
window.MapHistoryLayer = MapHistoryLayer;
