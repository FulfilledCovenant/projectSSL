// --- PASTE YOUR FIREBASE CONFIG OBJECT HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyCcalgUUQQlj458MtcbIddGpMbSV-Y3bew",
  authDomain: "theproject-cdb6e.firebaseapp.com",
  databaseURL: "https://theproject-cdb6e-default-rtdb.firebaseio.com",
  projectId: "theproject-cdb6e",
  storageBucket: "theproject-cdb6e.firebasestorage.app",
  messagingSenderId: "131077003796",
  appId: "1:131077003796:web:9d191877a5dc9b49a3e501",
  measurementId: "G-ZQ5L4FC80P"
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const itemsRef = database.ref('items');

// --- DOM Elements ---
const tableBody = document.getElementById('items-table-body');
const chartPopup = document.getElementById('chart-popup');
const chartTitle = document.getElementById('chart-title');
const closeChartBtn = document.getElementById('close-chart-btn');
const chartCanvas = document.getElementById('item-price-chart').getContext('2d');
const chartNoDataMsg = document.getElementById('chart-no-data');

// --- State Management ---
const stateStorageKey = 'gameItemPriceStates'; // For price, change% etc.
const historyStorageKey = 'gameItemPriceHistory_v2'; // Store timestamp/price pairs
let itemStates = {}; // Holds { price, change, changePercent, changeClass, changePrefix }
let itemHistory = {}; // Holds { itemName: [{ts: timestamp, price: number}] }
let itemChart = null; // Holds the Chart.js instance

// --- Load Initial State & History ---
function loadInitialData() {
    const storedStatesString = localStorage.getItem(stateStorageKey);
    if (storedStatesString) {
        try {
            itemStates = JSON.parse(storedStatesString);
            console.log("Loaded states:", itemStates);
        } catch (e) { console.error("Error parsing stored states:", e); localStorage.removeItem(stateStorageKey); }
    }

    const storedHistoryString = localStorage.getItem(historyStorageKey);
    if (storedHistoryString) {
        try {
            itemHistory = JSON.parse(storedHistoryString);
            console.log("Loaded history");
            // Optional: Could prune history on load here as well
        } catch (e) { console.error("Error parsing stored history:", e); localStorage.removeItem(historyStorageKey); }
    }
}

loadInitialData();

// --- History Management ---
const HISTORY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function addHistoryPoint(itemName, price) {
    if (typeof price !== 'number') return; // Don't record non-numeric prices

    const now = Date.now();
    if (!itemHistory[itemName]) {
        itemHistory[itemName] = [];
    }

    // Add the new point
    itemHistory[itemName].push({ ts: now, price: price });

    // Prune old data (older than 24 hours)
    const cutoffTime = now - HISTORY_DURATION_MS;
    itemHistory[itemName] = itemHistory[itemName].filter(point => point.ts >= cutoffTime);

    // console.log(`History for ${itemName}:`, itemHistory[itemName].length, "points");
}

function saveHistory() {
    try {
        localStorage.setItem(historyStorageKey, JSON.stringify(itemHistory));
    } catch (e) {
        console.error("Error saving history to localStorage:", e);
    }
}

function saveStates() {
     try {
        localStorage.setItem(stateStorageKey, JSON.stringify(itemStates));
        console.log("Saved latest item states to localStorage");
     } catch (e) {
        console.error("Error saving states to localStorage:", e);
     }
}

// --- Formatting ---
function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
}

