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
const stateStorageKey = 'gameItemPriceStates';
const historyStorageKey = 'gameItemPriceHistory_v2';
let itemStates = {}; // Holds { price, change, changePercent, changeClass, changePrefix }
let itemHistory = {}; // Holds { itemName: [{ts: timestamp, price: number}] }
let itemChart = null;

// --- Load Initial State & History ---
function loadInitialData() {
    const storedStatesString = localStorage.getItem(stateStorageKey);
    if (storedStatesString) {
        try {
            itemStates = JSON.parse(storedStatesString);
            console.log("Loaded states:", itemStates);
        } catch (e) { console.error("Error parsing stored states:", e); localStorage.removeItem(stateStorageKey); itemStates = {}; }
    }

    const storedHistoryString = localStorage.getItem(historyStorageKey);
    if (storedHistoryString) {
        try {
            itemHistory = JSON.parse(storedHistoryString);
            console.log("Loaded history");
        } catch (e) { console.error("Error parsing stored history:", e); localStorage.removeItem(historyStorageKey); itemHistory = {};}
    }
}
loadInitialData();

// --- History Management ---
const HISTORY_DURATION_MS = 24 * 60 * 60 * 1000;

function addHistoryPoint(itemName, price) {
    if (typeof price !== 'number') return;
    const now = Date.now();
    if (!itemHistory[itemName]) {
        itemHistory[itemName] = [];
    }
    itemHistory[itemName].push({ ts: now, price: price });
    const cutoffTime = now - HISTORY_DURATION_MS;
    itemHistory[itemName] = itemHistory[itemName].filter(point => point.ts >= cutoffTime);
}

function saveHistory() {
    try {
        localStorage.setItem(historyStorageKey, JSON.stringify(itemHistory));
    } catch (e) { console.error("Error saving history:", e); }
}

function saveStates() {
     try {
        // Ensure we don't save if itemStates is empty after initial load failure or data removal
        if (Object.keys(itemStates).length > 0) {
             localStorage.setItem(stateStorageKey, JSON.stringify(itemStates));
             console.log("Saved latest item states to localStorage");
        } else {
             localStorage.removeItem(stateStorageKey); // Clear storage if state is empty
             console.log("Item states empty, removed from localStorage.");
        }
     } catch (e) { console.error("Error saving states:", e); }
}

// --- Formatting ---
function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
}

