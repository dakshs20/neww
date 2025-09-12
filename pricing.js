// Import Firebase modules for authentication
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
const buyButtons = document.querySelectorAll('.buy-btn');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const paymentSpinner = document.getElementById('payment-spinner');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const generationCounter = document.getElementById('generation-counter');
const mobileGenerationCounter = document.getElementById('mobile-generation-counter');


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        updateUIForAuthState(user);
        
        buyButtons.forEach(button => {
            button.addEventListener('click', () => handlePurchase(button, auth.currentUser));
        });
    });

    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
});

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => {
            console.error("Authentication Error:", error);
            alert('Sign-in failed. Please try again.');
        });
}

async function updateUIForAuthState(user) {
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        authModal.setAttribute('aria-hidden', 'true');
        
        // Fetch and display credits
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) throw new Error('Failed to fetch credits');
            const data = await response.json();
            const creditText = `Credits: ${data.credits}`;
            generationCounter.textContent = creditText;
            mobileGenerationCounter.textContent = creditText;
        } catch (error) {
            console.error("Credit fetch error:", error);
            const errorText = 'Credits: Error';
            generationCounter.textContent = errorText;
            mobileGenerationCounter.textContent = errorText;
        }

    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        const defaultText = 'Sign in for credits';
        generationCounter.textContent = defaultText;
        mobileGenerationCounter.textContent = defaultText;
    }
}

async function handlePurchase(button, user) {
    if (!user) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    const plan = button.dataset.plan;
    const amount = button.dataset.amount;
    const credits = button.dataset.credits;

    paymentSpinner.classList.remove('hidden');
    buyButtons.forEach(btn => btn.disabled = true); // Disable all buy buttons

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
                productinfo: `${credits} Credits Pack (${plan})`,
                firstname: user.displayName || 'GenArt User',
                email: user.email,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initiate payment.');
        }

        const data = await response.json();

        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
        } else {
            throw new Error('No redirect URL received from server.');
        }

    } catch (error) {
        console.error('Payment Initiation Error:', error);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        paymentSpinner.classList.add('hidden');
        buyButtons.forEach(btn => btn.disabled = false); // Re-enable all buy buttons
    }
}

