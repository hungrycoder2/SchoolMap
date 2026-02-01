/**
 * Historical Event Service
 * Fetches "On This Day" data from Wikipedia and resolves locations.
 */

class HistoricalEventService {
    constructor() {
        this.cache = new Map(); // Cache by "month-day"
    }

    /**
     * Fetch events for a specific date (e.g., month=1, day=26 for Jan 26)
     */
    async fetchEvents(month, day) {
        const cacheKey = `${month}-${day}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();

            if (!data.events) return [];

            // Process events in parallel but limit concurrency if needed (browsers handle fetch queue)
            console.log(`Processing ${data.events.length} raw events...`);
            const processedEvents = await Promise.all(
                data.events.map(event => this.processEvent(event))
            );

            // Filter out events that couldn't be geocoded or have invalid data
            const validEvents = processedEvents.filter(e => e && e.coordinates);
            console.log(`Geocoding complete. Valid events: ${validEvents.length}/${data.events.length}`);

            if (validEvents.length === 0) {
                console.warn('No valid events found. Check if geocoding is working.');
            }

            // Apply jitter to decluster exact duplicates
            const finalEvents = this.applyJitter(validEvents);

            this.cache.set(cacheKey, finalEvents);
            return finalEvents;

        } catch (e) {
            console.error("Error fetching historical events:", e);
            return [];
        }
    }

    /**
     * Process a single event: Clean text, Parse Year, Resolve Coordinates
     */
    async processEvent(event) {
        try {
            const year = this.parseYear(event.year);
            if (year === null) return null;

            const description = this.cleanText(event.text);

            // Get the primary related page (usually the first one is the main topic)
            const primaryPage = event.pages && event.pages[0];
            if (!primaryPage) {
                // console.debug('No primary page for event:', event.text); 
                return null;
            }

            let coordinates = await this.resolveCoordinates(primaryPage.title);

            // Fallback: If no coords for primary title, try to parse text for location keywords?
            // For now, if Wikipedia doesn't have coords for the main article, it might be hard to map.
            // We could try subsequent pages if the first fails.
            if (!coordinates && event.pages.length > 1) {
                for (let i = 1; i < Math.min(event.pages.length, 3); i++) {
                    coordinates = await this.resolveCoordinates(event.pages[i].title);
                    if (coordinates) break;
                }
            }

            if (!coordinates) {
                // console.debug(`Could not resolve coordinates for "${primaryPage.title}"`);
                return null;
            }

            return {
                text: description,
                year: year,
                originalYear: event.year,
                pages: event.pages,
                coordinates: coordinates, // [lng, lat]
                title: primaryPage.title
            };

        } catch (e) {
            console.warn("Event processing error:", e);
            return null;
        }
    }

    parseYear(yearStr) {
        // Wikipedia API usually returns a number for year, but sometimes text depending on endpoint version
        // The feed endpoint returns 'year' as number. Negative for BC?
        // Let's assume input is number or string.
        let y = parseInt(yearStr);
        if (isNaN(y)) return null;

        // The API returns absolute numbers usually for 'year', but let's check text if it says 'BC'
        // Actually the 'year' field in this API is typically just the number. 
        // BC dates are often represented as strings like "44 BC". 
        // But the 'events' object has a 'year' property which is integer (negative for BC in some contexts, but usually positive with a descriptor).
        // Let's trust the 'year' property. If it's a string "44 BC", we handle it.
        if (typeof yearStr === 'string' && yearStr.includes('BC')) {
            y = -1 * parseInt(yearStr);
        }

        return y;
    }

    cleanText(text) {
        // Basic cleanup
        return text.replace(/\[.*?\]/g, '').trim();
    }

    /**
     * Fetch coordinates for a Wikipedia title
     */
    async resolveCoordinates(title) {
        if (!title) return null;

        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(title)}&format=json&origin=*`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            const pages = data.query?.pages;
            if (!pages) return null;

            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.coordinates && page.coordinates.length > 0) {
                const c = page.coordinates[0];
                // Validate
                if (c.lat === 0 && c.lon === 0) return null; // Filter zero-island
                return [c.lon, c.lat];
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    applyJitter(events) {
        // Simple grouping to find duplicates
        const locMap = new Map();

        events.forEach(e => {
            const key = `${e.coordinates[0].toFixed(4)},${e.coordinates[1].toFixed(4)}`;
            if (!locMap.has(key)) locMap.set(key, []);
            locMap.get(key).push(e);
        });

        const jitteredEvents = [];
        locMap.forEach((group) => {
            if (group.length === 1) {
                jitteredEvents.push(group[0]);
            } else {
                // Jitter
                group.forEach((ev, i) => {
                    const angle = (i / group.length) * Math.PI * 2;
                    const radius = 0.05; // degree ~ 5km approx
                    ev.coordinates[0] += Math.cos(angle) * radius;
                    ev.coordinates[1] += Math.sin(angle) * radius;
                    jitteredEvents.push(ev);
                });
            }
        });
        return jitteredEvents;
    }
}

// Export global
window.HistoricalEventService = HistoricalEventService;
