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
if (firebaseConfig.apiKey.startsWith("AIza") && firebaseConfig.apiKey.includes("replace")) {
    alert("Please replace the placeholder Firebase configuration in script.js with your actual project config!");
    console.error("Firebase config not set in script.js");
} else {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const itemsRef = database.ref('items');

// --- DOM Elements ---
const tableBody = document.getElementById('items-table-body');
const chartPopup = document.getElementById('chart-popup');
const chartTitle = document.getElementById('chart-title');
const closeChartBtn = document.getElementById('close-chart-btn');
const chartCanvasElement = document.getElementById('item-price-chart');
const chartNoDataMsg = document.getElementById('chart-no-data');
let chartCtx = null; // Initialize context later
if (chartCanvasElement) {
    chartCtx = chartCanvasElement.getContext('2d');
} else {
    console.error("Chart canvas element not found!");
}


// --- State Management ---
const stateStorageKey = 'gameItemPriceStates_v1'; // Renamed to avoid conflicts if structure changed
const historyStorageKey = 'gameItemPriceHistory_v3'; // Renamed for potential structure changes
let itemStates = {}; // Holds { price, change, changePercent, changeClass, changePrefix }
let itemHistory = {}; // Holds { itemName: [{ts: timestamp, price: number}] }
let itemChartInstance = null; // Holds the Chart.js instance

// --- Load Initial State & History ---
function loadInitialData() {
    const storedStatesString = localStorage.getItem(stateStorageKey);
    if (storedStatesString) {
        try {
            itemStates = JSON.parse(storedStatesString);
            console.log("Loaded states:", Object.keys(itemStates).length, "items");
        } catch (e) { console.error("Error parsing stored states:", e); localStorage.removeItem(stateStorageKey); itemStates = {}; }
    }

    const storedHistoryString = localStorage.getItem(historyStorageKey);
    if (storedHistoryString) {
        try {
            itemHistory = JSON.parse(storedHistoryString);
            console.log("Loaded history for", Object.keys(itemHistory).length, "items");
            // Optional: Prune history on load to clean up very old data
            pruneAllHistory();
        } catch (e) { console.error("Error parsing stored history:", e); localStorage.removeItem(historyStorageKey); itemHistory = {};}
    }
}

// --- History Management ---
const HISTORY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function addHistoryPoint(itemName, price) {
    if (typeof price !== 'number') return;
    const now = Date.now();
    if (!itemHistory[itemName]) {
        itemHistory[itemName] = [];
    }
    // Avoid adding duplicate points with the exact same timestamp (can happen with rapid updates)
    const lastPoint = itemHistory[itemName][itemHistory[itemName].length - 1];
    if (lastPoint && lastPoint.ts === now && lastPoint.price === price) {
        return; // Skip duplicate
    }

    itemHistory[itemName].push({ ts: now, price: price });
    // Pruning happens here too
    const cutoffTime = now - HISTORY_DURATION_MS;
    itemHistory[itemName] = itemHistory[itemName].filter(point => point.ts >= cutoffTime);
}

function pruneAllHistory() {
    const now = Date.now();
    const cutoffTime = now - HISTORY_DURATION_MS;
    let changed = false;
    for (const itemName in itemHistory) {
        const originalLength = itemHistory[itemName].length;
        itemHistory[itemName] = itemHistory[itemName].filter(point => point.ts >= cutoffTime);
        if (itemHistory[itemName].length !== originalLength) {
            changed = true;
        }
        // Remove item from history if it has no points left
        if (itemHistory[itemName].length === 0) {
            delete itemHistory[itemName];
            changed = true;
        }
    }
    if (changed) {
        console.log("Pruned old history entries.");
        saveHistory(); // Save if pruning occurred
    }
}

function saveHistory() {
    try {
        if (Object.keys(itemHistory).length > 0) {
            localStorage.setItem(historyStorageKey, JSON.stringify(itemHistory));
        } else {
            localStorage.removeItem(historyStorageKey); // Clean up if empty
        }
    } catch (e) { console.error("Error saving history:", e); }
}

function saveStates() {
     try {
        if (Object.keys(itemStates).length > 0) {
             localStorage.setItem(stateStorageKey, JSON.stringify(itemStates));
             // console.log("Saved latest item states"); // Reduce console noise
        } else {
             localStorage.removeItem(stateStorageKey);
             console.log("Item states empty, removed from localStorage.");
        }
     } catch (e) { console.error("Error saving states:", e); }
}

// --- Formatting ---
function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
}

