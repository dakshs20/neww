// Import Firebase modules for authentication context
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Global state
let currentUser = null;
let userCredits = 0;
let userUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
    
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            setupUserListener(user.uid);
        } else {
            currentUser = null;
            userCredits = 0;
            if (userUnsubscribe) userUnsubscribe();
            updateUIForAuthState(false);
        }
    });

    const buyNowButtons = document.querySelectorAll('.buy-now-btn');
    buyNowButtons.forEach(button => {
        button.addEventListener('click', handlePurchaseClick);
    });

    // Modal listeners
    const authModal = document.getElementById('auth-modal');
    document.getElementById('google-signin-btn').addEventListener('click', () => {
        signInWithPopup(auth, provider).then(() => {
            authModal.setAttribute('aria-hidden', 'true');
        }).catch(err => console.error(err));
    });
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        authModal.setAttribute('aria-hidden', 'true');
    });

    // Also initialize universal header/cursor scripts
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    if (authBtn) authBtn.addEventListener('click', () => { if (currentUser) signOut(auth); else authModal.setAttribute('aria-hidden', 'false'); });
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', () => { if (currentUser) signOut(auth); else authModal.setAttribute('aria-hidden', 'false'); });
});

function setupUserListener(userId) {
    const userDocRef = doc(db, "users", userId);
    userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            userCredits = docSnap.data().credits;
            updateUIForAuthState(true);
        }
    });
}

function updateUIForAuthState(isLoggedIn) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const creditDisplay = document.getElementById('credit-display');
    const mobileCreditDisplay = document.getElementById('mobile-credit-display');
    
    if (isLoggedIn) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        
        creditDisplay.innerHTML = `<span class="text-sm font-medium text-gray-700">Credits: ${userCredits}</span>`;
        mobileCreditDisplay.innerHTML = `Credits: ${userCredits}`;
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        creditDisplay.innerHTML = '';
        mobileCreditDisplay.innerHTML = '';
    }
}


async function handlePurchaseClick(event) {
    const button = event.currentTarget;
    const authModal = document.getElementById('auth-modal');

    if (!currentUser) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    const { plan, amount, credits } = button.dataset;
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        // 1. Create a payment order on the server
        const orderResponse = await fetch('/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_order',
                amount: parseFloat(amount),
                currency: 'USD'
            }),
        });

        const order = await orderResponse.json();
        if (!orderResponse.ok) throw new Error(order.error || 'Failed to create payment order.');

        // 2. Open Razorpay Checkout
        const options = {
            key: order.key_id, // Your Razorpay Key ID
            amount: order.amount,
            currency: order.currency,
            name: 'GenArt Credits',
            description: `Purchase ${credits} credits`,
            order_id: order.id,
            handler: async function(response) {
                // 3. Verify the payment on the server
                const verificationResponse = await fetch('/api/payment', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                        action: 'verify_payment',
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        userId: currentUser.uid,
                        plan,
                        amount: parseFloat(amount),
                        credits: parseInt(credits)
                     })
                });

                const verificationResult = await verificationResponse.json();
                if (verificationResult.success) {
                    alert('Payment successful! Your credits have been added.');
                    window.location.href = '/'; // Redirect to home page
                } else {
                    alert(`Payment verification failed: ${verificationResult.error}`);
                }
            },
            prefill: {
                name: currentUser.displayName,
                email: currentUser.email,
            },
            theme: {
                color: '#3b82f6'
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            alert(`Payment failed: ${response.error.description}`);
        });
        rzp.open();

    } catch (error) {
        console.error('Purchase failed:', error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Buy Now';
    }
}