// --- Charting ---
function showChart(itemName) {
    console.log(`Showing chart for: ${itemName}`);
    if (!itemHistory[itemName] || itemHistory[itemName].length === 0) {
        console.log("No history found for chart.");
        chartNoDataMsg.style.display = 'block'; // Show no data message
    } else {
        chartNoDataMsg.style.display = 'none'; // Hide no data message
    }


    const history = itemHistory[itemName] || [];
    const now = Date.now();
    const cutoffTime = now - HISTORY_DURATION_MS;

    // Filter data again just to be sure (pruning might not be instant)
    const chartData = history.filter(point => point.ts >= cutoffTime);

     // If only one point, duplicate it slightly earlier for Chart.js to draw a line/point
     if (chartData.length === 1) {
         chartData.unshift({ ts: chartData[0].ts - 1000, price: chartData[0].price }); // Add point 1 sec earlier
     }


    if (itemChart) {
        itemChart.destroy(); // Destroy previous chart instance
    }

     if (chartData.length < 1) { // Check *after* potential duplicate point add
         chartNoDataMsg.style.display = 'block';
         // Optionally clear canvas if needed, though destroy should handle it.
         chartPopup.style.display = 'flex'; // Show popup even with no data message
         chartTitle.textContent = `${itemName} History (Last 24h)`;
         return; // Don't create chart if no data
     }


    chartTitle.textContent = `${itemName} History (Last 24h)`;

    itemChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Price',
                data: chartData.map(point => ({ x: point.ts, y: point.price })),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1, // Slightly curved lines
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart to fill wrapper
            scales: {
                x: {
                    type: 'time', // Use time scale
                    time: {
                        unit: 'hour', // Adjust unit based on duration? 'minute', 'hour', 'day'
                         tooltipFormat: 'PPpp', // Date fns format for tooltips (e.g., Aug 21, 2023, 2:30:00 PM)
                        displayFormats: { // How labels appear on the axis
                             hour: 'HH:mm' // e.g., 14:30
                         }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    },
                     grid: { color: 'rgba(255, 255, 255, 0.1)' } // Light grid lines
                },
                y: {
                    beginAtZero: false, // Don't force Y axis to start at 0
                    title: {
                        display: true,
                        text: 'Price'
                    },
                     ticks: { // Format Y axis labels if needed
                         callback: function(value, index, values) {
                             return formatNumber(value); // Use our number formatter
                         }
                     },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' } // Light grid lines
                }
            },
            plugins: {
                 tooltip: {
                      callbacks: {
                           label: function(context) {
                               let label = context.dataset.label || '';
                               if (label) {
                                   label += ': ';
                               }
                               if (context.parsed.y !== null) {
                                   label += formatNumber(context.parsed.y); // Format tooltip value
                               }
                               return label;
                           }
                      }
                 }
            }
        }
    });

    chartPopup.style.display = 'flex'; // Show the popup
}

function hideChart() {
    if (itemChart) {
        itemChart.destroy();
        itemChart = null;
    }
    chartPopup.style.display = 'none';

     // Remove selection highlight from table rows
     document.querySelectorAll('#items-table tbody tr.selected-row').forEach(row => {
         row.classList.remove('selected-row');
     });
}

