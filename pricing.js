import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    const buyButtons = document.querySelectorAll('.buy-btn');
    
    // We need to know who the user is before they can buy
    onAuthStateChanged(auth, user => {
        if (user) {
            buyButtons.forEach(button => {
                button.disabled = false;
                button.addEventListener('click', () => createOrder(button, user));
            });
        } else {
            buyButtons.forEach(button => {
                button.disabled = false; // Keep button enabled
                button.addEventListener('click', () => {
                    // If not signed in, show the sign-in modal
                    const authModal = document.getElementById('auth-modal');
                    if (authModal) {
                        authModal.setAttribute('aria-hidden', 'false');
                    }
                });
            });
        }
    });
});

async function createOrder(button, user) {
    const plan = button.dataset.plan;
    const amount = button.dataset.amount;
    const originalText = button.textContent;
    
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        const idToken = await user.getIdToken();
        
        // 1. Ask our backend to create a Razorpay order
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ plan, amount }),
        });

        const orderData = await response.json();

        if (!response.ok) {
            throw new Error(orderData.error || 'Failed to create order.');
        }

        // 2. Open the Razorpay checkout modal
        const options = {
            key: orderData.key,
            amount: orderData.amount,
            currency: "USD",
            name: "GenArt Credits",
            description: `${plan} Plan Purchase`,
            image: "https://iili.io/FsAoG2I.md.png",
            order_id: orderData.id,
            // 3. This function runs after payment is attempted
            handler: async function (response) {
                const verificationResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                    }),
                });

                const result = await verificationResponse.json();
                if (result.success) {
                    alert('Payment successful! Your credits have been added.');
                    window.location.href = '/'; // Redirect to home page
                } else {
                    alert(`Payment failed: ${result.error || 'Please contact support.'}`);
                }
            },
            prefill: {
                name: user.displayName || '',
                email: user.email || '',
            },
            theme: {
                color: "#3b82f6" // Blue
            }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error('Payment Error:', error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}
