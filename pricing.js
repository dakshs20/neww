// --- Firebase and Auth Initialization ---
// IMPORTANT: Use your actual Firebase configuration.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    //
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    //  CRITICAL: Replace these placeholder values with your OWN 
    //  Firebase project's configuration details. You can find these
    //  in your Firebase project settings.
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    //
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
        priceYearly: 7980,
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
        // This is a placeholder. In a real app, you'd fetch from your `/api/credits` endpoint.
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
            setTimeout(() => modal.classList.remove('invisible', 'opacity-0'), 10);
        } else {
            modal.classList.add('invisible', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    // --- Billing Toggle Logic ---
    function updateBillingCycle(cycle) {
        currentBillingCycle = cycle;
        const isYearly = cycle === 'yearly';

        // Animate toggle background
        if (monthlyBtn && yearlyBtn && toggleBg) {
            toggleBg.style.transform = isYearly ? `translateX(${monthlyBtn.offsetWidth}px)` : 'translateX(0px)';
            toggleBg.style.width = isYearly ? `${yearlyBtn.offsetWidth}px` : `${monthlyBtn.offsetWidth}px`;

            monthlyBtn.classList.toggle('text-gray-800', !isYearly);
            monthlyBtn.classList.toggle('text-gray-500', isYearly);
            yearlyBtn.classList.toggle('text-gray-800', isYearly);
            yearlyBtn.classList.toggle('text-gray-500', !isYearly);
        }
        
        // Update prices on each card
        planCards.forEach(card => {
            const priceValueEl = card.querySelector('.price-value');
            const priceBreakdownEl = card.querySelector('.price-breakdown');
            
            const monthlyPrice = priceValueEl.dataset.priceMonthly;
            const yearlyPrice = priceValueEl.dataset.priceYearly;
            const targetPrice = isYearly ? yearlyPrice : monthlyPrice;

            gsap.to(priceValueEl, {
                duration: 0.4,
                innerText: targetPrice,
                roundProps: "innerText",
                ease: "power2.inOut"
            });
            
            if (isYearly) {
                const perMonthEquivalent = Math.round(yearlyPrice / 12);
                priceBreakdownEl.innerHTML = `Billed once: ₹${yearlyPrice} <br> (equiv. to ₹${perMonthEquivalent}/mo)`;
            } else {
                priceBreakdownEl.textContent = 'Billed monthly.';
            }
        });
    }

    if(monthlyBtn && yearlyBtn) {
        monthlyBtn.addEventListener('click', () => updateBillingCycle('monthly'));
        yearlyBtn.addEventListener('click', () => updateBillingCycle('yearly'));
        updateBillingCycle('monthly');
    }

    // --- Checkout Flow ---
    function openCheckoutModal(planId, planName) {
        const plan = planDetails[planId];
        if (!plan) return;

        selectedPlan = {
            id: planId,
            name: plan.name,
            billingCycle: currentBillingCycle,
            price: currentBillingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly,
            credits: plan.credits,
            expiry: plan.expiry
        };

        document.getElementById('modal-plan-name').textContent = selectedPlan.name;
        document.getElementById('modal-billing-cycle').textContent = currentBillingCycle.charAt(0).toUpperCase() + currentBillingCycle.slice(1);
        document.getElementById('modal-charge-amount').textContent = `₹${selectedPlan.price}`;
        document.getElementById('modal-credits-amount').textContent = `${selectedPlan.credits} generations`;
        document.getElementById('modal-expiry').textContent = selectedPlan.expiry;
        
        toggleModal(checkoutModal, true);
        gsap.fromTo(checkoutModalContent, { scale: 0.95, opacity: 0 }, { duration: 0.3, scale: 1, opacity: 1, ease: 'power2.out' });
    }

    planCtaButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!currentUser) {
                toggleModal(authModal, true);
                return;
            }
            const planId = button.dataset.planId;
            openCheckoutModal(planId);
        });
    });

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
            
            const response = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ planId: selectedPlan.id, billingCycle: selectedPlan.billingCycle })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create order.');
            }

            const orderData = await response.json();
            
            const options = {
                key: orderData.key,
                amount: orderData.amount, // Amount is in paise, sent from backend
                currency: "INR",
                name: "GenArt",
                description: `Payment for ${selectedPlan.name}`,
                image: "https://iili.io/FsAoG2I.md.png",
                order_id: orderData.orderId,
                subscription_id: orderData.subscriptionId,
                handler: async function (response) {
                    const verificationResponse = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: orderData.orderId, // Use the orderId from our server
                            razorpay_subscription_id: orderData.subscriptionId, // Use the subscriptionId from our server
                            razorpay_signature: response.razorpay_signature,
                            billingCycle: selectedPlan.billingCycle
                        })
                    });
                    
                    if(verificationResponse.ok) {
                        alert('Payment Successful! Your credits have been added.');
                        window.location.href = '/dashboard.html';
                    } else {
                        const error = await verificationResponse.json();
                        alert(`Payment verification failed: ${error.details || 'Please contact support.'}`);
                    }
                },
                prefill: {
                    name: currentUser.displayName || "",
                    email: currentUser.email || "",
                },
                notes: {
                    userId: currentUser.uid,
                    planId: selectedPlan.id
                },
                theme: { color: "#4F46E5" }
            };
            
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response){
                alert(`Payment Failed: ${response.error.description}`);
            });
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
    }
});

