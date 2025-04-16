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
const itemsRef = database.ref('items');
const tableBody = document.getElementById('items-table-body');

// --- State Management with localStorage ---
const storageKey = 'gameItemPriceStates'; // Changed key name

// Structure stored per item: { price: number, change: number|'N/A', changePercent: number|'N/A', changeClass: string }
let itemStates = {};
const storedStatesString = localStorage.getItem(storageKey);
if (storedStatesString) {
    try {
        itemStates = JSON.parse(storedStatesString);
        console.log("Loaded initial item states from localStorage:", itemStates);
    } catch (e) {
        console.error("Error parsing stored states:", e);
        localStorage.removeItem(storageKey);
        itemStates = {};
    }
}
// --- End State Management ---

function formatNumber(num) {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
}

// Function to display items - uses and updates the global `itemStates`
function displayItems(currentFirebaseData) {
    tableBody.innerHTML = ''; // Clear the current table body
    currentFirebaseData = currentFirebaseData || {};

    let newItemStates = {}; // Build the next state to be saved

    const allItemKeys = new Set([...Object.keys(currentFirebaseData), ...Object.keys(itemStates)]);
    const sortedKeys = Array.from(allItemKeys).sort();

     // Show loading only if there's absolutely nothing initially
     if (sortedKeys.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="4">Loading or no items found...</td></tr>';
         return {}; // No states to save yet
     }


    sortedKeys.forEach(itemName => {
        const currentPrice = currentFirebaseData[itemName]; // Price from Firebase RIGHT NOW
        const previousState = itemStates[itemName]; // State from LAST update (loaded or from previous run)

        // Default values for the new state of this item
        let newState = {
            price: 'N/A',
            change: 'N/A',
            changePercent: 'N/A',
            changeClass: 'no-change',
            changePrefix: '' // Store prefix for consistency
        };

        if (currentPrice !== undefined) {
            // Item exists in Firebase data
            newState.price = currentPrice; // The definite current price

            // Calculate change based on previous *price* if available
            if (previousState && typeof previousState.price === 'number' && typeof currentPrice === 'number') {
                const priceDiff = currentPrice - previousState.price;
                newState.change = priceDiff; // Store the raw change number

                if (previousState.price !== 0) {
                    newState.changePercent = (priceDiff / previousState.price) * 100;
                } else if (currentPrice > 0) {
                     newState.changePercent = Infinity;
                } else {
                     newState.changePercent = 0; // 0 -> 0 change
                }


                // Determine class and prefix based on calculated change
                if (priceDiff > 0) {
                    newState.changeClass = 'positive-change';
                    newState.changePrefix = '+';
                } else if (priceDiff < 0) {
                    newState.changeClass = 'negative-change';
                     // negative sign is automatic for the number
                } else {
                    newState.changeClass = 'no-change';
                    newState.changePercent = 0; // Ensure 0% if change is 0
                    newState.change = 0; // Ensure 0 if change is 0
                }

            } else if (typeof currentPrice === 'number') {
                 // It's a new item or previous price wasn't a number, no change calculable yet
                 newState.change = 'N/A';
                 newState.changePercent = 'N/A';
                 newState.changeClass = 'no-change';
            }

        } else if (previousState) {
            // Item existed before but is NOT in current Firebase data (deleted)
             console.log(`Item "${itemName}" appears deleted.`);
            // Do not add to newItemStates, effectively removing it.
             // Also do not add a row to the table.
            return; // Skip to next item in forEach

        } else {
            // Item doesn't exist now and didn't exist before (shouldn't happen with Set logic)
            return; // Skip
        }

        // --- Prepare display values from the newState ---
        const displayPrice = typeof newState.price === 'number' ? formatNumber(newState.price) : 'N/A';

        let displayChange = 'N/A';
        if (typeof newState.change === 'number') {
            displayChange = formatNumber(newState.change.toFixed(0));
        }

        let displayChangePercent = 'N/A';
        if (typeof newState.changePercent === 'number') {
            if (newState.changePercent === Infinity) {
                displayChangePercent = "∞%";
            } else {
                displayChangePercent = `${newState.changePercent.toFixed(2)}%`;
            }
        }


        // --- Create and append table row ---
        const itemRow = document.createElement('tr');
        itemRow.innerHTML = `
            <td>${itemName}</td>
            <td>${displayPrice}</td>
            <td class="${newState.changeClass}">${newState.changePrefix}${displayChange}</td>
            <td class="${newState.changeClass}">${newState.changePrefix}${displayChangePercent}</td>
        `;
        tableBody.appendChild(itemRow);

        // Add this calculated state to our map of current states
        newItemStates[itemName] = newState;
    });

    // Return the complete map of states from this update cycle
    return newItemStates;
}


// --- Initial Display on Load ---
// Display using initially loaded states before Firebase connects
// This shows the *persisted* change values immediately
console.log("Performing initial display from loaded/empty itemStates");
const initiallyDisplayedStates = displayItems(null); // Pass null to signify no *new* Firebase data yet
// Update itemStates immediately ONLY if it was empty initially, otherwise keep loaded state
// This prevents overwriting loaded state with N/As if Firebase is slow
if (Object.keys(itemStates).length === 0) {
    itemStates = initiallyDisplayedStates;
}
// --- End Initial Display ---


// Listen for Firebase changes
itemsRef.on('value', (snapshot) => {
    const currentFirebaseData = snapshot.val();
    console.log("Firebase data received:", currentFirebaseData);
    console.log("Calculating changes based on current itemStates:", itemStates);

    // Update display & calculate next states based on new Firebase data and previous states
    const latestStates = displayItems(currentFirebaseData);

    // Update the in-memory state for the next Firebase update *within this session*
    itemStates = latestStates;
    console.log("In-memory itemStates updated to:", itemStates);

    // Save the LATEST complete states (including calculated changes) to localStorage
    try {
        if (Object.keys(latestStates).length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(latestStates));
            console.log("Saved latest item states to localStorage:", latestStates);
        } else {
            localStorage.removeItem(storageKey);
            console.log("Latest data resulted in empty states, cleared localStorage.");
        }
    } catch (e) {
        console.error("Error saving states to localStorage:", e);
    }
});

console.log("Script loaded. Initial itemStates:", itemStates);