// --- Charting ---
// (showChart and hideChart functions remain the same as the previous version)
function showChart(itemName) {
    console.log(`Showing chart for: ${itemName}`);
    const history = itemHistory[itemName] || [];
    const now = Date.now();
    const cutoffTime = now - HISTORY_DURATION_MS;
    const chartData = history.filter(point => point.ts >= cutoffTime);

    if (itemChart) itemChart.destroy();
    chartNoDataMsg.style.display = 'none'; // Assume data exists initially

    if (chartData.length === 0) {
         console.log("No history points found for the last 24h.");
         chartNoDataMsg.style.display = 'block';
         // Still show popup to display the message
    } else if (chartData.length === 1) {
        // Duplicate the single point slightly earlier for line drawing
        chartData.unshift({ ts: chartData[0].ts - 1000, price: chartData[0].price });
    }

    chartTitle.textContent = `${itemName} History (Last 24h)`;

    if (chartData.length > 0) { // Only create chart if there's data to plot
        itemChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Price',
                    data: chartData.map(point => ({ x: point.ts, y: point.price })),
                    borderColor: 'rgb(75, 192, 192)', tension: 0.1,
                    pointBackgroundColor: 'rgb(75, 192, 192)', pointRadius: 3,
                }]
            },
            options: { /* ... chart options remain the same ... */
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time', time: { unit: 'hour', tooltipFormat: 'PPpp', displayFormats: { hour: 'HH:mm' } },
                        title: { display: true, text: 'Time' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: false, title: { display: true, text: 'Price' },
                        ticks: { callback: (v) => formatNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label || ''}: ${formatNumber(c.parsed.y)}` } } }
            }
        });
    } else {
         // Clear canvas if no data and chart existed before (destroy might not be enough)
         chartCanvas.clearRect(0, 0, chartCanvas.canvas.width, chartCanvas.canvas.height);
    }


    chartPopup.style.display = 'flex';
}

function hideChart() {
    if (itemChart) { itemChart.destroy(); itemChart = null; }
    chartPopup.style.display = 'none';
    document.querySelectorAll('#items-table tbody tr.selected-row').forEach(r => r.classList.remove('selected-row'));
}


// --- Display Logic ---
function displayItems(currentFirebaseData) {
    const isInitialLoad = currentFirebaseData === null; // Flag for initial display from storage
    tableBody.innerHTML = '';
    const dataToShow = isInitialLoad ? {} : (currentFirebaseData || {}); // Use empty object if FB data is null/undefined

    let newItemStates = {};
    const previousItemKeys = Object.keys(itemStates); // Keys from loaded state
    const currentItemKeys = Object.keys(dataToShow); // Keys from Firebase
    const allItemKeys = new Set([...previousItemKeys, ...currentItemKeys]);
    const sortedKeys = Array.from(allItemKeys).sort();

    if (sortedKeys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">Loading or no items found...</td></tr>';
        return {};
    }

    let historyNeedsUpdate = false;

    sortedKeys.forEach(itemName => {
        const currentPrice = dataToShow[itemName]; // Price from Firebase (or undefined if initial load/deleted)
        const previousState = itemStates[itemName]; // State loaded from localStorage or previous cycle

        // Determine the definitive state for this item for *this* rendering cycle
        let stateToRender = {};
        let priceChanged = false;

        if (isInitialLoad) {
            // On initial load, simply use the loaded state if it exists
            stateToRender = previousState || { price: 'N/A', change: 'N/A', changePercent: 'N/A', changeClass: 'no-change', changePrefix: '' };
            // We don't calculate changes on initial load, just display stored ones
        } else {
            // This is a Firebase update
            let calculatedState = { // Start calculating the new state
                price: 'N/A', change: 'N/A', changePercent: 'N/A',
                changeClass: 'no-change', changePrefix: ''
            };

            if (currentPrice !== undefined) { // Item exists in Firebase data
                calculatedState.price = currentPrice;

                 // Check if price changed compared to last known state
                 if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number' && previousState.price !== currentPrice) {
                     priceChanged = true;
                 } else if (!previousState && typeof currentPrice === 'number') {
                     priceChanged = true; // New item added
                 }

                // Calculate change based on previous *price* if available
                if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number') {
                    const priceDiff = currentPrice - previousState.price;
                    calculatedState.change = priceDiff;
                    if (previousState.price !== 0) calculatedState.changePercent = (priceDiff / previousState.price) * 100;
                    else if (currentPrice > 0) calculatedState.changePercent = Infinity;
                    else calculatedState.changePercent = 0;

                    if (priceDiff > 0) { calculatedState.changeClass = 'positive-change'; calculatedState.changePrefix = '+'; }
                    else if (priceDiff < 0) { calculatedState.changeClass = 'negative-change'; }
                    else { calculatedState.change = 0; calculatedState.changePercent = 0; } // Ensure zero

                } else if (typeof currentPrice === 'number') {
                    // New item or previous price wasn't number, can't calculate change yet
                    calculatedState.change = 'N/A'; calculatedState.changePercent = 'N/A';
                }

                 // Add history point if the price changed
                 if (priceChanged) {
                     addHistoryPoint(itemName, currentPrice);
                     historyNeedsUpdate = true;
                 }
                stateToRender = calculatedState; // Use the newly calculated state for rendering

            } else if (previousState) {
                // Item existed before but not in Firebase now (deleted)
                return; // Don't render a row, don't include in newItemStates
            } else {
                // Item doesn't exist now or before
                return; // Skip
            }
        } // End of Firebase update logic


        // --- Prepare display values FROM stateToRender ---
        const displayPrice = typeof stateToRender.price === 'number' ? formatNumber(stateToRender.price) : 'N/A';
        let displayChange = 'N/A';
        let displayChangePercent = 'N/A'; // Default to N/A
        const displayChangeClass = stateToRender.changeClass || 'no-change';
        const displayChangePrefix = stateToRender.changePrefix || '';

        // Use the stored/calculated change values directly
        if (typeof stateToRender.change === 'number') {
            displayChange = formatNumber(stateToRender.change.toFixed(0));
        }
        if (typeof stateToRender.changePercent === 'number') {
            if (stateToRender.changePercent === Infinity) displayChangePercent = "∞%";
            else displayChangePercent = `${stateToRender.changePercent.toFixed(2)}%`;
        }


        // --- Create and append table row ---
        if (stateToRender.price !== undefined) { // Only add row if item wasn't deleted
             const itemRow = document.createElement('tr');
             itemRow.setAttribute('data-item-name', itemName);
             itemRow.innerHTML = `
                 <td>${itemName}</td>
                 <td>${displayPrice}</td>
                 <td class="${displayChangeClass}">${displayChangePrefix}${displayChange}</td>
                 <td class="${displayChangeClass}">${displayChangePrefix}${displayChangePercent}</td>
             `;
             itemRow.addEventListener('click', (e) => {
                 document.querySelectorAll('#items-table tbody tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                 e.currentTarget.classList.add('selected-row');
                 showChart(itemName);
             });
             tableBody.appendChild(itemRow);

             // Add to the state object that will be saved (important!)
             newItemStates[itemName] = stateToRender;
        }

    }); // End sortedKeys.forEach

    if (historyNeedsUpdate && !isInitialLoad) { // Only save history if updated AND not initial load
         saveHistory();
    }

    // Return the states derived from this cycle (either loaded or calculated)
    // This will become the `itemStates` for the *next* calculation/save
    return newItemStates;
}


// --- Event Listeners ---
closeChartBtn.addEventListener('click', hideChart);
chartPopup.addEventListener('click', (e) => { if (e.target === chartPopup) hideChart(); });

// --- Initial Display & Firebase Listener ---
console.log("Performing initial display from loaded itemStates");
// Call displayItems with null to use localStorage data for the first render
itemStates = displayItems(null); // Update itemStates with what was actually rendered initially
console.log("Initial itemStates used for render:", itemStates);
// No need to save here, we just loaded or started fresh


// Listen for Firebase changes
itemsRef.on('value', (snapshot) => {
    const currentFirebaseData = snapshot.val();
    console.log("Firebase data received:", currentFirebaseData);
    console.log("Calculating changes based on current itemStates:", itemStates); // Log state *before* update

    // Update display, calculate next states, and update history
    const latestStates = displayItems(currentFirebaseData);

    // Update the in-memory state *and* save it for the next refresh/load
    itemStates = latestStates; // Update global state
    saveStates(); // Save the states derived from the *latest* Firebase data

    console.log("In-memory itemStates updated and saved:", itemStates);
});

console.log("Script loaded.");
