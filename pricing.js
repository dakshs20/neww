// --- Firebase and Auth Initialization ---
// IMPORTANT: Use your actual Firebase configuration.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    // This is a placeholder, replace with your actual Firebase config
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
console.log("Firebase Initialized");


// --- Global State ---
let currentUser = null;
let currentBillingCycle = 'monthly'; // 'monthly' or 'yearly'
let selectedPlan = {};

// --- Plan Details (Single Source of Truth) ---
const planDetails = {
    hobby: {
        name: "Hobby Plan",
        credits: 575,
        priceMonthly: 798,
        priceYearly: 7980, // (798 * 12) * 0.833 -> ~16.7% discount
        expiry: "3 months"
    },
    create: {
        name: "Create Plan",
        credits: 975,
        priceMonthly: 1596,
        priceYearly: 15960,
        expiry: "5 months"
    },
    elevate: {
        name: "Elevate Plan",
        credits: 1950,
        priceMonthly: 2571,
        priceYearly: 25710,
        expiry: "Never"
    }
};

// --- DOMContentLoaded Event Listener ---
// This ensures the script runs only after the entire HTML page has been loaded.
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // Cache all necessary DOM elements
    const monthlyBtn = document.getElementById('monthly-btn');
    const yearlyBtn = document.getElementById('yearly-btn');
    const toggleBg = document.getElementById('toggle-bg');
    const planCards = document.querySelectorAll('.plan-card');
    const planCtaButtons = document.querySelectorAll('.plan-cta-btn');
    const checkoutModal = document.getElementById('checkout-modal');
    const checkoutModalContent = document.getElementById('checkout-modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const proceedToPaymentBtn = document.getElementById('proceed-to-payment-btn');
    const authModal = document.getElementById('auth-modal');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeAuthModalBtns = document.querySelectorAll('.close-auth-modal-btn');
    const mainAuthBtn = document.getElementById('auth-btn');
    const creditsCounter = document.getElementById('credits-counter');


    // --- Authentication Logic ---
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            console.log("User is signed in:", user.displayName);
            mainAuthBtn.textContent = 'Sign Out';
            fetchUserCredits(user);
        } else {
            currentUser = null;
            console.log("User is signed out");
            mainAuthBtn.textContent = 'Sign In';
            if (creditsCounter) creditsCounter.textContent = '';
        }
    });
    
    async function fetchUserCredits(user) {
        // This is a placeholder function. In a real app, you would fetch this from your backend.
        // For now, we'll just show a placeholder.
        if (creditsCounter) creditsCounter.textContent = 'Credits: 50'; // Example
    }
    
    mainAuthBtn.addEventListener('click', () => {
        if (currentUser) {
            signOut(auth);
        } else {
            toggleModal(authModal, true);
        }
    });

    googleSignInBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then(() => {
                toggleModal(authModal, false);
            })
            .catch(error => console.error("Auth Error:", error));
    });

    closeAuthModalBtns.forEach(btn => btn.addEventListener('click', () => toggleModal(authModal, false)));


    // --- UI Interaction Logic ---
    function toggleModal(modal, show) {
        if (!modal) return;
        if (show) {
            modal.classList.remove('hidden');
            modal.classList.remove('invisible', 'opacity-0');
        } else {
            modal.classList.add('invisible', 'opacity-0');
            // Hide it completely after the transition
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    // --- Billing Toggle Logic ---
    function updateBillingCycle(cycle) {
        currentBillingCycle = cycle;
        const isYearly = cycle === 'yearly';

        // Animate toggle background
        toggleBg.style.transform = isYearly ? `translateX(${monthlyBtn.offsetWidth}px)` : 'translateX(0px)';
        toggleBg.style.width = isYearly ? `${yearlyBtn.offsetWidth}px` : `${monthlyBtn.offsetWidth}px`;

        // Update button styles
        monthlyBtn.classList.toggle('text-gray-800', !isYearly);
        monthlyBtn.classList.toggle('text-gray-500', isYearly);
        yearlyBtn.classList.toggle('text-gray-800', isYearly);
        yearlyBtn.classList.toggle('text-gray-500', !isYearly);
        
        // Update prices on each card
        planCards.forEach(card => {
            const priceValueEl = card.querySelector('.price-value');
            const priceBreakdownEl = card.querySelector('.price-breakdown');
            
            const monthlyPrice = priceValueEl.dataset.priceMonthly;
            const yearlyPrice = priceValueEl.dataset.priceYearly;

            const targetPrice = isYearly ? yearlyPrice : monthlyPrice;

            // Animate price change
            gsap.to(priceValueEl, {
                duration: 0.4,
                innerText: targetPrice,
                roundProps: "innerText",
                ease: "power2.inOut"
            });
            
            if (isYearly) {
                const perMonthEquivalent = (yearlyPrice / 12).toFixed(0);
                priceBreakdownEl.innerHTML = `Billed once: ₹${yearlyPrice} <br> (equivalent to ₹${perMonthEquivalent}/mo)`;
            } else {
                priceBreakdownEl.textContent = 'Billed monthly.';
            }
        });
    }

    if(monthlyBtn && yearlyBtn) {
        monthlyBtn.addEventListener('click', () => updateBillingCycle('monthly'));
        yearlyBtn.addEventListener('click', () => updateBillingCycle('yearly'));
        // Set initial state
        updateBillingCycle('monthly');
    } else {
        console.error("Monthly or Yearly button not found!");
    }


    // --- Checkout Flow ---
    function openCheckoutModal(planId, planName) {
        const plan = planDetails[planId];
        if (!plan) {
            console.error("Invalid Plan ID:", planId);
            return;
        }

        selectedPlan = {
            id: planId,
            name: plan.name,
            billingCycle: currentBillingCycle,
            price: currentBillingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly,
            credits: plan.credits,
            expiry: plan.expiry
        };

        // Populate modal with selected plan info
        document.getElementById('modal-plan-name').textContent = selectedPlan.name;
        document.getElementById('modal-billing-cycle').textContent = currentBillingCycle.charAt(0).toUpperCase() + currentBillingCycle.slice(1);
        document.getElementById('modal-charge-amount').textContent = `₹${selectedPlan.price}`;
        document.getElementById('modal-credits-amount').textContent = `${selectedPlan.credits} generations`;
        document.getElementById('modal-expiry').textContent = selectedPlan.expiry;
        
        toggleModal(checkoutModal, true);
        // Animate modal content
        gsap.to(checkoutModalContent, { duration: 0.3, scale: 1, opacity: 1, ease: 'power2.out' });
    }

    if (planCtaButtons.length > 0) {
        planCtaButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!currentUser) {
                    toggleModal(authModal, true);
                    return;
                }
                const planId = button.dataset.planId;
                const planName = button.dataset.planName;
                openCheckoutModal(planId, planName);
            });
        });
    } else {
        console.error("No plan CTA buttons found!");
    }


    closeModalBtn.addEventListener('click', () => {
        gsap.to(checkoutModalContent, { duration: 0.2, scale: 0.95, opacity: 0, ease: 'power2.in', onComplete: () => {
            toggleModal(checkoutModal, false);
        }});
    });

    // --- Razorpay Integration ---
    async function handlePayment() {
        if (!currentUser) {
            alert("You must be signed in to make a purchase.");
            return;
        }
        
        const proceedButton = document.getElementById('proceed-to-payment-btn');
        proceedButton.disabled = true;
        proceedButton.textContent = 'Processing...';

        try {
            const token = await currentUser.getIdToken();
            
            // Call your backend to create an order
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    planId: selectedPlan.id,
                    billingCycle: selectedPlan.billingCycle
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create order.');
            }

            const orderData = await response.json();
            
            // Setup Razorpay options
            const options = {
                key: orderData.key,
                amount: orderData.amount,
                currency: "INR",
                name: "GenArt",
                description: `Payment for ${selectedPlan.name}`,
                image: "https://iili.io/FsAoG2I.md.png",
                order_id: orderData.orderId, // For one-time payments
                subscription_id: orderData.subscriptionId, // For recurring payments
                handler: async function (response) {
                    // This function is called after a successful payment
                    // You should now call your backend to verify the payment
                    const verificationResponse = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_signature: response.razorpay_signature,
                            billingCycle: selectedPlan.billingCycle
                        })
                    });
                    
                    if(verificationResponse.ok) {
                        alert('Payment Successful! Your credits have been added.');
                        window.location.href = '/dashboard.html';
                    } else {
                        alert('Payment verification failed. Please contact support.');
                    }
                },
                prefill: {
                    name: currentUser.displayName || "",
                    email: currentUser.email || "",
                },
                notes: {
                    userId: currentUser.uid, // IMPORTANT: Pass user ID to backend
                    planId: selectedPlan.id
                },
                theme: {
                    color: "#4F46E5" // Indigo color
                }
            };
            
            // Open Razorpay Checkout
            const rzp = new Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error("Payment Error:", error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            proceedButton.disabled = false;
            proceedButton.textContent = 'Proceed to Secure Checkout';
        }
    }
    
    if (proceedToPaymentBtn) {
        proceedToPaymentBtn.addEventListener('click', handlePayment);
    } else {
        console.error("Proceed to payment button not found!");
    }

}); // End of DOMContentLoaded
