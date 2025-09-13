// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

// --- DOM Element Caching ---
const DOMElements = {};
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    DOMElements.purchaseBtns = document.querySelectorAll('.purchase-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');

    onAuthStateChanged(auth, user => {
        currentUser = user;
    });

    DOMElements.purchaseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentUser) {
                // Show sign-in modal if user is not logged in
                if (DOMElements.authModal) {
                    DOMElements.authModal.classList.remove('opacity-0', 'invisible');
                }
                return;
            }
            const plan = btn.dataset.plan;
            const amount = btn.dataset.amount;
            const credits = btn.dataset.credits;
            handlePurchase(plan, amount, credits);
        });
    });

    initializeCursor();
});

async function handlePurchase(plan, amount, credits) {
    const purchaseBtn = document.querySelector(`button[data-plan="${plan}"]`);
    const originalText = purchaseBtn.innerHTML;
    
    // --- FIX: Disable the button and show a processing state ---
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
        
        // Dynamically create and submit a form to redirect to PayU
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
        // --- FIX: Re-enable the button and restore text on error ---
        purchaseBtn.disabled = false;
        purchaseBtn.innerHTML = originalText;
    }
}


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

