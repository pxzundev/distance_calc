// Initialize Leaflet map with world view limits
const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    worldCopyJump: true,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0
}).setView([51.505, -0.09], 3);

// Add CartoDB Positron tiles with no-wrap option
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    noWrap: true
}).addTo(map);

// Global airports variable
let airports = [];

// Global navaids variable
let navaids = [];

// Global waypoints variable
let waypoints = [];

// Global variables for storing selected airports
let selectedDepartureAirport = null;
let selectedDestinationAirport = null;

// Function to fetch and process airport data from OurAirports.com
async function fetchAirports() {
    try {
        // Show loading state
        document.getElementById('departureAirportSearch').setAttribute('disabled', 'disabled');
        document.getElementById('departureAirportSearch').placeholder = "Loading airports...";
        document.getElementById('destinationAirportSearch').setAttribute('disabled', 'disabled');
        document.getElementById('destinationAirportSearch').placeholder = "Loading airports...";
        
        // Fetch the airports data
        const response = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
        const csvText = await response.text();
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        // Find relevant column indexes
        const icaoIndex = headers.findIndex(h => h === '"icao_code"');
        const nameIndex = headers.findIndex(h => h === '"name"');
        const latIndex = headers.findIndex(h => h === '"latitude_deg"');
        const lngIndex = headers.findIndex(h => h === '"longitude_deg"');
        const countryIndex = headers.findIndex(h => h === '"iso_country"');
        const typeIndex = headers.findIndex(h => h === '"type"');
        
        // Process all rows and filter for airports with ICAO codes
        const processedAirports = [];
        
        for (let i = 1; i < lines.length; i++) {
            // Simple CSV parsing - this is a basic approach
            const values = lines[i].split(',');
            if (values.length <= 1) continue; // Skip empty lines
            
            const icaoCode = values[icaoIndex]?.replace(/"/g, '').trim();
            
            // Only include airports with ICAO codes and that are actual airports (not heliports, etc)
            const type = values[typeIndex]?.replace(/"/g, '').trim();
            if (!icaoCode || icaoCode === "" || !type.includes('airport')) continue;
            
            const name = values[nameIndex]?.replace(/"/g, '').trim();
            const lat = parseFloat(values[latIndex]);
            const lng = parseFloat(values[lngIndex]);
            const country = values[countryIndex]?.replace(/"/g, '').trim();
            
            // Validate coordinates
            if (isNaN(lat) || isNaN(lng)) continue;
            
            processedAirports.push({
                code: icaoCode,
                name: name,
                lat: lat,
                lng: lng,
                country: country,
                city: "" // City information isn't directly available in the dataset
            });
        }
        
        // Update the global airports variable
        airports = processedAirports;
        
        // Re-enable search and update placeholder
        document.getElementById('departureAirportSearch').removeAttribute('disabled');
        document.getElementById('departureAirportSearch').placeholder = "Search departure airport...";
        document.getElementById('destinationAirportSearch').removeAttribute('disabled');
        document.getElementById('destinationAirportSearch').placeholder = "Search destination airport...";
        
        console.log(`Loaded ${airports.length} airports with ICAO codes`);
        
        // Initialize the dropdown with the first set of results (limited)
        displayAirportsInDropdown(airports.slice(0, 100), 'departureAirportDropdown', 'departureAirportSearch', false);
        displayAirportsInDropdown(airports.slice(0, 100), 'destinationAirportDropdown', 'destinationAirportSearch', true);
        
    } catch (error) {
        console.error("Error fetching airport data:", error);
        document.getElementById('departureAirportSearch').placeholder = "Error loading airports";
        document.getElementById('destinationAirportSearch').placeholder = "Error loading airports";
        
        // Fallback to the sample data
        airports = sampleAirports;
        displayAirportsInDropdown(airports, 'departureAirportDropdown', 'departureAirportSearch', false);
        displayAirportsInDropdown(airports, 'destinationAirportDropdown', 'destinationAirportSearch', true);
    }
}

// Function to fetch and process navaids data from OurAirports.com
async function fetchNavaids() {
    try {
        // Show loading state
        document.getElementById('navaidSearch').setAttribute('disabled', 'disabled');
        document.getElementById('navaidSearch').placeholder = "Loading navaids...";
        
        // Fetch the navaids data
        const response = await fetch('https://davidmegginson.github.io/ourairports-data/navaids.csv');
        const csvText = await response.text();
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        // Find relevant column indexes
        const identIndex = headers.findIndex(h => h === '"ident"');
        const nameIndex = headers.findIndex(h => h === '"name"');
        const typeIndex = headers.findIndex(h => h === '"type"');
        const latIndex = headers.findIndex(h => h === '"latitude_deg"');
        const lngIndex = headers.findIndex(h => h === '"longitude_deg"');
        const freqIndex = headers.findIndex(h => h === '"frequency_khz"');
        
        // Process all rows
        const processedNavaids = [];
        
        for (let i = 1; i < lines.length; i++) {
            // Simple CSV parsing
            const values = lines[i].split(',');
            if (values.length <= 1) continue; // Skip empty lines
            
            const ident = values[identIndex]?.replace(/"/g, '').trim();
            
            // Skip entries without ident
            if (!ident || ident === "") continue;
            
            const name = values[nameIndex]?.replace(/"/g, '').trim();
            const type = values[typeIndex]?.replace(/"/g, '').trim();
            const lat = parseFloat(values[latIndex]);
            const lng = parseFloat(values[lngIndex]);
            const freq = values[freqIndex]?.replace(/"/g, '').trim();
            
            // Validate coordinates
            if (isNaN(lat) || isNaN(lng)) continue;
            
            processedNavaids.push({
                ident: ident,
                name: name,
                type: type,
                lat: lat,
                lng: lng,
                freq: freq
            });
        }
        
        // Update the global navaids variable
        navaids = processedNavaids;
        
        // Re-enable search and update placeholder
        document.getElementById('navaidSearch').removeAttribute('disabled');
        document.getElementById('navaidSearch').placeholder = "Search navaids by ident...";
        
        console.log(`Loaded ${navaids.length} navaids`);
        
        // Initialize the dropdown with initial results
        displayNavaidsInDropdown(navaids.slice(0, 100), 'navaidDropdown', 'navaidSearch');
        
    } catch (error) {
        console.error("Error fetching navaids data:", error);
        document.getElementById('navaidSearch').placeholder = "Error loading navaids";
    }
}

// Function to fetch and process waypoints data from CSV file
async function fetchWaypoints() {
    try {
        // Show loading state
        document.getElementById('waypointSearch').setAttribute('disabled', 'disabled');
        document.getElementById('waypointSearch').placeholder = "Loading waypoints...";
        
        // Fetch the waypoints data
        const response = await fetch('points.csv');
        const csvText = await response.text();
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        // Find relevant column indexes
        const nameIndex = headers.findIndex(h => h === 'Name');
        const latIndex = headers.findIndex(h => h === 'Latitude  (WGS84)');
        const lngIndex = headers.findIndex(h => h === 'Longitude  (WGS84)');
        const typeIndex = headers.findIndex(h => h === 'Type');
        
        console.log("Processing waypoints CSV with headers:", headers);
        console.log(`Column indices - Name: ${nameIndex}, Lat: ${latIndex}, Lng: ${lngIndex}, Type: ${typeIndex}`);
        
        // Process all rows
        const processedWaypoints = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue; // Skip empty lines
            
            // Simple CSV parsing - handle commas within the CSV line
            const values = lines[i].split(',');
            
            // Skip if we don't have enough values
            if (values.length <= Math.max(nameIndex, latIndex, lngIndex, typeIndex)) {
                continue;
            }
            
            const name = values[nameIndex]?.trim();
            let lat = values[latIndex]?.trim();
            let lng = values[lngIndex]?.trim();
            const type = values[typeIndex]?.trim() || 'waypoint';
            
            // Skip entries without name
            if (!name || name === "") continue;
            
            // Parse coordinates - handle formats like "S41.3319°" and "E174.8056°"
            if (lat && lng) {
                try {
                    // Convert from degrees format to decimal
                    const latMatch = lat.match(/([NS])(\d+)\.(\d+)°/);
                    const lngMatch = lng.match(/([EW])(\d+)\.(\d+)°/);
                    
                    if (latMatch && lngMatch) {
                        const latDir = latMatch[1];
                        const latDeg = parseFloat(`${latMatch[2]}.${latMatch[3]}`);
                        
                        const lngDir = lngMatch[1];
                        const lngDeg = parseFloat(`${lngMatch[2]}.${lngMatch[3]}`);
                        
                        lat = latDir === 'S' ? -latDeg : latDeg;
                        lng = lngDir === 'W' ? -lngDeg : lngDeg;
                        
                        // Only add waypoints where we successfully parse coordinates
                        processedWaypoints.push({
                            name: name,
                            lat: lat,
                            lng: lng,
                            type: type
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to parse coordinates for ${name}: ${err.message}`);
                }
            }
        }
        
        // Update the global waypoints variable
        waypoints = processedWaypoints;
        
        console.log(`Loaded ${waypoints.length} waypoints`);
        if (waypoints.length > 0) {
            console.log("Sample waypoint:", waypoints[0]);
        }
        
        // Re-enable search and update placeholder
        document.getElementById('waypointSearch').removeAttribute('disabled');
        document.getElementById('waypointSearch').placeholder = "Search waypoints...";
        
        // Initialize the dropdown with initial results
        displayWaypointsInDropdown(waypoints.slice(0, 100), 'waypointDropdown', 'waypointSearch');
        
    } catch (error) {
        console.error("Error fetching waypoints data:", error);
        document.getElementById('waypointSearch').placeholder = "Error loading waypoints";
    }
}

// Sample airport data as fallback
const sampleAirports = [
    {
        code: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "USA",
        lat: 40.6413, lng: -73.7781
    },
    {
        code: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "USA",
        lat: 33.9416, lng: -118.4085
    },
    {
        code: "LHR", name: "London Heathrow Airport", city: "London", country: "UK",
        lat: 51.4700, lng: -0.4543
    },
    {
        code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France",
        lat: 49.0097, lng: 2.5479
    },
    {
        code: "SYD", name: "Sydney Airport", city: "Sydney", country: "Australia",
        lat: -33.9399, lng: 151.1753
    },
    {
        code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "UAE",
        lat: 25.2532, lng: 55.3657
    },
    {
        code: "HND", name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan",
        lat: 35.5494, lng: 139.7798
    },
    {
        code: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore",
        lat: 1.3644, lng: 103.9915
    },
    {
        code: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands",
        lat: 52.3105, lng: 4.7683
    },
    {
        code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany",
        lat: 50.0379, lng: 8.5622
    },
    {
        code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey",
        lat: 41.2606, lng: 28.7425
    },
    {
        code: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", country: "India",
        lat: 28.5561, lng: 77.1000
    }
];

// Function to display airports
function displayAirports(airportsToShow) {
    const airportListElement = document.getElementById('airportList');
    airportListElement.innerHTML = '';

    if (airportsToShow.length === 0) {
        airportListElement.innerHTML = '<p class="text-muted p-3">No airports found</p>';
        return;
    }

    airportsToShow.forEach(airport => {
        const airportElement = document.createElement('div');
        airportElement.className = 'airport-item';
        airportElement.innerHTML = `
            <span class="airport-code">${airport.code}</span>
            <span class="airport-name">${airport.name}</span>
            <div class="text-muted small">${airport.city}, ${airport.country}</div>
        `;

        // Add click event to fly to the airport on the map
        airportElement.addEventListener('click', () => {
            map.flyTo([airport.lat, airport.lng], 13);
        });

        airportListElement.appendChild(airportElement);
    });
}

// Function to display airports in dropdown
function displayAirportsInDropdown(airportsToShow, dropdownId, inputId, isDestination) {
    // Limit the number of airports shown to prevent performance issues
    const limitedAirports = airportsToShow.slice(0, 200);
    
    const dropdownMenu = document.getElementById(dropdownId);
    dropdownMenu.innerHTML = '';

    if (limitedAirports.length === 0) {
        const noResults = document.createElement('span');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No airports found';
        dropdownMenu.appendChild(noResults);
        return;
    }

    limitedAirports.forEach(airport => {
        const dropdownItem = document.createElement('a');
        dropdownItem.href = '#';
        dropdownItem.className = 'dropdown-item';
        dropdownItem.innerHTML = `
            <span class="airport-code">${airport.code}</span>
            <span class="airport-name">${airport.name}</span>
            <div class="text-muted small">${airport.country}</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Select this airport
            selectAirport(airport, isDestination);
            
            // Hide dropdown - the input value is now updated in selectAirport function
            const dropdownEl = bootstrap.Dropdown.getInstance(document.getElementById(inputId));
            if (dropdownEl) {
                dropdownEl.hide();
            }
        });

        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Show count if limited
    if (airportsToShow.length > limitedAirports.length) {
        const countInfo = document.createElement('div');
        countInfo.className = 'dropdown-item text-muted text-center';
        countInfo.textContent = `Showing ${limitedAirports.length} of ${airportsToShow.length} matching airports`;
        dropdownMenu.appendChild(countInfo);
    }
}

// Function to display navaids in dropdown
function displayNavaidsInDropdown(navaidsToShow, dropdownId, inputId) {
    // Limit the number of navaids shown to prevent performance issues
    const limitedNavaids = navaidsToShow.slice(0, 200);
    
    const dropdownMenu = document.getElementById(dropdownId);
    dropdownMenu.innerHTML = '';

    if (limitedNavaids.length === 0) {
        const noResults = document.createElement('span');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No navaids found';
        dropdownMenu.appendChild(noResults);
        return;
    }

    limitedNavaids.forEach(navaid => {
        const dropdownItem = document.createElement('a');
        dropdownItem.href = '#';
        dropdownItem.className = 'dropdown-item';
        dropdownItem.innerHTML = `
            <span class="airport-code">${navaid.ident}</span>
            <span class="airport-name">${navaid.name}</span>
            <div class="text-muted small">${navaid.type} - Freq: ${navaid.freq || 'N/A'}</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Add navaid marker to map
            addNavaidMarker(navaid);
            
            // Update search input with selected navaid
            document.getElementById(inputId).value = `${navaid.ident} - ${navaid.name}`;
            
            // Hide dropdown
            const dropdownEl = bootstrap.Dropdown.getInstance(document.getElementById(inputId));
            if (dropdownEl) {
                dropdownEl.hide();
            }
        });

        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Show count if limited
    if (navaidsToShow.length > limitedNavaids.length) {
        const countInfo = document.createElement('div');
        countInfo.className = 'dropdown-item text-muted text-center';
        countInfo.textContent = `Showing ${limitedNavaids.length} of ${navaidsToShow.length} matching navaids`;
        dropdownMenu.appendChild(countInfo);
    }
}

// Function to display waypoints in dropdown
function displayWaypointsInDropdown(waypointsToShow, dropdownId, inputId) {
    // Limit the number of waypoints shown to prevent performance issues
    const limitedWaypoints = waypointsToShow.slice(0, 200);
    
    const dropdownMenu = document.getElementById(dropdownId);
    dropdownMenu.innerHTML = '';

    if (limitedWaypoints.length === 0) {
        const noResults = document.createElement('span');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No waypoints found';
        dropdownMenu.appendChild(noResults);
        return;
    }

    limitedWaypoints.forEach(waypoint => {
        const dropdownItem = document.createElement('a');
        dropdownItem.href = '#';
        dropdownItem.className = 'dropdown-item';
        dropdownItem.innerHTML = `
            <span class="airport-code">${waypoint.name}</span>
            <div class="text-muted small">${waypoint.type} (${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)})</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Add waypoint marker to map
            addWaypointMarker(waypoint);
            
            // Update search input with selected waypoint
            document.getElementById(inputId).value = `${waypoint.name} - ${waypoint.type}`;
            
            // Hide dropdown
            const dropdownEl = bootstrap.Dropdown.getInstance(document.getElementById(inputId));
            if (dropdownEl) {
                dropdownEl.hide();
            }
        });

        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Show count if limited
    if (waypointsToShow.length > limitedWaypoints.length) {
        const countInfo = document.createElement('div');
        countInfo.className = 'dropdown-item text-muted text-center';
        countInfo.textContent = `Showing ${limitedWaypoints.length} of ${waypointsToShow.length} matching waypoints`;
        dropdownMenu.appendChild(countInfo);
    }
}

// Function to display selected airport details
function selectAirport(airport, isDestination) {
    // Store selected airport
    if (isDestination) {
        selectedDestinationAirport = airport;
        // Update destination search input with selected airport
        document.getElementById('destinationAirportSearch').value = `${airport.code} - ${airport.name}`;
    } else {
        selectedDepartureAirport = airport;
        // Update departure search input with selected airport
        document.getElementById('departureAirportSearch').value = `${airport.code} - ${airport.name}`;
    }
    
    // Add marker to map
    addAirportMarker(airport, isDestination);
    
    // If both airports are selected, draw a route line between them and update flight details
    if (selectedDepartureAirport && selectedDestinationAirport) {
        drawRouteLine();
        updateFlightDetails();
        // Show flight details card
        document.getElementById('flightDetailsCard').classList.remove('d-none');
    } else {
        // Only one airport selected, hide both cards
        document.getElementById('flightDetailsCard').classList.add('d-none');
    }
}

// Function to add airport marker
function addAirportMarker(airport, isDestination) {
    // Use different marker styling for departure vs destination
    const markerColor = isDestination ? '#0d6efd' : '#198754'; // Blue for destination, Green for departure
    const iconClass = isDestination ? 'bi-airplane-engines' : 'bi-airplane-fill';
    
    const markerIcon = L.divIcon({
        className: `airport-marker ${isDestination ? 'destination' : 'departure'}`,
        html: `<div class="marker-container" style="background-color: ${markerColor}">
                <i class="bi ${iconClass}"></i>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
    
    // Remove existing marker if present
    const markerKey = isDestination ? 'destinationMarker' : 'departureMarker';
    if (window[markerKey]) {
        map.removeLayer(window[markerKey]);
    }
    
    // Add new marker
    window[markerKey] = L.marker([airport.lat, airport.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
            <b>${airport.code}</b><br>
            ${airport.name}<br>
            <small>${airport.country}</small>
        `)
        .openPopup();
    
    // Adjust map view if both markers are present
    if (selectedDepartureAirport && selectedDestinationAirport) {
        // Use the route points to determine bounds
        const routePoints = calculateGreatCircle(
            selectedDepartureAirport.lat, 
            selectedDepartureAirport.lng, 
            selectedDestinationAirport.lat, 
            selectedDestinationAirport.lng
        );
        
        const bounds = L.latLngBounds(routePoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Or just fly to this airport
        map.flyTo([airport.lat, airport.lng], 10);
    }
}

// Function to add navaid marker to map
function addNavaidMarker(navaid) {
    // Create a unique marker key for this navaid
    const markerKey = `navaid_${navaid.ident}`;
    
    // Remove existing marker if present
    if (window[markerKey]) {
        map.removeLayer(window[markerKey]);
    }
    
    // Create marker icon
    const markerIcon = L.divIcon({
        className: 'navaid-marker',
        html: `<div class="marker-container">
                <i class="bi bi-broadcast-pin"></i>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
    
    // Add marker to map
    window[markerKey] = L.marker([navaid.lat, navaid.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
            <b>${navaid.ident}</b><br>
            ${navaid.name}<br>
            <small>${navaid.type} - Freq: ${navaid.freq || 'N/A'}</small>
        `)
        .openPopup();
    
    // Fly to the navaid
    map.flyTo([navaid.lat, navaid.lng], 10);
}

// Function to add waypoint marker to map
function addWaypointMarker(waypoint) {
    // Create a unique marker key for this waypoint
    const markerKey = `waypoint_${waypoint.name}`;
    
    // Remove existing marker if present
    if (window[markerKey]) {
        map.removeLayer(window[markerKey]);
    }
    
    // Create marker icon
    const markerIcon = L.divIcon({
        className: 'waypoint-marker',
        html: `<div class="marker-container">
                <i class="bi bi-diamond-fill"></i>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
    
    // Add marker to map
    window[markerKey] = L.marker([waypoint.lat, waypoint.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
            <b>${waypoint.name}</b><br>
            <small>${waypoint.type}<br>
            ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}</small>
        `)
        .openPopup();
    
    // Fly to the waypoint
    map.flyTo([waypoint.lat, waypoint.lng], 10);
}

// Function to draw a route line between departure and destination
function drawRouteLine() {
    // Remove existing lines if present
    if (window.routeLine) {
        map.removeLayer(window.routeLine);
    }
    
    // Create points for departure and destination
    const departurePoint = [selectedDepartureAirport.lat, selectedDepartureAirport.lng];
    const destinationPoint = [selectedDestinationAirport.lat, selectedDestinationAirport.lng];
    
    // Check if the route crosses the date line
    const isDateLineCrossing = Math.abs(selectedDepartureAirport.lng - selectedDestinationAirport.lng) > 180;
    
    // Generate great circle route points
    const routePoints = calculateGreatCircle(
        selectedDepartureAirport.lat, 
        selectedDepartureAirport.lng, 
        selectedDestinationAirport.lat, 
        selectedDestinationAirport.lng
    );
    
    // Create the great circle line
    window.routeLine = L.polyline(routePoints, {
        color: '#0d6efd',
        weight: 3,
        opacity: 0.8,
        className: 'flight-path'
    }).addTo(map);
    
    // Calculate distance
    const distance = calculateDistance(
        selectedDepartureAirport.lat, 
        selectedDepartureAirport.lng, 
        selectedDestinationAirport.lat, 
        selectedDestinationAirport.lng
    );
    
    // Convert to nautical miles
    const nauticalMiles = distance / 1.852;
    const roundedNM = Math.round(nauticalMiles);
    const roundedKM = Math.round(distance);
    
    // Add a popup to the line with distance information
    window.routeLine.bindPopup(`
        <b>Flight Distance:</b> ${roundedNM} nm (${roundedKM} km)<br>
        <small>From ${selectedDepartureAirport.code} to ${selectedDestinationAirport.code}</small>
    `);
    
    // Add flight direction arrow
    addFlightDirectionArrow(routePoints);
    
    // Fit map to bounds of the route, accounting for the potential date line crossing
    if (isDateLineCrossing) {
        // If crossing date line, zoom out to world view
        map.setView([20, 0], 2);
    } else {
        const bounds = L.latLngBounds(routePoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Function to calculate great circle route points - updated to match gcmap.com
function calculateGreatCircle(startLat, startLng, endLat, endLng) {
    // Number of points to generate along the path
    const numPoints = 100;
    const points = [];
    
    // Handle date line crossing by checking if points are far apart in longitude
    const isDateLineCrossing = Math.abs(startLng - endLng) > 180;
    
    // If the route crosses the date line, we need to adjust one of the longitudes
    let adjustedStartLng = startLng;
    let adjustedEndLng = endLng;
    
    if (isDateLineCrossing) {
        // Adjust longitudes to prevent the route from crossing the date line
        if (startLng > 0) {
            adjustedStartLng = startLng - 360; // Shift west
        } else {
            adjustedEndLng = endLng - 360; // Shift west
        }
    }
    
    // Convert to radians
    const φ1 = deg2rad(startLat);
    const λ1 = deg2rad(adjustedStartLng);
    const φ2 = deg2rad(endLat);
    const λ2 = deg2rad(adjustedEndLng);
    
    // Calculate the central angle between the two points
    const centralAngle = Math.acos(
        Math.sin(φ1) * Math.sin(φ2) + 
        Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ1 - λ2)
    );
    
    // Generate points along the great circle path
    for (let i = 0; i <= numPoints; i++) {
        const f = i / numPoints; // Fraction of distance along the path
        
        // Intermediate point at fraction f along the great circle path
        const A = Math.sin((1 - f) * centralAngle) / Math.sin(centralAngle);
        const B = Math.sin(f * centralAngle) / Math.sin(centralAngle);
        
        const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
        const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
        const z = A * Math.sin(φ1) + B * Math.sin(φ2);
        
        const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
        const λ = Math.atan2(y, x);
        
        // Convert back to degrees
        let lat = rad2deg(φ);
        let lng = rad2deg(λ);
        
        // Normalize longitude if needed
        if (isDateLineCrossing) {
            while (lng < -180) lng += 360;
            while (lng > 180) lng -= 360;
        }
        
        points.push([lat, lng]);
    }
    
    return points;
}

// Function to add flight direction arrow
function addFlightDirectionArrow(routePoints) {
    // Remove existing arrow if present
    if (window.directionArrow) {
        map.removeLayer(window.directionArrow);
    }
    
    // Get the middle point of the route (approximately)
    const midIndex = Math.floor(routePoints.length / 2);
    const point = routePoints[midIndex];
    
    // Calculate the bearing to determine arrow direction
    const prevPoint = routePoints[midIndex - 1];
    const nextPoint = routePoints[midIndex + 1];
    const bearing = calculateBearing(prevPoint[0], prevPoint[1], nextPoint[0], nextPoint[1]);
    
    // Create a custom icon with rotation for direction
    const arrowIcon = L.divIcon({
        className: 'flight-direction-arrow',
        html: `<i class="bi bi-arrow-right-circle-fill" style="transform: rotate(${bearing}deg)"></i>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Add the arrow marker
    window.directionArrow = L.marker(point, { icon: arrowIcon }).addTo(map);
}

// Function to calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    lat1 = deg2rad(lat1);
    lon1 = deg2rad(lon1);
    lat2 = deg2rad(lat2);
    lon2 = deg2rad(lon2);
    
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    
    let bearing = Math.atan2(y, x);
    bearing = rad2deg(bearing);
    return (bearing + 360) % 360;
}

// Function to convert radians to degrees
function rad2deg(rad) {
    return rad * (180 / Math.PI);
}

// Function to calculate distance between two points in km matching gcmap.com formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    // GCMap.com uses the FAI sphere (6371.0 km radius)
    const R = 6371.0; // Earth radius in kilometers (GCMap's standard)
    
    // Convert degrees to radians
    const φ1 = deg2rad(lat1);
    const φ2 = deg2rad(lat2);
    const λ1 = deg2rad(lon1);
    const λ2 = deg2rad(lon2);
    
    // GCMap uses Vincenty formula for the angular distance
    // Simplified here to match GCMap's results
    const dλ = Math.abs(λ2 - λ1);
    
    // Haversine formula (what GCMap actually uses)
    const a = Math.sin((φ2 - φ1) / 2) * Math.sin((φ2 - φ1) / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Initialize airport dropdowns
document.addEventListener('DOMContentLoaded', () => {
    // Load airports data when page loads
    fetchAirports();
    
    // Load navaids data when page loads
    fetchNavaids();
    
    // Load waypoints data when page loads
    fetchWaypoints();
    
    // Set up departure search
    setupAirportSearch(
        'departureAirportSearch', 
        'departureAirportDropdown', 
        false
    );
    
    // Set up destination search
    setupAirportSearch(
        'destinationAirportSearch', 
        'destinationAirportDropdown', 
        true
    );
    
    // Set up navaid search
    setupNavaidSearch();
    
    // Set up waypoint search
    setupWaypointSearch();
    
    // Set up copy to clipboard button
    const copyBtn = document.getElementById('copyDistanceBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyDistanceToClipboard);
    }
    
    // Make the map resize properly when the window is resized
    window.addEventListener('resize', function () {
        map.invalidateSize();
    });

    // Set up route airport search
    setupRouteAirportSearch();
});

// Function to set up airport search functionality
function setupAirportSearch(inputId, dropdownId, isDestination) {
    const searchInput = document.getElementById(inputId);
    
    // Initialize dropdown with full list when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            displayAirportsInDropdown(airports.slice(0, 100), dropdownId, inputId, isDestination);
        }
        
        // Show the dropdown when focused
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Filter airports as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            // Only show first 100 airports when empty to avoid performance issues
            displayAirportsInDropdown(airports.slice(0, 100), dropdownId, inputId, isDestination);
            return;
        }
        
        // Filter airports
        const filteredAirports = airports.filter(airport => 
            airport.code.toLowerCase().includes(searchTerm) || 
            airport.name.toLowerCase().includes(searchTerm) || 
            (airport.city && airport.city.toLowerCase().includes(searchTerm)) || 
            airport.country.toLowerCase().includes(searchTerm)
        );
        
        // Update dropdown with filtered results
        displayAirportsInDropdown(filteredAirports, dropdownId, inputId, isDestination);
        
        // Ensure dropdown is showing
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
}

// Function to set up navaid search functionality
function setupNavaidSearch() {
    const searchInput = document.getElementById('navaidSearch');
    
    // Initialize dropdown with limited list when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            displayNavaidsInDropdown(navaids.slice(0, 100), 'navaidDropdown', 'navaidSearch');
        }
        
        // Show the dropdown when focused
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Filter navaids as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            // Only show first 100 navaids when empty to avoid performance issues
            displayNavaidsInDropdown(navaids.slice(0, 100), 'navaidDropdown', 'navaidSearch');
            return;
        }
        
        // Filter navaids - prioritize ident matches
        const filteredNavaids = navaids.filter(navaid => 
            navaid.ident.toLowerCase().includes(searchTerm) || 
            navaid.name.toLowerCase().includes(searchTerm) || 
            navaid.type.toLowerCase().includes(searchTerm)
        );
        
        // Update dropdown with filtered results
        displayNavaidsInDropdown(filteredNavaids, 'navaidDropdown', 'navaidSearch');
        
        // Ensure dropdown is showing
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
}

// Function to set up waypoint search functionality
function setupWaypointSearch() {
    const searchInput = document.getElementById('waypointSearch');
    
    // Initialize dropdown with limited list when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            displayWaypointsInDropdown(waypoints.slice(0, 100), 'waypointDropdown', 'waypointSearch');
        }
        
        // Show the dropdown when focused
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Filter waypoints as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            // Only show first 100 waypoints when empty to avoid performance issues
            displayWaypointsInDropdown(waypoints.slice(0, 100), 'waypointDropdown', 'waypointSearch');
            return;
        }
        
        // Filter waypoints - prioritize name matches
        const filteredWaypoints = waypoints.filter(waypoint => 
            waypoint.name.toLowerCase().includes(searchTerm) || 
            (waypoint.type && waypoint.type.toLowerCase().includes(searchTerm))
        );
        
        // Update dropdown with filtered results
        displayWaypointsInDropdown(filteredWaypoints, 'waypointDropdown', 'waypointSearch');
        
        // Ensure dropdown is showing
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
}

// Function to calculate and display flight details
function updateFlightDetails() {
    if (!selectedDepartureAirport || !selectedDestinationAirport) {
        return; // Both airports must be selected
    }
    
    // Calculate distance using the corrected GCMap-compatible formula
    const distance = calculateDistance(
        selectedDepartureAirport.lat, 
        selectedDepartureAirport.lng, 
        selectedDestinationAirport.lat, 
        selectedDestinationAirport.lng
    );
    
    // GCMap.com uses exactly 1 nm = 1.852 km (international standard)
    const nauticalMiles = distance / 1.852;
    
    // For exactness, we round to the nearest mile like gcmap.com does
    const roundedNM = Math.round(nauticalMiles);
    const roundedKM = Math.round(distance);
    
    // Store the numerical value for clipboard copying
    window.distanceValueNM = roundedNM;
    
    // Update distance display with only the numerical part bold
    const flightDistanceElement = document.getElementById('flightDistance');
    if (flightDistanceElement) {
        flightDistanceElement.innerHTML = `${selectedDepartureAirport.code} → ${selectedDestinationAirport.code}: <span class="fw-bold">${roundedNM} nm</span> (${roundedKM} km)`;
    }
    
    // Show flight details card
    document.getElementById('flightDetailsCard').classList.remove('d-none');
}

// Function to copy distance to clipboard
function copyDistanceToClipboard() {
    // Only copy the numerical value of the distance in nautical miles
    const distanceValue = window.distanceValueNM || '';
    
    // Use the Clipboard API to copy the text
    navigator.clipboard.writeText(distanceValue.toString())
        .then(() => {
            // Show success feedback
            const copyBtn = document.getElementById('copyDistanceBtn');
            const originalInnerHTML = copyBtn.innerHTML;
            
            // Change button to show success
            copyBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
            copyBtn.classList.add('btn-success');
            copyBtn.classList.remove('btn-outline-secondary');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                copyBtn.innerHTML = originalInnerHTML;
                copyBtn.classList.remove('btn-success');
                copyBtn.classList.add('btn-outline-secondary');
            }, 2000);
        })
        .catch(err => {
            console.error('Error copying text: ', err);
            // Show error feedback
            alert('Failed to copy to clipboard. Please try again.');
        });
}

// Optional: Add a function to calculate the midpoint of the great circle path
// This is useful for placing additional information on the map
function calculateMidpoint(lat1, lng1, lat2, lng2) {
    // Convert to radians
    const phi1 = deg2rad(lat1);
    const lambda1 = deg2rad(lng1);
    const phi2 = deg2rad(lat2);
    const lambda2 = deg2rad(lng2);
    
    const Bx = Math.cos(phi2) * Math.cos(lambda2 - lambda1);
    const By = Math.cos(phi2) * Math.sin(lambda2 - lambda1);
    
    const phi3 = Math.atan2(
        Math.sin(phi1) + Math.sin(phi2),
        Math.sqrt((Math.cos(phi1) + Bx) * (Math.cos(phi1) + Bx) + By * By)
    );
    const lambda3 = lambda1 + Math.atan2(By, Math.cos(phi1) + Bx);
    
    // Convert back to degrees
    return [rad2deg(phi3), rad2deg(lambda3)];
}

// Function to add route airport marker
function addRouteAirportMarker(airport) {
    // Create a unique marker key for this route airport
    const markerKey = `route_airport_${airport.code}`;
    
    // Remove existing marker if present
    if (window[markerKey]) {
        map.removeLayer(window[markerKey]);
    }
    
    // Create marker icon (gray to distinguish from departure/destination)
    const markerIcon = L.divIcon({
        className: 'airport-marker',
        html: `<div class="marker-container" style="background-color: #6c757d">
                <i class="bi bi-geo-alt-fill"></i>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
    
    // Add marker to map
    window[markerKey] = L.marker([airport.lat, airport.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
            <b>${airport.code}</b><br>
            ${airport.name}<br>
            <small>${airport.country}</small>
        `)
        .openPopup();
    
    // Fly to the airport
    map.flyTo([airport.lat, airport.lng], 10);
}

// Function to set up route airport search functionality
function setupRouteAirportSearch() {
    const searchInput = document.getElementById('routeAirportSearch');
    
    // Initialize dropdown with full list when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            displayRouteAirportsInDropdown(airports.slice(0, 100));
        }
        
        // Show the dropdown when focused
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Filter airports as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            // Only show first 100 airports when empty to avoid performance issues
            displayRouteAirportsInDropdown(airports.slice(0, 100));
            return;
        }
        
        // Filter airports
        const filteredAirports = airports.filter(airport => 
            airport.code.toLowerCase().includes(searchTerm) || 
            airport.name.toLowerCase().includes(searchTerm) || 
            (airport.city && airport.city.toLowerCase().includes(searchTerm)) || 
            airport.country.toLowerCase().includes(searchTerm)
        );
        
        // Update dropdown with filtered results
        displayRouteAirportsInDropdown(filteredAirports);
        
        // Ensure dropdown is showing
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        const dropdownToggle = new bootstrap.Dropdown(searchInput);
        dropdownToggle.show();
    });
}

// Function to display route airports in dropdown
function displayRouteAirportsInDropdown(airportsToShow) {
    // Limit the number of airports shown to prevent performance issues
    const limitedAirports = airportsToShow.slice(0, 200);
    
    const dropdownMenu = document.getElementById('routeAirportDropdown');
    dropdownMenu.innerHTML = '';

    if (limitedAirports.length === 0) {
        const noResults = document.createElement('span');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No airports found';
        dropdownMenu.appendChild(noResults);
        return;
    }

    limitedAirports.forEach(airport => {
        const dropdownItem = document.createElement('a');
        dropdownItem.href = '#';
        dropdownItem.className = 'dropdown-item';
        dropdownItem.innerHTML = `
            <span class="airport-code">${airport.code}</span>
            <span class="airport-name">${airport.name}</span>
            <div class="text-muted small">${airport.country}</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Add airport marker to map
            addRouteAirportMarker(airport);
            
            // Update search input with selected airport
            document.getElementById('routeAirportSearch').value = `${airport.code} - ${airport.name}`;
            
            // Hide dropdown
            const dropdownEl = bootstrap.Dropdown.getInstance(document.getElementById('routeAirportSearch'));
            if (dropdownEl) {
                dropdownEl.hide();
            }
        });

        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Show count if limited
    if (airportsToShow.length > limitedAirports.length) {
        const countInfo = document.createElement('div');
        countInfo.className = 'dropdown-item text-muted text-center';
        countInfo.textContent = `Showing ${limitedAirports.length} of ${airportsToShow.length} matching airports`;
        dropdownMenu.appendChild(countInfo);
    }
}
