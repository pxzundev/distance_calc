// Initialize Leaflet map centered on Wellington Airport
const map = L.map('map', {
    center: [-41.3272, 174.8053],
    zoom: 10,
    worldCopyJump: true
});

// Add CartoDB Positron tiles with infinite bounds
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    noWrap: false
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

// Global array to store route points
let routePoints = [];

// Global variable to track route lines and markers
let routeLineGroup = null;

// Function to add a point to the route table
function addPointToRouteTable(point, inputId = null) {
    // Add point to global array
    routePoints.push(point);
    
    // Update the route table
    updateRouteTable();
    
    // Hide the empty row message if present
    const emptyRow = document.getElementById('emptyRouteTableRow');
    if (emptyRow) {
        emptyRow.style.display = 'none';
    }
    
    // Clear the input field if provided
    if (inputId) {
        document.getElementById(inputId).value = '';
        updateClearButtonVisibility(inputId);
    }
    
    // Update the route visualization on the map
    updateRouteVisualization();
}

// Function to update the entire route table
function updateRouteTable() {
    const tableBody = document.getElementById('routeTableBody');
    
    // Clear current table rows (except the empty message row)
    const rows = tableBody.querySelectorAll('tr:not(#emptyRouteTableRow)');
    rows.forEach(row => row.remove());
    
    // If there are no points, show empty message and return
    if (routePoints.length === 0) {
        const emptyRow = document.getElementById('emptyRouteTableRow');
        if (emptyRow) {
            emptyRow.style.display = '';
        }
        return;
    }
    
    let accumulatedDistance = 0;
    
    // Add row for each point in the route
    routePoints.forEach((point, index) => {
        // Calculate distance from previous point
        let distanceFromPrevious = 0;
        if (index > 0) {
            // Get previous point
            const prevPoint = routePoints[index - 1];
            
            // Calculate distance
            distanceFromPrevious = calculateDistance(
                prevPoint.lat, prevPoint.lng,
                point.lat, point.lng
            );
            
            // Add to accumulated distance
            accumulatedDistance += distanceFromPrevious;
        }
        
        // Convert to nautical miles and round
        const distanceNM = Math.round(distanceFromPrevious / 1.852);
        const accumulatedNM = Math.round(accumulatedDistance / 1.852);
        
        // Create table row
        const row = document.createElement('tr');
        
        // Add cells
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${point.name}</td>
            <td>${index === 0 ? '-' : distanceNM + ' nm'}</td>
            <td>${index === 0 ? '-' : accumulatedNM + ' nm'}</td>
        `;
        
        // Add to table
        tableBody.appendChild(row);
    });
}

// Function to clear the route list
function clearRouteList() {
    // Clear the global array
    routePoints = [];
    
    // Update the table
    updateRouteTable();
    
    // Show empty message
    const emptyRow = document.getElementById('emptyRouteTableRow');
    if (emptyRow) {
        emptyRow.style.display = '';
    }
    
    // Clear route visualization
    clearRouteVisualization();
    
    // Remove route markers from map
    const markersToRemove = [];
    
    // Find all markers related to route search
    Object.keys(window).forEach(key => {
        if (key.startsWith('route_airport_') || 
            key.startsWith('navaid_') || 
            key.startsWith('waypoint_')) {
            markersToRemove.push(key);
        }
    });
    
    // Remove the identified markers
    markersToRemove.forEach(key => {
        if (window[key]) {
            map.removeLayer(window[key]);
            window[key] = null;
        }
    });
}

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


// Function to display selected airport details
function selectAirport(airport, isDestination) {
    // Check if the selected airport is already selected as the other endpoint
    if ((isDestination && selectedDepartureAirport && selectedDepartureAirport.code === airport.code) ||
        (!isDestination && selectedDestinationAirport && selectedDestinationAirport.code === airport.code)) {
        // Show warning message
        showSameAirportWarning(isDestination);
        return; // Don't proceed with selection
    }
    
    // Clear any existing warning
    clearAirportWarning(isDestination);
    
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
    } else {
        // Only one airport selected, show placeholder
        updateFlightDetailsCard(false);
    }
}

// Function to show warning when same airport is selected for both departure and destination
function showSameAirportWarning(isDestination) {
    const inputId = isDestination ? 'destinationAirportSearch' : 'departureAirportSearch';
    const inputElement = document.getElementById(inputId);
    
    // Create warning element if it doesn't exist
    const warningId = `${inputId}Warning`;
    let warningElement = document.getElementById(warningId);
    
    if (!warningElement) {
        warningElement = document.createElement('div');
        warningElement.id = warningId;
        warningElement.className = 'text-danger small mt-1';
        warningElement.innerHTML = 'Cannot select the same airport for departure and destination.';
        
        // Insert after the input field's parent div (which is the dropdown)
        const parentDropdown = inputElement.closest('.dropdown');
        parentDropdown.insertAdjacentElement('afterend', warningElement);
    }
    
    // Make the input field flash red briefly to indicate error
    inputElement.classList.add('is-invalid');
    setTimeout(() => {
        inputElement.classList.remove('is-invalid');
    }, 1500);
}

// Function to clear warning message
function clearAirportWarning(isDestination) {
    const inputId = isDestination ? 'destinationAirportSearch' : 'departureAirportSearch';
    const warningId = `${inputId}Warning`;
    const warningElement = document.getElementById(warningId);
    
    if (warningElement) {
        warningElement.remove();
    }
}

// Function to fit map bounds to all markers
function fitMapToAllMarkers() {
    // Collect all markers on the map
    const markerPoints = [];
    
    // Check for departure and destination markers
    if (window.departureMarker) {
        markerPoints.push(window.departureMarker.getLatLng());
    }
    
    if (window.destinationMarker) {
        markerPoints.push(window.destinationMarker.getLatLng());
    }
    
    // Check for route airports, navaids, and waypoints
    Object.keys(window).forEach(key => {
        if ((key.startsWith('route_airport_') || 
             key.startsWith('navaid_') || 
             key.startsWith('waypoint_')) && 
            window[key]) {
            markerPoints.push(window[key].getLatLng());
        }
    });
    
    // If we have markers, fit the map to them
    if (markerPoints.length > 0) {
        const bounds = L.latLngBounds(markerPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Function to add airport marker
function addAirportMarker(airport, isDestination) {
    // Use different marker styling for departure vs destination
    const markerColor = isDestination ? '#dc3545' : '#198754'; // Red for destination, Green for departure
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
    
    // Fit map to all markers instead of just focusing on this one
    fitMapToAllMarkers();
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
    
    // Fit map to all markers instead of just flying to this one
    fitMapToAllMarkers();
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
    
    // Fit map to all markers instead of just flying to this one
    fitMapToAllMarkers();
}

// Function to draw a route line between departure and destination
function drawRouteLine() {
    // Remove existing lines and decorators if present
    if (window.routeLine) {
        map.removeLayer(window.routeLine);
    }
    if (window.routeArrows) {
        map.removeLayer(window.routeArrows);
    }
    
    // Create points for departure and destination
    const departurePoint = [selectedDepartureAirport.lat, selectedDepartureAirport.lng];
    const destinationPoint = [selectedDestinationAirport.lat, selectedDestinationAirport.lng];
    
    // Use direct straight line (just two points) instead of great circle
    const routePoints = [departurePoint, destinationPoint];
    
    // Create the line
    window.routeLine = L.polyline(routePoints, {
        color: '#495057',
        weight: 1,
        opacity: 0.8,
        className: 'flight-path'
    }).addTo(map);
    
    // Add arrow decorations to show flight direction
    window.routeArrows = L.polylineDecorator(routePoints, {
        patterns: [
            {
                offset: '25%', 
                repeat: '50%', 
                symbol: L.Symbol.arrowHead({
                    pixelSize: 8,
                    pathOptions: {
                        fillOpacity: 1,
                        weight: 0,
                        color: '#495057'
                    }
                })
            }
        ]
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
    
    // Fit map bounds to show the entire route
    const bounds = L.latLngBounds(routePoints);
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Function to calculate great circle route points - updated to match gcmap.com
function calculateGreatCircle(startLat, startLng, endLat, endLng) {
    // Add validation to prevent issues with same points
    if (startLat === endLat && startLng === endLng) {
        console.warn("Start and end points are the same - cannot calculate great circle");
        return [[startLat, startLng]]; // Return just the single point
    }

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
    // Note: This call is still here but will be intercepted by waypoints.js
    // initializeWaypoints();
    fetchWaypointsFromGithub();
    
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
    
    // Set up combined search
    setupCombinedSearch();
    
    // Set up copy to clipboard button
    const copyBtn = document.getElementById('copyDistanceBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyDistanceToClipboard);
    }
    
    // Set up clear buttons
    const clearDistanceBtn = document.getElementById('clearDistanceBtn');
    if (clearDistanceBtn) {
        clearDistanceBtn.addEventListener('click', clearDistanceCalculation);
    }
    
    const clearRouteBtn = document.getElementById('clearRouteBtn');
    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', clearRouteSearch);
    }
    
    // Make the map resize properly when the window is resized
    window.addEventListener('resize', function () {
        map.invalidateSize();
    });

    // Set up route airport search
    setupRouteAirportSearch();
    
    // Set up clear button for route airport search
    const clearRouteAirportBtn = document.getElementById('clearRouteAirportBtn');
    if (clearRouteAirportBtn) {
        clearRouteAirportBtn.addEventListener('click', () => {
            const input = document.getElementById('routeAirportSearch');
            const value = input.value;
            
            // Extract airport code from the input value (format: "CODE - Name")
            const codeMatch = value.match(/^([A-Z0-9]{3,4})\s*-/);
            if (codeMatch && codeMatch[1]) {
                const airportCode = codeMatch[1];
                const markerKey = `route_airport_${airportCode}`;
                
                // Remove marker if it exists
                if (window[markerKey]) {
                    map.removeLayer(window[markerKey]);
                    window[markerKey] = null;
                }
            }
            
            // Clear input field and focus
            input.value = '';
            input.focus();
            updateClearButtonVisibility('routeAirportSearch');
        });
    }
    
    // Set up clear buttons for all other searches with marker removal
    const clearBtnConfigs = [
        { 
            btnId: 'clearDepartureAirportBtn', 
            inputId: 'departureAirportSearch',
            clearAction: () => {
                if (window.departureMarker) {
                    map.removeLayer(window.departureMarker);
                    window.departureMarker = null;
                }
                selectedDepartureAirport = null;
                
                // Hide flight details if either airport is cleared
                if (!selectedDestinationAirport) {
                    updateFlightDetailsCard(false);
                }
                
                // Remove route line if it exists
                if (window.routeLine) {
                    map.removeLayer(window.routeLine);
                    window.routeLine = null;
                }
                if (window.routeArrows) {
                    map.removeLayer(window.routeArrows);
                    window.routeArrows = null;
                }
            }
        },
        { 
            btnId: 'clearDestinationAirportBtn', 
            inputId: 'destinationAirportSearch',
            clearAction: () => {
                if (window.destinationMarker) {
                    map.removeLayer(window.destinationMarker);
                    window.destinationMarker = null;
                }
                selectedDestinationAirport = null;
                
                // Hide flight details if either airport is cleared
                if (!selectedDepartureAirport) {
                    updateFlightDetailsCard(false);
                }
                
                // Remove route line if it exists
                if (window.routeLine) {
                    map.removeLayer(window.routeLine);
                    window.routeLine = null;
                }
                if (window.routeArrows) {
                    map.removeLayer(window.routeArrows);
                    window.routeArrows = null;
                }
            }
        },
        { 
            btnId: 'clearNavaidBtn', 
            inputId: 'navaidSearch',
            clearAction: () => {
                const input = document.getElementById('navaidSearch');
                const value = input.value;
                
                // Find and remove any navaid markers
                // First try exact format matching (IDENT - Name)
                const identMatch = value.match(/^([A-Z0-9]{2,5})\s*-/);
                if (identMatch && identMatch[1]) {
                    const navaidIdent = identMatch[1];
                    removeMarkerByKey(`navaid_${navaidIdent}`);
                } else {
                    // Fallback: check for any navaid markers that might match
                    Object.keys(window).forEach(key => {
                        if (key.startsWith('navaid_')) {
                            removeMarkerByKey(key);
                        }
                    });
                }
            }
        },
        { 
            btnId: 'clearWaypointBtn', 
            inputId: 'waypointSearch',
            clearAction: () => {
                const input = document.getElementById('waypointSearch');
                const value = input.value.trim();
                
                // Get just the waypoint name (might have spaces)
                const waypointName = value.split('(')[0].trim();
                
                if (waypointName) {
                    // Try direct match first
                    removeMarkerByKey(`waypoint_${waypointName}`);
                } else {
                    // If no direct match, check for any waypoint markers
                    Object.keys(window).forEach(key => {
                        if (key.startsWith('waypoint_')) {
                            removeMarkerByKey(key);
                        }
                    });
                }
            }
        },
        { 
            btnId: 'clearCombinedBtn', 
            inputId: 'combinedSearch',
            clearAction: () => {
                const input = document.getElementById('combinedSearch');
                const value = input.value;
                
                // Handle different marker formats based on the value
                if (value.includes('(Airport)')) {
                    const codeMatch = value.match(/^([A-Z0-9]{3,4})\s*-/);
                    if (codeMatch && codeMatch[1]) {
                        removeMarkerByKey(`route_airport_${codeMatch[1]}`);
                    }
                } 
                else if (value.includes('(Navaid)')) {
                    const identMatch = value.match(/^([A-Z0-9]{2,5})\s*-/);
                    if (identMatch && identMatch[1]) {
                        removeMarkerByKey(`navaid_${identMatch[1]}`);
                    }
                }
                else if (value.includes('(Waypoint)')) {
                    const waypointName = value.split(' (Waypoint)')[0].trim();
                    if (waypointName) {
                        removeMarkerByKey(`waypoint_${waypointName}`);
                    }
                }
                else {
                    // If no specific type is detected, check last placed marker
                    removeLastPlacedMarker();
                }
            }
        }
    ];
    
    clearBtnConfigs.forEach(config => {
        const btn = document.getElementById(config.btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                // Clear input field and focus
                const input = document.getElementById(config.inputId);
                input.value = '';
                input.focus();
                
                // Execute the clear action if defined
                if (typeof config.clearAction === 'function') {
                    config.clearAction();
                }
                
                // Update button visibility
                updateClearButtonVisibility(config.inputId);
            });
        }
    });

    // Set up clear button visibility for inputs
    const inputFields = [
        'departureAirportSearch', 
        'destinationAirportSearch', 
        'routeAirportSearch',
        'navaidSearch',
        'waypointSearch',
        'combinedSearch'
    ];
    
    inputFields.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            // Update visibility on input events
            inputElement.addEventListener('input', function() {
                updateClearButtonVisibility(inputId);
            });
            
            // Set initial state
            updateClearButtonVisibility(inputId);
        }
    });

    // Set initial state of flight details card
    updateFlightDetailsCard(false);

    // Set up clear button for route list
    const clearRouteListBtn = document.getElementById('clearRouteListBtn');
    if (clearRouteListBtn) {
        clearRouteListBtn.addEventListener('click', clearRouteList);
    }
    
    // Set up add buttons for adding points to the route table
    // Airport add button
    const addAirportToTableBtn = document.getElementById('addAirportToTableBtn');
    if (addAirportToTableBtn) {
        addAirportToTableBtn.addEventListener('click', () => {
            const input = document.getElementById('routeAirportSearch');
            const value = input.value;
            
            // Extract airport code from the input value (format: "CODE - Name")
            const codeMatch = value.match(/^([A-Z0-9]{3,4})\s*-/);
            if (codeMatch && codeMatch[1]) {
                const airportCode = codeMatch[1];
                
                // Find airport data
                const airport = airports.find(a => a.code === airportCode);
                if (airport) {
                    // Add to route table
                    addPointToRouteTable({
                        name: `${airport.code} - ${airport.name}`,
                        lat: airport.lat,
                        lng: airport.lng,
                        type: 'airport'
                    }, 'routeAirportSearch');
                }
            }
        });
    }
    
    // Navaid add button
    const addNavaidsToTableBtn = document.getElementById('addNavaidsToTableBtn');
    if (addNavaidsToTableBtn) {
        addNavaidsToTableBtn.addEventListener('click', () => {
            const input = document.getElementById('navaidSearch');
            const value = input.value;
            
            // Extract navaid ident from the input value (format: "IDENT - Name")
            const identMatch = value.match(/^([A-Z0-9]{2,5})\s*-/);
            if (identMatch && identMatch[1]) {
                const navaidIdent = identMatch[1];
                
                // Find navaid data
                const navaid = navaids.find(n => n.ident === navaidIdent);
                if (navaid) {
                    // Add to route table
                    addPointToRouteTable({
                        name: `${navaid.ident} - ${navaid.name}`,
                        lat: navaid.lat,
                        lng: navaid.lng,
                        type: 'navaid'
                    }, 'navaidSearch');
                }
            }
        });
    }
    
    // Waypoint add button
    const addFixToTableBtn = document.getElementById('addFixToTableBtn');
    if (addFixToTableBtn) {
        addFixToTableBtn.addEventListener('click', () => {
            const input = document.getElementById('waypointSearch');
            const waypointName = input.value.trim();
            
            if (waypointName) {
                // Find waypoint data
                const waypoint = waypoints.find(w => w.name === waypointName);
                if (waypoint) {
                    // Add to route table
                    addPointToRouteTable({
                        name: waypoint.name,
                        lat: waypoint.lat,
                        lng: waypoint.lng,
                        type: 'waypoint'
                    }, 'waypointSearch');
                }
            }
        });
    }
    
    // Combined search add button
    const addPointToTableBtn = document.getElementById('addPointToTableBtn');
    if (addPointToTableBtn) {
        addPointToTableBtn.addEventListener('click', () => {
            const input = document.getElementById('combinedSearch');
            const value = input.value;
            
            if (value.includes('(Airport)')) {
                const codeMatch = value.match(/^([A-Z0-9]{3,4})\s*-/);
                if (codeMatch && codeMatch[1]) {
                    const airportCode = codeMatch[1];
                    const airport = airports.find(a => a.code === airportCode);
                    if (airport) {
                        addPointToRouteTable({
                            name: `${airport.code} - ${airport.name}`,
                            lat: airport.lat,
                            lng: airport.lng,
                            type: 'airport'
                        }, 'combinedSearch');
                    }
                }
            } 
            else if (value.includes('(Navaid)')) {
                const identMatch = value.match(/^([A-Z0-9]{2,5})\s*-/);
                if (identMatch && identMatch[1]) {
                    const navaidIdent = identMatch[1];
                    const navaid = navaids.find(n => n.ident === navaidIdent);
                    if (navaid) {
                        addPointToRouteTable({
                            name: `${navaid.ident} - ${navaid.name}`,
                            lat: navaid.lat,
                            lng: navaid.lng,
                            type: 'navaid'
                        }, 'combinedSearch');
                    }
                }
            }
            else if (value.includes('(Waypoint)')) {
                const waypointName = value.split(' (Waypoint)')[0].trim();
                if (waypointName) {
                    const waypoint = waypoints.find(w => w.name === waypointName);
                    if (waypoint) {
                        addPointToRouteTable({
                            name: waypoint.name,
                            lat: waypoint.lat,
                            lng: waypoint.lng,
                            type: 'waypoint'
                        }, 'combinedSearch');
                    }
                }
            }
        });
    }
});

// Helper function to remove a marker by its key
function removeMarkerByKey(key) {
    if (window[key]) {
        map.removeLayer(window[key]);
        window[key] = null;
        console.log(`Removed marker: ${key}`);
        return true;
    }
    return false;
}

// Helper function to remove the last placed marker when type can't be determined
function removeLastPlacedMarker() {
    // Check for markers in order: route airport, navaid, waypoint
    const markerTypes = ['route_airport_', 'navaid_', 'waypoint_'];
    let found = false;
    
    for (const type of markerTypes) {
        if (found) break;
        
        Object.keys(window).forEach(key => {
            if (!found && key.startsWith(type) && window[key]) {
                removeMarkerByKey(key);
                found = true;
            }
        });
    }
}

// Function to update clear button visibility
function updateClearButtonVisibility(inputId) {
    const inputElement = document.getElementById(inputId);
    const buttonId = 'clear' + inputId.charAt(0).toUpperCase() + inputId.slice(1) + 'Btn';
    const clearButton = document.getElementById(buttonId);
    
    if (inputElement && clearButton) {
        // Update the input's "value" attribute to work with CSS selector
        if (inputElement.value) {
            inputElement.setAttribute('value', inputElement.value);
        } else {
            inputElement.removeAttribute('value');
        }
    }
}

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
    
    // Add blur event listener to hide dropdown when focus is lost
    searchInput.addEventListener('blur', (e) => {
        // Use setTimeout to allow click events on dropdown items to fire first
        setTimeout(() => {
            const dropdownToggle = bootstrap.Dropdown.getInstance(searchInput);
            if (dropdownToggle) {
                dropdownToggle.hide();
            }
        }, 200);
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
    
    // Add blur event listener to hide dropdown when focus is lost
    searchInput.addEventListener('blur', (e) => {
        // Use setTimeout to allow click events on dropdown items to fire first
        setTimeout(() => {
            const dropdownToggle = bootstrap.Dropdown.getInstance(searchInput);
            if (dropdownToggle) {
                dropdownToggle.hide();
            }
        }, 200);
    });
}

// Function to set up waypoint search functionality
function setupWaypointSearch() {
    const searchInput = document.getElementById('waypointSearch');
    if (!searchInput) {
        console.error("Waypoint search input not found");
        return;
    }
    
    // console.log('Setting up waypoint search functionality');
    
    // Initialize dropdown with all waypoints when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        // console.log(`Focus event: ${waypoints.length} waypoints available`);
        
        if (searchInput.value.trim() === '') {
            // Important: This line displays all waypoints when the field is focused
            displayWaypointsInDropdown(waypoints, 'waypointDropdown', 'waypointSearch');
        }
        
        // Show the dropdown when focused
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Filter waypoints as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            // Show all waypoints when empty
            displayWaypointsInDropdown(waypoints, 'waypointDropdown', 'waypointSearch');
            return;
        }
        
        // Filter waypoints - prioritize name matches
        const filteredWaypoints = waypoints.filter(waypoint => 
            waypoint.name.toLowerCase().includes(searchTerm) || 
            (waypoint.type && waypoint.type.toLowerCase().includes(searchTerm))
        );
        
        console.log(`Found ${filteredWaypoints.length} waypoints matching "${searchTerm}"`);
        
        // Update dropdown with filtered results
        displayWaypointsInDropdown(filteredWaypoints, 'waypointDropdown', 'waypointSearch');
        
        // Ensure dropdown is showing
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Initialize dropdown on page load if waypoints are already available
    if (window.waypoints && window.waypoints.length > 0) {
        console.log(`Initializing dropdown with ${window.waypoints.length} waypoints already available`);
        displayWaypointsInDropdown(window.waypoints, 'waypointDropdown', 'waypointSearch');
    }
    
    // Add blur event listener to hide dropdown when focus is lost
    searchInput.addEventListener('blur', (e) => {
        // Use setTimeout to allow click events on dropdown items to fire first
        setTimeout(() => {
            try {
                const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
                dropdownToggle.hide();
            } catch (err) {
                console.error("Error hiding dropdown:", err);
            }
        }, 200);
    });
}

// Function to calculate and display flight details
function updateFlightDetails() {
    if (!selectedDepartureAirport || !selectedDestinationAirport) {
        updateFlightDetailsCard(false);
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
    
    // Show flight details card with content
    updateFlightDetailsCard(true);
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
    
    // Fit map to all markers instead of just flying to this one
    fitMapToAllMarkers();
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
    
    // Add blur event listener to hide dropdown when focus is lost
    searchInput.addEventListener('blur', (e) => {
        // Use setTimeout to allow click events on dropdown items to fire first
        setTimeout(() => {
            const dropdownToggle = bootstrap.Dropdown.getInstance(searchInput);
            if (dropdownToggle) {
                dropdownToggle.hide();
            }
        }, 200);
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

// Function to fetch and process waypoints data from GitHub URL
async function fetchWaypointsFromGithub() {
    try {
        // Define typeIndex variable before using it
        const typeIndex = 2; // Or whatever appropriate value should be here
        
        // Show loading state
        document.getElementById('waypointSearch').setAttribute('disabled', 'disabled');
        document.getElementById('waypointSearch').placeholder = "Loading waypoints...";
        
        // console.log("Fetching waypoints from GitHub...");
        
        // Fetch the waypoints data from GitHub
        const response = await fetch('https://raw.githubusercontent.com/pxzundev/distance_calc/refs/heads/main/points.csv');
        
        // Use ArrayBuffer and TextDecoder for proper encoding handling
        const buffer = await response.arrayBuffer();
        // Use TextDecoder with UTF-8 encoding and handle BOM if present
        const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
        const csvText = decoder.decode(buffer);
        
        // Parse CSV data
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        // Find relevant column indexes
        const nameIndex = headers.findIndex(h => h.trim() === 'Name');
        const latIndex = headers.findIndex(h => h.trim() === 'Latitude  (WGS84)');
        const lngIndex = headers.findIndex(h => h.trim() === 'Longitude  (WGS84)');
        // Process all rows
        const processedWaypoints = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue; // Skip empty lines
            
            // Split CSV line
            const values = lines[i].split(',');
            
            // Skip if we don't have enough values
            if (values.length <= Math.max(nameIndex, latIndex, lngIndex, typeIndex)) {
                continue;
            }
            
            const name = values[nameIndex]?.trim();
            let lat = values[latIndex]?.trim();
            let lng = values[lngIndex]?.trim();
            const type = values[typeIndex]?.trim().toLowerCase(); // Convert to lowercase for easier comparison
            
            // Skip only if name is empty
            if (!name || name === "") continue;
            
            // Parse coordinates with improved handling
            if (lat && lng) {
                try {
                    // Try to parse different coordinate formats
                    let parsedLat, parsedLng;
                    
                    // Format 1: "S41.3319°" and "E174.8056°"
                    const latMatch = lat.match(/([NS])(\d+)\.(\d+)°?/);
                    const lngMatch = lng.match(/([EW])(\d+)\.(\d+)°?/);
                    
                    if (latMatch && lngMatch) {
                        // Parse from directional format
                        const latDir = latMatch[1];
                        const latDeg = parseFloat(`${latMatch[2]}.${latMatch[3]}`);
                        
                        const lngDir = lngMatch[1];
                        const lngDeg = parseFloat(`${lngMatch[2]}.${lngMatch[3]}`);
                        
                        parsedLat = latDir === 'S' ? -latDeg : latDeg;
                        parsedLng = lngDir === 'W' ? -lngDeg : lngDeg;
                    } else {
                        // Format 2: Try to parse as decimal numbers
                        parsedLat = parseFloat(lat);
                        parsedLng = parseFloat(lng);
                        
                        // Check if these are valid numbers
                        if (isNaN(parsedLat) || isNaN(parsedLng)) {
                            console.warn(`Invalid coordinate format for ${name}: ${lat}, ${lng}`);
                            continue;
                        }
                    }
                    
                    // Validate coordinate ranges
                    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
                        console.warn(`Coordinate out of range for ${name}: ${parsedLat}, ${parsedLng}`);
                        continue;
                    }
                    
                    // Add to processed waypoints
                    processedWaypoints.push({
                        name: name,
                        lat: parsedLat,
                        lng: parsedLng,
                        type: type
                    });
                    
                } catch (err) {
                    console.warn(`Failed to parse coordinates for ${name}: ${lat}, ${lng} - ${err.message}`);
                }
            }
        }
        
        // Update the global waypoints variable
        waypoints = processedWaypoints;
        
        // Re-enable search and update placeholder
        document.getElementById('waypointSearch').removeAttribute('disabled');
        document.getElementById('waypointSearch').placeholder = "Search waypoints...";
        
        console.log(`Loaded ${waypoints.length} waypoints`);
        // if (waypoints.length > 0) {
        //     console.log("Sample waypoint:", waypoints[0]);
        // }
        
        // Initialize the dropdown with the first set of results
        displayWaypointsInDropdown(waypoints.slice(0, 100), 'waypointDropdown', 'waypointSearch');
        
    } catch (error) {
        console.error("Error fetching waypoints data from GitHub:", error);
        document.getElementById('waypointSearch').placeholder = "Error loading waypoints";
        document.getElementById('waypointSearch').removeAttribute('disabled');
        
        // In case of error, set waypoints to empty array
        waypoints = [];
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
            <span class="airport-name">${waypoint.type || 'Waypoint'}</span>
            <div class="text-muted small">${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Add waypoint marker to map
            addWaypointMarker(waypoint);
            
            // Update search input with selected waypoint
            document.getElementById(inputId).value = `${waypoint.name}`;
            
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

// Function to set up combined search functionality
function setupCombinedSearch() {
    const searchInput = document.getElementById('combinedSearch');
    if (!searchInput) {
        console.error("Combined search input not found");
        return;
    }
    
    // console.log('Setting up combined search functionality');
    
    // Initialize dropdown with limited results when clicked/focused if empty
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim() === '') {
            // Show a mix of results from all data sources when focused
            const combinedResults = getCombinedSearchResults('');
            displayCombinedResults(combinedResults, 'combinedDropdown', 'combinedSearch');
        }
        
        // Show the dropdown when focused
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Filter combined results as user types
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        
        // Get combined results based on search term
        const combinedResults = getCombinedSearchResults(searchTerm);
        
        // Update dropdown with filtered results
        displayCombinedResults(combinedResults, 'combinedDropdown', 'combinedSearch');
        
        // Ensure dropdown is showing
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Ensure dropdown shows on click even after selection
    searchInput.addEventListener('click', (e) => {
        // Prevent the dropdown from being immediately closed
        e.stopPropagation();
        
        // Show dropdown
        try {
            const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
            dropdownToggle.show();
        } catch (err) {
            console.error("Error showing dropdown:", err);
        }
    });
    
    // Add blur event listener to hide dropdown when focus is lost
    searchInput.addEventListener('blur', (e) => {
        // Use setTimeout to allow click events on dropdown items to fire first
        setTimeout(() => {
            try {
                const dropdownToggle = bootstrap.Dropdown.getOrCreateInstance(searchInput);
                dropdownToggle.hide();
            } catch (err) {
                console.error("Error hiding dropdown:", err);
            }
        }, 200);
    });
}

// Function to get combined search results from airports, navaids, and waypoints
function getCombinedSearchResults(searchTerm) {
    const results = [];
    const maxPerCategory = searchTerm ? 200 : 50; // Limit per category
    
    // Format airports for combined search
    const filteredAirports = airports.filter(airport => 
        !searchTerm || 
        airport.code.toLowerCase().includes(searchTerm) || 
        airport.name.toLowerCase().includes(searchTerm) || 
        airport.country.toLowerCase().includes(searchTerm)
    ).slice(0, maxPerCategory);
    
    filteredAirports.forEach(airport => {
        results.push({
            type: 'airport',
            id: airport.code,
            name: airport.name,
            lat: airport.lat,
            lng: airport.lng,
            details: airport.country,
            originalData: airport
        });
    });
    
    // Format navaids for combined search
    const filteredNavaids = navaids.filter(navaid => 
        !searchTerm || 
        navaid.ident.toLowerCase().includes(searchTerm) || 
        navaid.name.toLowerCase().includes(searchTerm) || 
        navaid.type.toLowerCase().includes(searchTerm)
    ).slice(0, maxPerCategory);
    
    filteredNavaids.forEach(navaid => {
        results.push({
            type: 'navaid',
            id: navaid.ident,
            name: navaid.name,
            lat: navaid.lat,
            lng: navaid.lng,
            details: `${navaid.type} - ${navaid.freq || 'N/A'}`,
            originalData: navaid
        });
    });
    
    // Format waypoints for combined search
    const filteredWaypoints = waypoints.filter(waypoint => 
        !searchTerm || 
        waypoint.name.toLowerCase().includes(searchTerm) || 
        (waypoint.type && waypoint.type.toLowerCase().includes(searchTerm))
    ).slice(0, maxPerCategory);
    
    filteredWaypoints.forEach(waypoint => {
        results.push({
            type: 'waypoint',
            id: waypoint.name,
            name: waypoint.type || 'Waypoint',
            lat: waypoint.lat,
            lng: waypoint.lng,
            details: `${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}`,
            originalData: waypoint
        });
    });
    
    // Sort results by relevance if there's a search term
    if (searchTerm) {
        results.sort((a, b) => {
            // Prioritize exact matches by ID
            const aExactIdMatch = a.id.toLowerCase() === searchTerm;
            const bExactIdMatch = b.id.toLowerCase() === searchTerm;
            if (aExactIdMatch && !bExactIdMatch) return -1;
            if (!aExactIdMatch && bExactIdMatch) return 1;
            
            // Then prioritize items that start with the search term
            const aStartsWith = a.id.toLowerCase().startsWith(searchTerm);
            const bStartsWith = b.id.toLowerCase().startsWith(searchTerm);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            // Otherwise keep original order
            return 0;
        });
    }
    
    return results;
}

// Function to display combined search results in dropdown
function displayCombinedResults(results, dropdownId, inputId) {
    const dropdownMenu = document.getElementById(dropdownId);
    dropdownMenu.innerHTML = '';

    if (results.length === 0) {
        const noResults = document.createElement('span');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No results found';
        dropdownMenu.appendChild(noResults);
        return;
    }

    // Add header for each type
    let currentType = '';
    
    results.forEach((item, index) => {
        // Add header when type changes
        if (item.type !== currentType) {
            currentType = item.type;
            
            if (index > 0) {
                // Add separator if not the first item
                const separator = document.createElement('div');
                separator.className = 'dropdown-divider';
                dropdownMenu.appendChild(separator);
            }
            
            const header = document.createElement('h6');
            header.className = 'dropdown-header';
            header.textContent = currentType.charAt(0).toUpperCase() + currentType.slice(1) + 's';
            dropdownMenu.appendChild(header);
        }
        
        // Create dropdown item
        const dropdownItem = document.createElement('a');
        dropdownItem.href = '#';
        dropdownItem.className = 'dropdown-item';
        
        // Set icon based on type
        let icon = '';
        if (item.type === 'airport') {
            icon = '<i class="bi bi-airplane-fill me-2"></i>';
        } else if (item.type === 'navaid') {
            icon = '<i class="bi bi-broadcast-pin me-2"></i>';
        } else if (item.type === 'waypoint') {
            icon = '<i class="bi bi-diamond-fill me-2"></i>';
        }
        
        dropdownItem.innerHTML = `
            ${icon}<span class="airport-code">${item.id}</span>
            <span class="airport-name">${item.name}</span>
            <div class="text-muted small">${item.details}</div>
        `;

        dropdownItem.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Add marker to map based on type
            if (item.type === 'airport') {
                addRouteAirportMarker(item.originalData);
                document.getElementById(inputId).value = `${item.id} - ${item.name} (Airport)`;
            } else if (item.type === 'navaid') {
                addNavaidMarker(item.originalData);
                document.getElementById(inputId).value = `${item.id} - ${item.name} (Navaid)`;
            } else if (item.type === 'waypoint') {
                addWaypointMarker(item.originalData);
                document.getElementById(inputId).value = `${item.id} (Waypoint)`;
            }
            
            // Hide dropdown
            const dropdownEl = bootstrap.Dropdown.getInstance(document.getElementById(inputId));
            if (dropdownEl) {
                dropdownEl.hide();
            }
        });

        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Show count if limited
    if (results.length >= 100) {
        const countInfo = document.createElement('div');
        countInfo.className = 'dropdown-item text-muted text-center';
        countInfo.textContent = `Showing limited results. Please refine your search.`;
        dropdownMenu.appendChild(countInfo);
    }
}

// Function to clear distance calculation inputs and map markers
function clearDistanceCalculation() {
    // Clear any warnings first
    clearAirportWarning(true);  // Clear destination warning
    clearAirportWarning(false); // Clear departure warning
    
    // Reset input fields
    document.getElementById('departureAirportSearch').value = '';
    document.getElementById('destinationAirportSearch').value = '';
    
    // Reset selected airports
    selectedDepartureAirport = null;
    selectedDestinationAirport = null;
    
    // Remove great circle markers from map
    if (window.departureMarker) {
        map.removeLayer(window.departureMarker);
    }
    if (window.destinationMarker) {
        map.removeLayer(window.destinationMarker);
    }
    if (window.routeLine) {
        map.removeLayer(window.routeLine);
    }
    if (window.routeArrows) {
        map.removeLayer(window.routeArrows);
    }
    
    // Reset the flight details content instead of hiding the card
    const flightDistanceElement = document.getElementById('flightDistance');
    if (flightDistanceElement) {
        flightDistanceElement.textContent = 'Select an airport pair';
    }
    
    // Hide the copy button
    const copyDistanceBtn = document.getElementById('copyDistanceBtn');
    if (copyDistanceBtn) {
        copyDistanceBtn.classList.add('d-none');
    }
    
    // Only reset map view if there are no route points on the map
    const hasRoutePoints = checkForRoutePoints();
    if (!hasRoutePoints) {
        map.setView([-41.3272, 174.8053], 10);
    }
}

// Helper function to check if there are any route points on the map
function checkForRoutePoints() {
    let hasRoutePoints = false;
    
    // Check for any markers related to route search
    Object.keys(window).forEach(key => {
        if (key.startsWith('route_airport_') || 
            key.startsWith('navaid_') || 
            key.startsWith('waypoint_')) {
            if (window[key]) {
                hasRoutePoints = true;
            }
        }
    });
    
    return hasRoutePoints;
}

// Function to clear route search inputs and map markers
function clearRouteSearch() {
    // Reset input fields
    document.getElementById('routeAirportSearch').value = '';
    document.getElementById('navaidSearch').value = '';
    document.getElementById('waypointSearch').value = '';
    if (document.getElementById('combinedSearch')) {
        document.getElementById('combinedSearch').value = '';
    }
    
    // Remove route markers from map
    const markersToRemove = [];
    
    // Find all markers related to route search
    Object.keys(window).forEach(key => {
        if (key.startsWith('route_airport_') || 
            key.startsWith('navaid_') || 
            key.startsWith('waypoint_')) {
            markersToRemove.push(key);
        }
    });
    
    // Remove the identified markers
    markersToRemove.forEach(key => {
        if (window[key]) {
            map.removeLayer(window[key]);
            window[key] = null;
        }
    });
}

// Function to update flight details card UI
function updateFlightDetailsCard(showDetails) {
    const flightDetailsCard = document.getElementById('flightDetailsCard');
    const flightDetailsContent = flightDetailsCard.querySelector('.flight-details-content');
    const flightDetailsPlaceholder = flightDetailsCard.querySelector('.flight-details-placeholder');
    const copyDistanceBtn = document.getElementById('copyDistanceBtn');
    
    if (showDetails) {
        // Show the card with details
        flightDetailsCard.classList.remove('d-none');
        // Show content, hide placeholder
        flightDetailsContent.classList.remove('d-none');
        if (flightDetailsPlaceholder) {
            flightDetailsPlaceholder.classList.add('d-none');
        }
        // Show the copy button
        copyDistanceBtn.classList.remove('d-none');
    } else {
        // Show the card with placeholder
        flightDetailsCard.classList.remove('d-none');
        // Show placeholder, hide content (if both airports aren't selected)
        if (!selectedDepartureAirport || !selectedDestinationAirport) {
            // Hide the copy button when no airports or only one is selected
            copyDistanceBtn.classList.add('d-none');
        }
    }
}

// Function to update the route visualization on the map
function updateRouteVisualization() {
    // Clear any existing route visualization
    clearRouteVisualization();
    
    // Exit if there are no route points
    if (routePoints.length === 0) {
        return;
    }
    
    // Create a layer group for route lines and markers
    routeLineGroup = L.layerGroup().addTo(map);
    
    // Create line connecting all points
    const polylinePoints = routePoints.map(point => [point.lat, point.lng]);
    
    // Add the polyline to the map with improved styling
    const routeLine = L.polyline(polylinePoints, {
        color: '#3388ff',
        weight: 3,
        opacity: 0.8,
        lineJoin: 'round',
        dashArray: '5, 5', // Add dashed line style for visibility
        className: 'route-path'
    }).addTo(routeLineGroup);
    
    // Add arrows to indicate direction along the path
    if (routePoints.length > 1) {
        const routeArrows = L.polylineDecorator(polylinePoints, {
            patterns: [
                {
                    offset: '10%', 
                    repeat: '20%', 
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 10,
                        pathOptions: {
                            fillOpacity: 1,
                            weight: 0,
                            color: '#3388ff'
                        }
                    })
                }
            ]
        }).addTo(routeLineGroup);
    }
    
    // Add distance labels between consecutive points
    if (routePoints.length > 1) {
        for (let i = 0; i < routePoints.length - 1; i++) {
            const pt1 = routePoints[i];
            const pt2 = routePoints[i + 1];
            
            // Calculate distance
            const distance = calculateDistance(pt1.lat, pt1.lng, pt2.lat, pt2.lng);
            const distanceNM = Math.round(distance / 1.852);
            
            // Find midpoint for the label
            const midpoint = [
                (pt1.lat + pt2.lat) / 2,
                (pt1.lng + pt2.lng) / 2
            ];
            
            // Add distance label at midpoint
            const distanceIcon = L.divIcon({
                className: 'distance-label',
                html: `<div class="distance-badge">${distanceNM} nm</div>`,
                iconSize: [60, 20],
                iconAnchor: [30, 10]
            });
            
            L.marker(midpoint, { icon: distanceIcon, interactive: false }).addTo(routeLineGroup);
        }
    }
    
    // Add markers for each point with sequence numbers
    routePoints.forEach((point, index) => {
        // Determine marker color based on position
        let markerColor = '#6c757d'; // Default gray for intermediate points
        
        if (index === 0) {
            markerColor = '#198754'; // Green for first point
        } else if (index === routePoints.length - 1) {
            markerColor = '#dc3545'; // Red for last point
        }
        
        // Create marker with sequence number
        const markerIcon = L.divIcon({
            className: 'route-point-marker',
            html: `<div class="marker-container" style="text-align: center; border-radius: 2rem; padding: 4px;">
                    <span class="marker-number" style="color: ${markerColor};font-weight: bold;">${index + 1}</span>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, -12],
            popupAnchor: [0, -15]
        });
        
        // Add marker to map with detailed popup
        L.marker([point.lat, point.lng], { icon: markerIcon })
            .bindPopup(`
                <b>${point.name}</b><br>
                <small>${point.type || 'Waypoint'}<br>
                Position: ${index + 1} of ${routePoints.length}<br>
                ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</small>
            `)
            .addTo(routeLineGroup);
    });
    
    // Add a total distance label at the bottom of the route table
    if (routePoints.length > 1) {
        let totalDistance = 0;
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const pt1 = routePoints[i];
            const pt2 = routePoints[i + 1];
            
            // Calculate and add segment distance
            const distance = calculateDistance(pt1.lat, pt1.lng, pt2.lat, pt2.lng);
            totalDistance += distance;
        }
        
        // Convert to nautical miles
        const totalNM = Math.round(totalDistance / 1.852);
        
        // Update the total distance in the UI if there's an element for it
        const totalDistanceElement = document.getElementById('totalRouteDistance');
        if (totalDistanceElement) {
            totalDistanceElement.textContent = `Total: ${totalNM} nm`;
            totalDistanceElement.classList.remove('d-none');
        }
    }
    
    // Fit map to show all route points with padding
    if (routePoints.length > 1) {
        const bounds = L.latLngBounds(polylinePoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    } else if (routePoints.length === 1) {
        // If only one point, center on it
        map.setView([routePoints[0].lat, routePoints[0].lng], 10);
    }
}

// Function to clear route visualization
function clearRouteVisualization() {
    if (routeLineGroup) {
        routeLineGroup.clearLayers();
        map.removeLayer(routeLineGroup);
        routeLineGroup = null;
    }
    
    // Also clear the total distance display
    const totalDistanceElement = document.getElementById('totalRouteDistance');
    if (totalDistanceElement) {
        totalDistanceElement.textContent = '';
        totalDistanceElement.classList.add('d-none');
    }
}
