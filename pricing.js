// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once to avoid repeated lookups
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.mobileAuthBtn = document.getElementById('mobile-auth-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.generationCounter = document.getElementById('generation-counter');
    DOMElements.mobileGenerationCounter = document.getElementById('mobile-generation-counter');
    DOMElements.buyNowBtns = document.querySelectorAll('.buy-now-btn');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    DOMElements.mobileMenu = document.getElementById('mobile-menu');

    initializeEventListeners();
    initializeCursor();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.mobileMenuBtn?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));

    DOMElements.buyNowBtns.forEach(btn => {
        // Using 'mousedown' for better responsiveness on touch devices like iPhones.
        btn.addEventListener('mousedown', (event) => handlePurchase(event));
    });
}

// --- Core Logic ---

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.remove('opacity-0', 'invisible');
    } else {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('opacity-0', 'invisible');
    }
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json();
                DOMElements.generationCounter.textContent = `Credits: ${data.credits}`;
                DOMElements.mobileGenerationCounter.textContent = `Credits: ${data.credits}`;
            } else {
                throw new Error("Failed to fetch credits");
            }
        } catch (error) {
            console.error("Error fetching credits:", error);
            DOMElements.generationCounter.textContent = "Credits: Error";
            DOMElements.mobileGenerationCounter.textContent = "Credits: Error";
        }
    } else {
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        DOMElements.generationCounter.textContent = 'Sign in for credits';
        DOMElements.mobileGenerationCounter.textContent = 'Sign in for credits';
    }
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            alert("Failed to sign in. Please try again.");
        });
}

async function handlePurchase(event) {
    const clickedButton = event.currentTarget;
    const plan = clickedButton.dataset.plan;

    // This is the feature to prompt non-logged-in users to sign in.
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    const originalButtonText = clickedButton.innerHTML;
    clickedButton.disabled = true;
    clickedButton.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `Server Error: ${response.status}`);
        }

        const { paymentData } = await response.json();
        redirectToPayU(paymentData);

    } catch (error) {
        console.error('Payment initiation failed:', error);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        clickedButton.disabled = false;
        clickedButton.innerHTML = originalButtonText;
    }
}

function redirectToPayU(data) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://secure.payu.in/_payment'; 

    for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        }
    }

    document.body.appendChild(form);
    form.submit();
}

// --- Utility: Custom Cursor ---
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

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline.classList.remove('cursor-hover'));
    });
}

