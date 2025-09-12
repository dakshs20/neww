// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// This configuration must be the same as in script.js
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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {

    // --- Custom Cursor Logic ---
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (cursorDot && cursorOutline) {
        let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        const animateCursor = () => {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
            const ease = 0.15;
            outlineX += (mouseX - outlineX) * ease;
            outlineY += (mouseY - outlineY) * ease;
            cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
            requestAnimationFrame(animateCursor);
        };
        requestAnimationFrame(animateCursor);
        document.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
            el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
        });
    }

    // --- Payment Logic ---
    const buyButtons = document.querySelectorAll('.buy-btn');
    const authModal = document.getElementById('auth-modal');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const paymentMessageEl = document.getElementById('payment-message');

    buyButtons.forEach(button => {
        button.addEventListener('click', () => handlePurchase(button));
    });

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
        });
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    }

    async function handlePurchase(button) {
        if (!auth.currentUser) {
            authModal.setAttribute('aria-hidden', 'false');
            return;
        }

        const amount = button.dataset.amount;
        const credits = button.dataset.credits;
        const user = auth.currentUser;
        paymentMessageEl.textContent = '';
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/payu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    amount: amount,
                    credits: credits,
                    firstname: user.displayName.split(' ')[0],
                    email: user.email
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start payment process.');
            }

            const paymentData = await response.json();

            if (paymentData.paymentUrl && paymentData.params) {
                redirectToPayU(paymentData.paymentUrl, paymentData.params);
            } else {
                throw new Error('Invalid payment data received from server.');
            }
        } catch (error) {
            console.error('Payment Error:', error);
            paymentMessageEl.textContent = `Error: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = 'Buy Now';
        }
    }

    function redirectToPayU(url, params) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;

        for (const key in params) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
    }
});

