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
const visitsTodayDisplay = document.getElementById('visits-today-display');
const liveVisitorsDisplay = document.getElementById('live-visitors-display');
const liveClock = document.getElementById('live-clock');

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPassword();
    });
});

function checkPassword() {
    if (passwordInput.value === correctPassword) {
        passwordPrompt.classList.add('hidden');
        dashboard.classList.remove('hidden');
        startDashboard();
    } else {
        errorMessage.classList.remove('hidden');
    }
}

function startDashboard() {
    updateClock();
    setInterval(updateClock, 1000);
    listenForUpdates();
}

function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
}

function listenForUpdates() {
    // Listener for Total Generations
    const generationsRef = doc(db, "stats", "imageGenerations");
    onSnapshot(generationsRef, (doc) => {
        liveCountDisplay.classList.remove('shimmer');
        liveCountDisplay.textContent = doc.exists() ? doc.data().count.toLocaleString() : "0";
    });

    // Listener for Today's Visits
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const visitsRef = doc(db, "stats", `visits_${today}`);
    onSnapshot(visitsRef, (doc) => {
        visitsTodayDisplay.classList.remove('shimmer');
        const visits = doc.exists() ? doc.data().count : 0;
        visitsTodayDisplay.textContent = visits.toLocaleString();
        
        // Update simulated live visitors based on today's total visits
        updateSimulatedLiveVisitors(visits);
    });
}

function updateSimulatedLiveVisitors(totalVisits) {
    liveVisitorsDisplay.classList.remove('shimmer');
    // Simulate a number that's a fraction of total visits, with some randomness
    const base = Math.max(1, Math.floor(totalVisits / 10));
    const randomFactor = Math.floor(Math.random() * (base / 2 + 3));
    const liveCount = base + randomFactor;
    liveVisitorsDisplay.textContent = liveCount.toLocaleString();

    // Update the simulated count every few seconds
    setInterval(() => {
        const fluctuation = Math.floor(Math.random() * 5) - 2; // between -2 and 2
        const currentCount = parseInt(liveVisitorsDisplay.textContent.replace(/,/g, '')) || liveCount;
        const newCount = Math.max(0, currentCount + fluctuation);
        liveVisitorsDisplay.textContent = newCount.toLocaleString();
    }, 3000 + Math.random() * 2000);
}
