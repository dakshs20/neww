// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// --- Global State & DOM Element Caching ---
let currentUser = null;
const DOMElements = {};

// --- Main Setup Function ---
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements for better performance and cleaner code.
    DOMElements.purchaseBtns = document.querySelectorAll('.purchase-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.mobileAuthBtn = document.getElementById('mobile-auth-btn');
    DOMElements.generationCounter = document.getElementById('generation-counter');
    DOMElements.mobileGenerationCounter = document.getElementById('mobile-generation-counter');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');

    // Set up a listener that watches for user sign-in or sign-out events.
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateHeaderUI(user); // Update the header whenever the auth state changes.
    });

    // Attach a click event listener to every "Buy Now" button.
    DOMElements.purchaseBtns.forEach(btn => {
        btn.addEventListener('click', (event) => {
            // If the user is not signed in, show the sign-in modal.
            if (!currentUser) {
                toggleModal(DOMElements.authModal, true);
                return; // Stop the process here.
            }
            // If the user is signed in, proceed with the purchase.
            const clickedButton = event.currentTarget;
            const plan = clickedButton.dataset.plan;
            const amount = clickedButton.dataset.amount;
            const credits = clickedButton.dataset.credits;
            handlePurchase(clickedButton, plan, amount, credits);
        });
    });

    // Add listeners for modal and header buttons.
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));

    initializeCursor();
});

/**
 * Shows or hides a modal dialog.
 * @param {HTMLElement} modal - The modal element to toggle.
 * @param {boolean} show - True to show the modal, false to hide it.
 */
function toggleModal(modal, show) {
    if (modal) {
        if (show) {
            modal.classList.remove('opacity-0', 'invisible');
        } else {
            modal.classList.add('opacity-0', 'invisible');
        }
    }
}

/**
 * Handles the main authentication action (Sign In or Sign Out).
 */
function handleAuthAction() {
    if (currentUser) {
        signOut(auth).catch(error => console.error("Sign out error:", error));
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

/**
 * Initiates the Google Sign-In popup flow.
 */
function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => console.error("Authentication Error:", error));
}

/**
 * Updates the header UI to reflect the user's login status and credit balance.
 * @param {object|null} user - The current Firebase user object or null.
 */
async function updateHeaderUI(user) {
    if (user) {
        // If user is signed in, show "Sign Out" and fetch their credits.
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch credits');
            const data = await response.json();
            const text = `Credits: ${data.credits}`;
            DOMElements.generationCounter.textContent = text;
            DOMElements.mobileGenerationCounter.textContent = text;
        } catch (error) {
            console.error("Credit fetch error:", error);
            DOMElements.generationCounter.textContent = "Error";
            DOMElements.mobileGenerationCounter.textContent = "Error";
        }
    } else {
        // If user is signed out, show "Sign In" and clear credit display.
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        DOMElements.generationCounter.textContent = '';
        DOMElements.mobileGenerationCounter.textContent = '';
    }
}

/**
 * Handles the secure payment initiation process.
 * @param {HTMLButtonElement} purchaseBtn - The specific "Buy Now" button that was clicked.
 * @param {string} plan - The name of the plan.
 * @param {string} amount - The cost of the plan.
 * @param {string} credits - The number of credits to be purchased.
 */
async function handlePurchase(purchaseBtn, plan, amount, credits) {
    const originalText = purchaseBtn.innerHTML;
    
    // Disable the button and show a processing indicator to prevent multiple clicks.
    purchaseBtn.disabled = true;
    purchaseBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing...
    `;

    try {
        const token = await currentUser.getIdToken();
        // Call our secure backend API to prepare the payment details.
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan, amount, credits })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initiate payment.');
        }

        const paymentData = await response.json();
        
        // Create a hidden form with the data from the backend and submit it
        // to redirect the user to the PayU payment page.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentData.action; 
        document.body.appendChild(form);

        for (const key in paymentData.params) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = paymentData.params[key];
            form.appendChild(input);
        }
        
        form.submit();

    } catch (error) {
        console.error('Could not start the payment process:', error.message);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        // If an error occurs, re-enable the button.
        purchaseBtn.disabled = false;
        purchaseBtn.innerHTML = originalText;
    }
}

/**
 * Initializes the custom cursor effect.
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