// --- Sparkline Drawing Function ---
function drawSparkline(canvas, historyData) {
    if (!canvas || !historyData || historyData.length < 2) {
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    let minPrice = historyData[0].price, maxPrice = historyData[0].price;
    let minTs = historyData[0].ts, maxTs = historyData[0].ts;

    for (let i = 1; i < historyData.length; i++) {
        const point = historyData[i];
        if (point.price < minPrice) minPrice = point.price;
        if (point.price > maxPrice) maxPrice = point.price;
        if (point.ts < minTs) minTs = point.ts; // Should be sorted but check
        if (point.ts > maxTs) maxTs = point.ts;
    }

    const priceRange = maxPrice - minPrice;
    const timeRange = maxTs - minTs;

    const startPrice = historyData[0].price;
    const endPrice = historyData[historyData.length - 1].price;
    ctx.strokeStyle = (endPrice > startPrice) ? '#50c878' : '#f08080';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    const paddingX = 1, paddingY = 1;

    for (let i = 0; i < historyData.length; i++) {
        const point = historyData[i];
        let x = paddingX;
        if (timeRange > 0) x = paddingX + ((point.ts - minTs) / timeRange) * (width - 2 * paddingX);
        else x = width / 2;

        let y = height / 2;
        if (priceRange > 0) y = (height - paddingY) - ((point.price - minPrice) / priceRange) * (height - 2 * paddingY);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}


// --- Charting ---
function showChart(itemName) {
    console.log(`Showing chart for: ${itemName}`);
    const history = itemHistory[itemName] || [];
    const now = Date.now();
    const cutoffTime = now - HISTORY_DURATION_MS;
    const chartData = history.filter(point => point.ts >= cutoffTime);

    if (itemChartInstance) itemChartInstance.destroy(); // Destroy previous chart
    chartNoDataMsg.style.display = 'none'; // Hide message by default

    // Prepare chart data points
    let chartPoints = [];
    if (chartData.length === 0) {
        console.log("No history points found for the last 24h.");
        chartNoDataMsg.style.display = 'block'; // Show message
    } else if (chartData.length === 1) {
        // Duplicate point slightly earlier for Chart.js to draw *something*
        chartPoints = [
            { x: chartData[0].ts - 1000, y: chartData[0].price },
            { x: chartData[0].ts, y: chartData[0].price }
        ];
    } else {
        chartPoints = chartData.map(point => ({ x: point.ts, y: point.price }));
    }

    chartTitle.textContent = `${itemName} History (Last 24h)`;

    if (chartPoints.length > 0 && chartCtx) { // Only create chart if there's data AND context exists
        itemChartInstance = new Chart(chartCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Price',
                    data: chartPoints,
                    borderColor: 'rgb(75, 192, 192)', tension: 0.1,
                    pointBackgroundColor: 'rgb(75, 192, 192)', pointRadius: 3,
                    pointHoverRadius: 5 // Make points bigger on hover
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time', time: { unit: 'hour', tooltipFormat: 'PPpp', displayFormats: { hour: 'HH:mm' } },
                        title: { display: true, text: 'Time', color: '#ccc' }, grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#ccc'} // X-axis labels color
                    },
                    y: {
                        beginAtZero: false, title: { display: true, text: 'Price', color: '#ccc'},
                        ticks: { callback: (v) => formatNumber(v), color: '#ccc' }, // Y-axis labels color
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#ccc' } }, // Legend text color
                    tooltip: {
                        callbacks: { label: (c) => `${c.dataset.label || ''}: ${formatNumber(c.parsed.y)}` },
                         bodyFont: { size: 14 }, // Tooltip font size
                         titleFont: { size: 16 }
                    }
                },
                 interaction: { // Improve hover interaction
                    mode: 'index',
                    intersect: false,
                 },
            }
        });
    } else if (chartCtx) {
         // Clear canvas if no data but context exists
         chartCtx.clearRect(0, 0, chartCtx.canvas.width, chartCtx.canvas.height);
    }

    chartPopup.style.display = 'flex'; // Show the popup
}

function hideChart() {
    if (itemChartInstance) { itemChartInstance.destroy(); itemChartInstance = null; }
    chartPopup.style.display = 'none';
    document.querySelectorAll('#items-table tbody tr.selected-row').forEach(r => r.classList.remove('selected-row'));
}


