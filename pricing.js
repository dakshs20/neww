// --- UPDATED ---
// This script handles the entire client-side payment flow for the pricing page.
// It uses the INR currency and communicates with the backend for secure transactions.

import { auth } from './script.js'; 

// --- Constants ---
const RAZORPAY_KEY_ID = 'rzp_test_RDNyZs2AtxEW2m';

const plans = {
    starter: { name: 'Starter', amount: 499, credits: 600 },
    pro: { name: 'Pro', amount: 999, credits: 1200 },
    mega: { name: 'Mega', amount: 2999, credits: 4000 }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const purchaseButtons = document.querySelectorAll('.purchase-btn');
    purchaseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const planKey = button.dataset.plan;
            if (auth.currentUser) {
                handlePurchase(planKey, button);
            } else {
                // You can replace this with a more elegant modal
                alert('Please sign in to purchase a plan.');
            }
        });
    });
});


/**
 * Handles the entire purchase flow from order creation to payment.
 * @param {string} planKey - The key for the selected plan (e.g., 'starter').
 * @param {HTMLElement} button - The button that was clicked.
 */
async function handlePurchase(planKey, button) {
    const originalButtonText = button.innerHTML;
    button.innerHTML = 'Processing...';
    button.disabled = true;

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("User not signed in.");
        }

        const idToken = await user.getIdToken();
        const selectedPlan = plans[planKey];

        // 1. Create Order on the Server
        const orderResponse = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, plan: selectedPlan })
        });

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            throw new Error(errorData.error || 'Could not create order.');
        }
        
        const order = await orderResponse.json();

        // 2. Open Razorpay Checkout
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: "GenArt Credits",
            description: `${selectedPlan.name} Plan Purchase`,
            order_id: order.id,
            handler: function (response) {
                // 3. Verify Payment on Success
                verifyPayment(response, selectedPlan, idToken);
            },
            prefill: {
                name: user.displayName || 'New User',
                email: user.email,
            },
            theme: {
                color: "#3b82f6" // Blue theme
            },
            "modal": {
                "ondismiss": function() {
                    console.log('Checkout form closed');
                    // Re-enable the button if the user closes the modal
                    button.innerHTML = originalButtonText;
                    button.disabled = false;
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Purchase failed:", error);
        alert(`Purchase failed: ${error.message}`);
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
}

/**
 * Sends payment details to the backend for verification and credit allocation.
 * @param {object} paymentResponse - The response object from Razorpay.
 * @param {object} plan - The plan object that was purchased.
 * @param {string} idToken - The user's Firebase ID token.
 */
async function verifyPayment(paymentResponse, plan, idToken) {
    try {
        const verificationResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                plan,
                idToken
            })
        });

        if (!verificationResponse.ok) {
             const errorData = await verificationResponse.json();
             throw new Error(errorData.error || 'Payment verification failed.');
        }

        const result = await verificationResponse.json();

        if (result.success) {
            alert('Payment successful! Your credits have been added.');
            window.location.href = '/index.html'; // Redirect to home page
        } else {
            throw new Error('Payment verification failed on the server.');
        }

    } catch (error) {
        console.error("Verification failed:", error);
        alert(`An error occurred during payment verification: ${error.message}`);
    }
}

