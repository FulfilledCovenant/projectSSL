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
// --- END OF FIREBASE CONFIG ---

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Get a reference to the 'items' data in Firebase
const itemsRef = database.ref('items');

// Get a reference to the HTML table body element
const tableBody = document.getElementById('items-table-body');

// Object to store the previous prices for calculating change
let previousPrices = {};

// Function to format numbers (optional, but nice)
function formatNumber(num) {
    if (typeof num !== 'number') return num; // Return as is if not a number
    return num.toLocaleString(); // Adds commas, e.g., 1000 -> 1,000
}

// Function to display items in the table
function displayItems(currentData) {
    tableBody.innerHTML = ''; // Clear the current table body

    if (!currentData || Object.keys(currentData).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No items found.</td></tr>';
        previousPrices = {}; // Clear previous prices if no current data
        return;
    }

    let nextPreviousPrices = {}; // Store prices from THIS update for the NEXT update cycle

    // Loop through each item and create a table row
    Object.keys(currentData).sort().forEach(itemName => { // Sort alphabetically
        const currentPrice = currentData[itemName];
        const previousPrice = previousPrices[itemName]; // Get price from last update

        let change = 0;
        let changePercent = 0;
        let changeClass = 'no-change'; // Default class

        // Calculate change and percentage IF there was a previous price
        if (previousPrice !== undefined && typeof currentPrice === 'number' && typeof previousPrice === 'number') {
            change = currentPrice - previousPrice;
            if (previousPrice !== 0) {
                changePercent = (change / previousPrice) * 100;
            }

            // Determine color class based on change
            if (change > 0) {
                changeClass = 'positive-change';
            } else if (change < 0) {
                changeClass = 'negative-change';
            }
        }

        // Create a new table row element
        const itemRow = document.createElement('tr');

        // Format values for display
        const displayPrice = typeof currentPrice === 'number' ? formatNumber(currentPrice) : 'N/A';
        const displayChange = change !== 0 ? formatNumber(change.toFixed(0)) : (previousPrice !== undefined ? '0' : 'N/A'); // Show N/A only on first load
        const displayChangePercent = changePercent !== 0 ? `${changePercent.toFixed(2)}%` : (previousPrice !== undefined ? '0.00%' : 'N/A'); // Show N/A only on first load
        const changePrefix = change > 0 ? '+' : ''; // Add '+' sign for positive changes


        // Set the inner HTML of the row with table data cells (<td>)
        itemRow.innerHTML = `
            <td>${itemName}</td>
            <td>${displayPrice}</td>
            <td class="${changeClass}">${changePrefix}${displayChange}</td>
            <td class="${changeClass}">${changePrefix}${displayChangePercent}</td>
        `;

        // Append the row to the table body
        tableBody.appendChild(itemRow);

        // Store the current price for the next update cycle
        nextPreviousPrices[itemName] = currentPrice;
    });

    // Update the global previousPrices object for the next time data changes
    previousPrices = nextPreviousPrices;
}

// Listen for changes in the 'items' data
itemsRef.on('value', (snapshot) => {
    const data = snapshot.val(); // Get the data from Firebase
    console.log("Data received:", data); // For debugging
    console.log("Previous prices:", previousPrices); // For debugging change calculation
    displayItems(data); // Update the website display
});

console.log("Script loaded. Waiting for Firebase data...");
