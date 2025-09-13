// --- Firebase and Auth Initialization ---
// We import the necessary Firebase modules to interact with Firebase services.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Your web app's Firebase configuration.
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase services.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Global State & DOM Element Caching ---
// We store the current user's state globally for easy access.
let currentUser = null;
// Caching DOM elements improves performance by avoiding repeated lookups.
const DOMElements = {};

// --- Main Setup Function ---
// This runs once the entire HTML document has been loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Find and store references to all the important HTML elements.
    DOMElements.purchaseBtns = document.querySelectorAll('.purchase-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');

    // Set up a listener that continuously checks if a user is signed in or out.
    onAuthStateChanged(auth, user => {
        currentUser = user; // Update the global currentUser variable.
    });

    // Attach a click event listener to every "Buy Now" button.
    DOMElements.purchaseBtns.forEach(btn => {
        btn.addEventListener('click', (event) => {
            // If the user is not logged in, show the "Sign In" pop-up.
            if (!currentUser) {
                if (DOMElements.authModal) {
                    DOMElements.authModal.classList.remove('opacity-0', 'invisible');
                }
                return; // Stop the function here.
            }
            // If the user IS logged in, proceed to the purchase process.
            const clickedButton = event.currentTarget; // Get the specific button that was clicked.
            const plan = clickedButton.dataset.plan;
            const amount = clickedButton.dataset.amount;
            const credits = clickedButton.dataset.credits;
            handlePurchase(clickedButton, plan, amount, credits); // Start the purchase.
        });
    });

    // Add a listener to the "Cancel" button on the sign-in modal.
    DOMElements.closeModalBtn?.addEventListener('click', () => {
        if (DOMElements.authModal) {
            DOMElements.authModal.classList.add('opacity-0', 'invisible');
        }
    });

    initializeCursor(); // Set up the custom cursor effect.
});

/**
 * Handles the entire process of initiating a payment.
 * @param {HTMLButtonElement} purchaseBtn - The specific button that was clicked.
 * @param {string} plan - The name of the plan (e.g., 'Starter').
 * @param {string} amount - The cost of the plan.
 * @param {string} credits - The number of credits in the plan.
 */
async function handlePurchase(purchaseBtn, plan, amount, credits) {
    const originalText = purchaseBtn.innerHTML; // Save the button's original text.
    
    // --- FIX: Disable the specific button to prevent multiple clicks and show a loading spinner.
    purchaseBtn.disabled = true;
    purchaseBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
    `;

    try {
        // Get the user's secure authentication token from Firebase.
        const token = await currentUser.getIdToken();
        
        // Call our secure backend API to prepare the payment.
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Send the token for verification.
            },
            body: JSON.stringify({ plan, amount, credits })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initiate payment.');
        }

        const paymentData = await response.json();
        
        // The backend sends back all the data needed for PayU.
        // We create a hidden form, fill it with this data, and submit it.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentData.action; // This is the PayU payment URL.
        document.body.appendChild(form);

        for (const key in paymentData.params) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = paymentData.params[key];
            form.appendChild(input);
        }
        
        form.submit(); // This redirects the user to the PayU website to complete the payment.

    } catch (error) {
        console.error('Could not start the payment process:', error.message);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        
        // If anything goes wrong, re-enable the button and restore its text.
        purchaseBtn.disabled = false;
        purchaseBtn.innerHTML = originalText;
    }
}

/**
 * Initializes the custom cursor effect for a consistent UI.
 */
function initializeCursor() {
    if (!DOMElements.cursorDot || !DOMElements.cursorOutline) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    const animate = () => {
        DOMElements.cursorDot.style.left = `${mouseX}px`;
        DOMElements.cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline.classList.remove('cursor-hover'));
    });
}

