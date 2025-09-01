// Import Firebase modules to get user info
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let keyId = ''; // We will fetch this from the server

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
        } else {
            // If user is not signed in, redirect them to the main page to sign in first.
            window.location.href = '/'; 
        }
    });
    
    // Fetch the Razorpay Key ID from our server
    fetch('/api/get-key')
        .then(res => res.json())
        .then(data => {
            keyId = data.keyId;
        })
        .catch(err => console.error("Failed to fetch Razorpay Key ID", err));


    const purchaseButtons = document.querySelectorAll('.purchase-btn');
    purchaseButtons.forEach(button => {
        button.addEventListener('click', () => createOrder(button));
    });

    setupCustomCursor();
});

async function createOrder(button) {
    if (!currentUser) {
        alert("Please sign in to make a purchase.");
        return;
    }
    if (!keyId) {
        alert("Payment gateway is not ready. Please try again in a moment.");
        return;
    }

    const originalText = button.innerHTML;
    button.innerHTML = '<div class="loader mx-auto"></div>';
    button.disabled = true;

    const amount = button.dataset.amount;
    const credits = button.dataset.credits;
    const planId = button.dataset.planId;

    try {
        // Step 1: Ask our server to create a Razorpay order
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, userId: currentUser.uid, planId: planId })
        });

        const order = await response.json();

        if (order.error) {
            throw new Error(order.error);
        }

        // Step 2: Open Razorpay Checkout
        const options = {
            key: keyId,
            amount: order.amount,
            currency: "INR",
            name: "GenArt Credits",
            description: `Purchase of ${credits} credits`,
            image: "https://iili.io/FsAoG2I.md.png",
            order_id: order.id,
            handler: async function (response) {
                // Step 3: Verify the payment
                const verificationResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        userId: currentUser.uid,
                        credits: credits
                    })
                });

                const result = await verificationResponse.json();

                if (result.status === 'success') {
                    // Show success message
                    document.getElementById('pricing-content').classList.add('hidden');
                    document.getElementById('success-message').classList.remove('hidden');
                } else {
                    alert(`Payment verification failed: ${result.error}. Please contact support.`);
                }
            },
            prefill: {
                name: currentUser.displayName || "",
                email: currentUser.email || "",
            },
            theme: {
                color: "#42669C"
            }
        };
        const rzp1 = new Razorpay(options);
        rzp1.on('payment.failed', function (response){
            alert(`Payment failed: ${response.error.description}`);
        });
        rzp1.open();

    } catch (error) {
        console.error("Payment Error:", error);
        alert("An error occurred during payment. Please try again.");
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}


function setupCustomCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    if (!cursorDot || !cursorOutline) return;

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

    const interactiveElements = document.querySelectorAll('a, button');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
}

