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

// Get a reference to the HTML element where we will display items
const itemsListDiv = document.getElementById('items-list');

// Function to display items on the page
function displayItems(items) {
    itemsListDiv.innerHTML = ''; // Clear the current list

    if (!items) {
        itemsListDiv.innerHTML = 'No items found.';
        return;
    }

    // Loop through each item and create HTML to display it
    Object.keys(items).forEach(itemName => {
        const item = items[itemName];
        const price = item.price !== undefined ? item.price : 'N/A'; // Handle items without a price

        const itemElement = document.createElement('div');
        itemElement.classList.add('item'); // Add a CSS class for styling

        itemElement.innerHTML = `
            <span class="item-name">${itemName}:</span>
            <span class="item-price">${price}</span>
        `;

        itemsListDiv.appendChild(itemElement);
    });
}

// Listen for changes in the 'items' data
itemsRef.on('value', (snapshot) => {
    const data = snapshot.val(); // Get the data from Firebase
    console.log("Data received from Firebase:", data); // For debugging
    displayItems(data); // Update the website display
});

console.log("Script loaded. Waiting for Firebase data...");