// --- Display Logic ---
function displayItems(currentFirebaseData) {
    // (This function remains mostly the same as the previous version)
    // ... calculations for newState (price, change, changePercent, etc.) ...
    // --- Key additions WITHIN the forEach loop: ---

    tableBody.innerHTML = '';
    currentFirebaseData = currentFirebaseData || {};
    let newItemStates = {};
    const allItemKeys = new Set([...Object.keys(currentFirebaseData), ...Object.keys(itemStates)]);
    const sortedKeys = Array.from(allItemKeys).sort();

    if (sortedKeys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">Loading or no items found...</td></tr>';
        return {};
    }

    let historyNeedsUpdate = false; // Flag to save history only if changes occurred

    sortedKeys.forEach(itemName => {
        const currentPrice = currentFirebaseData[itemName];
        const previousState = itemStates[itemName];
        let newState = {
            price: 'N/A', change: 'N/A', changePercent: 'N/A',
            changeClass: 'no-change', changePrefix: ''
        };

        let priceChanged = false; // Track if price specifically changed for history

        if (currentPrice !== undefined) {
            newState.price = currentPrice;
             // Check if the price actually changed from the last known state for history logging
             if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number' && previousState.price !== currentPrice) {
                 priceChanged = true;
             } else if (!previousState && typeof currentPrice === 'number') {
                  priceChanged = true; // It's a new item with a valid price
             }


            if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number') {
                const priceDiff = currentPrice - previousState.price;
                newState.change = priceDiff;
                if (previousState.price !== 0) newState.changePercent = (priceDiff / previousState.price) * 100;
                else if (currentPrice > 0) newState.changePercent = Infinity;
                else newState.changePercent = 0;

                if (priceDiff > 0) { newState.changeClass = 'positive-change'; newState.changePrefix = '+'; }
                else if (priceDiff < 0) { newState.changeClass = 'negative-change'; }
                 else { newState.change = 0; newState.changePercent = 0; } // Explicitly set 0 if no diff

            } else if (typeof currentPrice === 'number') {
                newState.change = 'N/A'; newState.changePercent = 'N/A';
            }

             // --- Add point to history IF price changed ---
             if (priceChanged) {
                 addHistoryPoint(itemName, currentPrice);
                 historyNeedsUpdate = true; // Mark that history was modified
             }

        } else if (previousState) {
             // Item deleted
             // Remove from history? Or keep history but don't display row? Let's keep history for now.
            return; // Skip row rendering
        } else {
            return; // Skip item
        }

        const displayPrice = typeof newState.price === 'number' ? formatNumber(newState.price) : 'N/A';
        let displayChange = (typeof newState.change === 'number') ? formatNumber(newState.change.toFixed(0)) : 'N/A';
        let displayChangePercent = 'N/A';
        if (typeof newState.changePercent === 'number') {
            displayChangePercent = (newState.changePercent === Infinity) ? "∞%" : `${newState.changePercent.toFixed(2)}%`;
        }

        const itemRow = document.createElement('tr');
        // --- ADD data attribute to row ---
        itemRow.setAttribute('data-item-name', itemName);
        itemRow.innerHTML = `
            <td>${itemName}</td>
            <td>${displayPrice}</td>
            <td class="${newState.changeClass}">${newState.changePrefix}${displayChange}</td>
            <td class="${newState.changeClass}">${newState.changePrefix}${displayChangePercent}</td>
        `;

        // --- ADD click listener to row ---
        itemRow.addEventListener('click', (event) => {
            // Remove highlight from previously selected row
             document.querySelectorAll('#items-table tbody tr.selected-row').forEach(row => {
                 row.classList.remove('selected-row');
             });
             // Add highlight to clicked row
             event.currentTarget.classList.add('selected-row');

             showChart(itemName); // Show chart for this item
        });

        tableBody.appendChild(itemRow);
        newItemStates[itemName] = newState;
    });

    if (historyNeedsUpdate) {
         saveHistory(); // Save history to localStorage only if something changed
    }

    return newItemStates;
}

// --- Event Listeners ---
closeChartBtn.addEventListener('click', hideChart);
// Optional: Close chart if clicked outside the content area
chartPopup.addEventListener('click', (event) => {
    if (event.target === chartPopup) { // Check if click was on the background overlay
        hideChart();
    }
});

// --- Initial Display & Firebase Listener ---
// Perform initial display from localStorage *before* Firebase listener attaches
const initiallyDisplayedStates = displayItems(null);
if (Object.keys(itemStates).length === 0) { // Only update if itemStates was empty
    itemStates = initiallyDisplayedStates;
}

// Listen for Firebase changes
itemsRef.on('value', (snapshot) => {
    const currentFirebaseData = snapshot.val();
    console.log("Firebase data received:", currentFirebaseData);

    // Update display, calculate next states, AND update history if prices changed
    const latestStates = displayItems(currentFirebaseData);

    // Update in-memory states & save them
    itemStates = latestStates;
    saveStates(); // Save the latest price/change states

    // Note: History is now saved inside displayItems when changes occur
});

console.log("Script loaded. Initial states:", itemStates);
// console.log("Initial history:", itemHistory); // Can be very verbose
