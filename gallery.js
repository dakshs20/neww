// --- Imports ---
// Note: We are importing more from Firestore to handle querying and ordering.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Initialization (using the same config as script.js) ---
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

const app = initializeApp(firebaseConfig, "galleryApp"); // Use a unique name to avoid conflicts
const db = getFirestore(app);

// --- Main Gallery Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Only run this script on the gallery page
    if (document.getElementById('gallery-container')) {
        loadGalleryImages();
    }
});

/**
 * Fetches image data from Firestore and populates the gallery.
 */
async function loadGalleryImages() {
    const grid = document.getElementById('gallery-grid');
    const loadingEl = document.getElementById('gallery-loading');
    const emptyEl = document.getElementById('gallery-empty');

    if (!grid || !loadingEl || !emptyEl) return;

    try {
        // Create a query to get documents from the 'galleryImages' collection
        // Order them by the 'createdAt' field in descending order (newest first)
        // Limit to the latest 50 images for performance
        const q = query(collection(db, "galleryImages"), orderBy("createdAt", "desc"), limit(50));
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            emptyEl.classList.remove('hidden');
        } else {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const galleryItem = createGalleryItem(data.imageUrl, data.prompt);
                grid.appendChild(galleryItem);
            });
        }
    } catch (error) {
        console.error("Error loading gallery images:", error);
        emptyEl.textContent = "Could not load gallery. Please try again later.";
        emptyEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
}

/**
 * Creates the HTML element for a single gallery item.
 * @param {string} imageUrl - The URL of the image.
 * @param {string} prompt - The prompt used to generate the image.
 * @returns {HTMLElement} The created gallery item element.
 */
function createGalleryItem(imageUrl, prompt) {
    const item = document.createElement('div');
    item.className = 'masonry-item group';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-cover rounded-lg block';
    // Add an error handler for broken images
    img.onerror = () => {
        item.style.display = 'none'; // Hide the item if the image fails to load
    };

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-end p-4';

    const promptText = document.createElement('p');
    promptText.className = 'text-white text-sm line-clamp-3';
    promptText.textContent = prompt;

    overlay.appendChild(promptText);
    item.appendChild(img);
    item.appendChild(overlay);

    return item;
}
