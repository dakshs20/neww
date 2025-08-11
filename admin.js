// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- IMPORTANT: SET YOUR PASSWORD HERE ---
const correctPassword = "admin"; // Change this to your secret password

// Firebase configuration (should match your main site's config)
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const passwordPrompt = document.getElementById('password-prompt');
const passwordInput = document.getElementById('password-input');
const passwordSubmit = document.getElementById('password-submit');
const errorMessage = document.getElementById('error-message');
const dashboard = document.getElementById('dashboard');
const liveCountDisplay = document.getElementById('live-count-display');

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if password is correct on button click
    passwordSubmit.addEventListener('click', checkPassword);
    // Also check on Enter key press
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
});

function checkPassword() {
    if (passwordInput.value === correctPassword) {
        // Correct password: hide prompt, show dashboard, and start listening
        passwordPrompt.classList.add('hidden');
        dashboard.classList.remove('hidden');
        listenForUpdates();
    } else {
        // Incorrect password: show error message
        errorMessage.classList.remove('hidden');
    }
}

function listenForUpdates() {
    const counterRef = doc(db, "stats", "imageGenerations");
    
    onSnapshot(counterRef, (doc) => {
        liveCountDisplay.classList.remove('shimmer'); // Remove shimmer on first load
        if (doc.exists()) {
            const count = doc.data().count;
            // Format with commas for readability
            liveCountDisplay.textContent = count.toLocaleString();
        } else {
            liveCountDisplay.textContent = "0";
        }
    });
}