// --- Display Logic ---
function displayItems(currentFirebaseData) {
    const isInitialLoad = currentFirebaseData === null;
    tableBody.innerHTML = '';
    const dataToShow = isInitialLoad ? {} : (currentFirebaseData || {});

    let newItemStates = {};
    const previousItemKeys = Object.keys(itemStates);
    const currentItemKeys = Object.keys(dataToShow);
    const allItemKeys = new Set([...previousItemKeys, ...currentItemKeys]);
    const sortedKeys = Array.from(allItemKeys).sort();

    if (sortedKeys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Loading or no items found...</td></tr>';
        return {}; // Return empty state
    }

    let historyNeedsUpdate = false;

    sortedKeys.forEach(itemName => {
        const currentPrice = dataToShow[itemName];
        const previousState = itemStates[itemName];
        let stateToRender = {};
        let priceChanged = false;

        if (isInitialLoad) {
            // Use stored state for initial display
            stateToRender = previousState || { price: 'N/A', change: 'N/A', changePercent: 'N/A', changeClass: 'no-change', changePrefix: '' };
        } else {
            // Calculate new state based on Firebase update
            let calculatedState = { price: 'N/A', change: 'N/A', changePercent: 'N/A', changeClass: 'no-change', changePrefix: '' };

            if (currentPrice !== undefined) {
                calculatedState.price = currentPrice;
                if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number') {
                     if (previousState.price !== currentPrice) priceChanged = true; // Price definitely changed
                     const priceDiff = currentPrice - previousState.price;
                     calculatedState.change = priceDiff;
                     if (previousState.price !== 0) calculatedState.changePercent = (priceDiff / previousState.price) * 100;
                     else if (currentPrice > 0) calculatedState.changePercent = Infinity;
                     else calculatedState.changePercent = 0;

                     if (priceDiff > 0) { calculatedState.changeClass = 'positive-change'; calculatedState.changePrefix = '+'; }
                     else if (priceDiff < 0) { calculatedState.changeClass = 'negative-change'; }
                     else { calculatedState.change = 0; calculatedState.changePercent = 0; } // Explicitly zero
                } else if (typeof currentPrice === 'number') {
                     priceChanged = true; // New item added counts as change for history
                     calculatedState.change = 'N/A'; calculatedState.changePercent = 'N/A';
                }

                if (priceChanged) {
                    addHistoryPoint(itemName, currentPrice);
                    historyNeedsUpdate = true;
                }
                stateToRender = calculatedState;
            } else if (previousState) {
                // Item was deleted
                return; // Don't render row, exclude from newItemStates
            } else {
                return; // Skip if doesn't exist now or before
            }
        }

        // --- Prepare display values ---
        const displayPrice = typeof stateToRender.price === 'number' ? formatNumber(stateToRender.price) : 'N/A';
        let displayChange = 'N/A', displayChangePercent = 'N/A';
        const displayChangeClass = stateToRender.changeClass || 'no-change';
        const displayChangePrefix = stateToRender.changePrefix || '';

        if (typeof stateToRender.change === 'number') displayChange = formatNumber(stateToRender.change.toFixed(0));
        if (typeof stateToRender.changePercent === 'number') {
            displayChangePercent = (stateToRender.changePercent === Infinity) ? "∞%" : `${stateToRender.changePercent.toFixed(2)}%`;
        }

        // --- Create Row & Sparkline ---
        if (stateToRender.price !== undefined) {
            const itemRow = document.createElement('tr');
            itemRow.setAttribute('data-item-name', itemName);
            const sparklineCanvasId = `spark-${itemName.replace(/[^a-zA-Z0-9_\-]/g, '')}`; // Even safer ID

            itemRow.innerHTML = `
                <td>${itemName}</td>
                <td><canvas id="${sparklineCanvasId}" class="sparkline-canvas" width="100" height="30"></canvas></td>
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

            // Draw sparkline *after* appending row
            const sparkCanvas = document.getElementById(sparklineCanvasId);
            if (sparkCanvas) {
                 const history = itemHistory[itemName] || [];
                 const now = Date.now();
                 const cutoffTime = now - HISTORY_DURATION_MS;
                 const sparkHistoryData = history.filter(point => point.ts >= cutoffTime);
                 drawSparkline(sparkCanvas, sparkHistoryData);
            }

            // Add to state for saving
            newItemStates[itemName] = stateToRender;
        }
    }); // End forEach

    if (historyNeedsUpdate && !isInitialLoad) {
        saveHistory();
    }
    return newItemStates; // Return the states that were actually rendered/calculated
}

// --- Event Listeners ---
closeChartBtn.addEventListener('click', hideChart);
chartPopup.addEventListener('click', (e) => { if (e.target === chartPopup) hideChart(); });

// --- Initial Load & Firebase Listener ---
loadInitialData(); // Load state & history from localStorage

console.log("Performing initial display from loaded data");
// Initial render uses loaded state, returns the state map used for this render
itemStates = displayItems(null);
console.log("Initial itemStates used for render:", Object.keys(itemStates).length, "items");
// No need to save state here, it was just loaded

// Attach Firebase listener *after* initial render
itemsRef.on('value', (snapshot) => {
    const currentFirebaseData = snapshot.val();
    // console.log("Firebase data received:", currentFirebaseData); // Reduce console noise

    // Calculate latest state based on FB data + previous state, render, update history
    const latestStates = displayItems(currentFirebaseData);

    // Update in-memory state and save it for next load
    itemStates = latestStates;
    saveStates();

    // console.log("In-memory states updated/saved:", Object.keys(itemStates).length, "items"); // Reduce noise
}, (error) => {
    // Optional: Add error handling for Firebase connection
    console.error("Firebase Realtime Database read failed:", error);
    // You could display an error message on the page here
    tableBody.innerHTML = '<tr><td colspan="5" style="color: red; text-align: center;">Error connecting to database. Please check console.</td></tr>';
});

console.log("Script loaded. Firebase listener attached.");
