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
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Get a reference to the 'items' data in Firebase
const itemsRef = database.ref('items');

// Get a reference to the HTML table body element
const tableBody = document.getElementById('items-table-body');

// --- State Management with localStorage ---
// Key for storing data in localStorage
const storageKey = 'gameItemPreviousPrices';

// Initialize previousPrices: Try loading from localStorage first
let previousPrices = {};
const storedPricesString = localStorage.getItem(storageKey);
if (storedPricesString) {
    try {
        previousPrices = JSON.parse(storedPricesString);
        console.log("Loaded initial previous prices from localStorage:", previousPrices);
    } catch (e) {
        console.error("Error parsing stored prices:", e);
        // If parsing fails, clear the invalid data and start fresh
        localStorage.removeItem(storageKey);
        previousPrices = {};
    }
}
// --- End State Management ---


// Function to format numbers (optional, but nice)
function formatNumber(num) {
    if (typeof num !== 'number') return num; // Return as is if not a number
    return num.toLocaleString(); // Adds commas, e.g., 1000 -> 1,000
}

// Function to display items in the table
// NOW USES THE GLOBAL `previousPrices` for calculation
function displayItems(currentData) {
    tableBody.innerHTML = ''; // Clear the current table body

    // Ensure currentData is an object, even if Firebase returns null
    currentData = currentData || {};

    if (Object.keys(currentData).length === 0 && Object.keys(previousPrices).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No items found.</td></tr>';
        return {}; // Return empty object as there are no new prices to track
    }

    let nextPreviousPrices = {}; // Will hold the prices from *this* update

    // Combine keys from both current and previous data to handle deleted items
    const allItemKeys = new Set([...Object.keys(currentData), ...Object.keys(previousPrices)]);

    // Sort keys alphabetically
    const sortedKeys = Array.from(allItemKeys).sort();

    sortedKeys.forEach(itemName => {
        const currentPrice = currentData[itemName]; // Might be undefined if item deleted
        const previousPrice = previousPrices[itemName]; // Might be undefined if item is new

        // Only proceed if the item existed before or exists now
        if (currentPrice === undefined && previousPrice === undefined) {
            return; // Skip if item doesn't exist in either dataset (shouldn't happen with Set logic)
        }

        let change = 'N/A';
        let changePercent = 'N/A';
        let changeClass = 'no-change';
        let displayChange = 'N/A';
        let displayChangePercent = 'N/A';
        let changePrefix = '';

        // Calculate change ONLY if both current and previous prices are valid numbers
        if (typeof currentPrice === 'number' && typeof previousPrice === 'number') {
            change = currentPrice - previousPrice;
            if (previousPrice !== 0) {
                changePercent = (change / previousPrice) * 100;
            } else if (currentPrice > 0) {
                 changePercent = Infinity; // Handle division by zero if price went from 0 to non-zero
            } else {
                 changePercent = 0; // Price stayed at 0
            }


            // Determine color class based on change
            if (change > 0) {
                changeClass = 'positive-change';
                changePrefix = '+';
            } else if (change < 0) {
                changeClass = 'negative-change';
                // Negative sign is automatic
            }

             // Format for display
             displayChange = formatNumber(change.toFixed(0));
             if (changePercent === Infinity) {
                displayChangePercent = "∞%"; // Or use a large number like ">999%"
             } else {
                displayChangePercent = `${changePercent.toFixed(2)}%`;
             }


        } else if (typeof currentPrice === 'number' && previousPrice === undefined) {
            // Item is new, show price but N/A for change
            displayChange = 'N/A';
            displayChangePercent = 'N/A';
        } else if (currentPrice === undefined && typeof previousPrice === 'number') {
             // Item was deleted, display previous price? Or 'Deleted'? Let's indicate deletion.
             // We'll actually skip adding the row later if currentPrice is undefined.
        } else {
             // Handle cases where price becomes non-numeric or was non-numeric
             displayChange = 'N/A';
             displayChangePercent = 'N/A';
        }


        // Format current price for display
        const displayPrice = typeof currentPrice === 'number' ? formatNumber(currentPrice) : (currentPrice === undefined ? ' (Deleted)' : 'N/A');

        // Only add row if the item currently exists
         if (currentPrice !== undefined) {
            const itemRow = document.createElement('tr');
            itemRow.innerHTML = `
                <td>${itemName}</td>
                <td>${displayPrice}</td>
                <td class="${changeClass}">${changePrefix}${displayChange}</td>
                <td class="${changeClass}">${changePrefix}${displayChangePercent}</td>
            `;
            tableBody.appendChild(itemRow);

             // Store the current price for the next update cycle / localStorage save
             nextPreviousPrices[itemName] = currentPrice;
         } else {
             // Item was deleted, implicitly remove it from 'nextPreviousPrices'
             console.log(`Item "${itemName}" removed.`);
         }

    });

    // Return the prices from this update cycle
    return nextPreviousPrices;
}

// Listen for changes in the 'items' data
itemsRef.on('value', (snapshot) => {
    const currentData = snapshot.val(); // Get the fresh data from Firebase
    console.log("Firebase data received:", currentData);
    console.log("Calculating change against (in-memory/loaded):", previousPrices);

    // Display items and get the latest price map
    const latestPrices = displayItems(currentData);

    // Update the in-memory state for the *next* intra-session update
    previousPrices = latestPrices;
    console.log("In-memory previousPrices updated to:", previousPrices);


    // Save the LATEST state to localStorage for the next page load/refresh
    try {
        // Only save if latestPrices is not empty (avoid saving empty object if data fetch fails)
        if (Object.keys(latestPrices).length > 0) {
             localStorage.setItem(storageKey, JSON.stringify(latestPrices));
             console.log("Saved latest prices to localStorage:", latestPrices);
        } else {
             // If the latest data is empty, remove the item from storage
             localStorage.removeItem(storageKey);
             console.log("Latest data empty, removed item from localStorage.");
        }

    } catch (e) {
        console.error("Error saving prices to localStorage:", e);
    }
});

console.log("Script loaded. Initial previousPrices state:", previousPrices);

// Initial display call in case the 'on value' doesn't fire immediately (less common now)
// Optional: Consider if you need a loading state until first data arrives
// displayItems(null); // Or pass initial empty data? Might flash N/A briefly.
// The 'on value' usually fires quickly enough on initial load.
