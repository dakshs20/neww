// /pricing.js
// --- NEW FILE ---
// Handles the logic for the pricing page, including Razorpay checkout.

import { auth } from './script.js'; // We need auth instance from the main script.

document.addEventListener('DOMContentLoaded', () => {
    const purchaseButtons = document.querySelectorAll('.purchase-btn');
    purchaseButtons.forEach(button => {
        button.addEventListener('click', () => handlePurchase(button));
    });
});

async function handlePurchase(button) {
    const planId = button.dataset.plan;
    const credits = parseInt(button.dataset.credits, 10);
    const user = auth.currentUser;

    if (!user) {
        showMessage('Please sign in to purchase a credit plan.', 'error');
        // Optionally, trigger the sign-in modal
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.setAttribute('aria-hidden', 'false');
        return;
    }
    
    // Disable button to prevent multiple clicks
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        const idToken = await user.getIdToken();
        
        // 1. Create an order on the server
        const orderResponse = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, idToken }),
        });

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            throw new Error(errorData.error || 'Failed to create order.');
        }

        const order = await orderResponse.json();

        // 2. Open Razorpay Checkout
        const options = {
            key: 'rzp_test_RDNyZs2AtxEW2m', // Your site key
            amount: order.amount,
            currency: order.currency,
            name: 'GenArt Credits',
            description: `Purchase ${credits} credits`,
            image: 'https://iili.io/FsAoG2I.md.png',
            order_id: order.id,
            handler: async function (response) {
                // 3. Verify the payment on the server
                const verificationResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        idToken: await user.getIdToken(),
                        planId,
                        credits
                    }),
                });

                if (!verificationResponse.ok) {
                    throw new Error('Payment verification failed.');
                }
                
                showMessage('Payment successful! Credits have been added to your account.', 'success');
                // Redirect or update UI
                setTimeout(() => window.location.href = 'index.html', 2000);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email || '',
            },
            theme: {
                color: '#42669C'
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            showMessage(`Payment failed: ${response.error.description}`, 'error');
        });
        rzp.open();

    } catch (error) {
        console.error('Purchase failed:', error);
        showMessage(error.message, 'error');
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = 'Purchase Plan';
    }
}

function showMessage(text, type = 'info') {
    const messageBox = document.getElementById('pricing-message');
    const messageEl = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
    messageEl.className = `p-4 rounded-lg ${bgColor} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => {
        if(messageBox.contains(messageEl)) {
            messageBox.removeChild(messageEl);
        }
    }, 5000);
}
