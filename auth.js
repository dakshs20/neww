// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Authentication ---

const signInWithGoogle = () => {
    signInWithPopup(auth, provider).catch(error => console.error("Authentication Error:", error));
};

const signOutUser = () => {
    signOut(auth).catch(error => console.error("Sign Out Error:", error));
};

const onAuthStateChange = (callback) => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    callback(user, docSnap.data());
                } else {
                    // New user, create their document with free credits
                    setDoc(userRef, {
                        email: user.email,
                        displayName: user.displayName,
                        credits: 5 // 5 free credits for new users
                    }).then(() => {
                         onSnapshot(userRef, (snap) => callback(user, snap.data()));
                    });
                }
            });
        } else {
            callback(null, null);
        }
    });
};

// --- Credit Management ---

const deductCredits = async (userId, amount = 1) => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    try {
        await setDoc(userRef, { credits: increment(-amount) }, { merge: true });
    } catch (error) {
        console.error("Error deducting credits:", error);
    }
};


// --- Payment Processing ---

const RAZORPAY_KEY_ID = 'rzp_test_RDNyZs2AtxEW2m';

const plans = {
    starter: { amount: 600, credits: 600, name: 'Starter Plan' },
    pro: { amount: 1200, credits: 1200, name: 'Pro Plan' },
    mega: { amount: 3500, credits: 4000, name: 'Mega Plan' } // $35 -> 3500 cents
};

const initiatePayment = (planId, user) => {
    if (!user) {
        alert("Please sign in to make a purchase.");
        return;
    }

    const plan = plans[planId];
    if (!plan) {
        console.error("Invalid plan ID");
        return;
    }

    const options = {
        key: RAZORPAY_KEY_ID,
        amount: plan.amount * 100, // Amount in paise
        currency: "INR",
        name: "GenArt",
        description: `${plan.name} - ${plan.credits} Credits`,
        image: "https://iili.io/FsAoG2I.md.png",
        handler: function (response) {
            // This handler is called on successful payment
            verifyPayment(response, user.uid, planId);
        },
        prefill: {
            name: user.displayName,
            email: user.email,
        },
        theme: {
            color: "#3b82f6"
        },
        modal: {
            ondismiss: function() {
                console.log('Checkout form closed');
            }
        }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
};

async function verifyPayment(paymentResponse, userId, planId) {
    try {
        // In a real app, you would send this to your backend to verify
        // For this example, we will assume verification is successful on the client
        // and directly call the backend endpoint to add credits.
        const response = await fetch('/api/verify-payment', { // The backend endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                userId: userId,
                planId: planId
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert('Payment successful! Your credits have been added.');
        } else {
            throw new Error(result.error || 'Payment verification failed.');
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        alert('There was an issue with your payment. Please contact support.');
    }
}


export {
    auth,
    db,
    signInWithGoogle,
    signOutUser,
    onAuthStateChange,
    deductCredits,
    initiatePayment
};
