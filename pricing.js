// --- Firebase and Auth Initialization ---
// This boilerplate is for user authentication checks.
// In a real app, you would have a shared file for this.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const firebaseConfig = { /* PASTE YOUR FIREBASE CONFIG HERE */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// --- End Firebase ---


// --- Plan Data (Client-Side) ---
const plans = {
    hobby: {
        name: 'Hobby Plan',
        credits: 575,
        expiry: '3 months',
        prices: { monthly: 798, yearly: 798 * 12 * 0.8 } // Assuming 20% discount
    },
    create: {
        name: 'Create Plan',
        credits: 975,
        expiry: '5 months',
        prices: { monthly: 1596, yearly: 1596 * 12 * 0.8 }
    },
    elevate: {
        name: 'Elevate Plan',
        credits: 1950,
        expiry: 'Never',
        prices: { monthly: 2571, yearly: 2571 * 12 * 0.8 }
    }
};

// --- State ---
let billingCycle = 'monthly';
let currentUser = null;
let selectedPlan = null;


// --- DOM Elements ---
const DOMElements = {
    monthlyBtn: document.getElementById('monthly-btn'),
    yearlyBtn: document.getElementById('yearly-btn'),
    toggleBg: document.getElementById('billing-toggle-bg'),
    planCards: document.querySelectorAll('.plan-card'),
    choosePlanBtns: document.querySelectorAll('.choose-plan-btn'),
    checkoutModal: document.getElementById('checkout-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    proceedToPaymentBtn: document.getElementById('proceed-to-payment-btn'),
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => { currentUser = user; });
    initializeEventListeners();
    updatePricesUI();
});

function initializeEventListeners() {
    DOMElements.monthlyBtn.addEventListener('click', () => setBillingCycle('monthly'));
    DOMElements.yearlyBtn.addEventListener('click', () => setBillingCycle('yearly'));
    DOMElements.choosePlanBtns.forEach(btn => {
        btn.addEventListener('click', handlePlanSelection);
    });
    DOMElements.closeModalBtn.addEventListener('click', () => toggleModal(false));
    DOMElements.proceedToPaymentBtn.addEventListener('click', initiatePayment);
}


// --- UI Logic ---

function setBillingCycle(cycle) {
    if (cycle === billingCycle) return;
    billingCycle = cycle;

    DOMElements.monthlyBtn.classList.toggle('text-gray-500', cycle === 'yearly');
    DOMElements.yearlyBtn.classList.toggle('text-gray-500', cycle === 'monthly');
    DOMElements.toggleBg.style.left = cycle === 'monthly' ? '0%' : '50%';

    updatePricesUI();
}

function updatePricesUI() {
    for (const planId in plans) {
        const planData = plans[planId];
        const card = document.getElementById(`${planId}-card`);
        const priceEl = card.querySelector('.price-value');
        const breakdownEl = document.getElementById(`${planId}-price-breakdown`);

        let displayPrice;
        if (billingCycle === 'monthly') {
            displayPrice = planData.prices.monthly;
            breakdownEl.innerHTML = '&nbsp;';
        } else {
            const perMonthEquivalent = Math.round(planData.prices.yearly / 12);
            displayPrice = perMonthEquivalent;
            breakdownEl.textContent = `Billed once: ₹${Math.round(planData.prices.yearly)} (Credits distributed monthly)`;
        }

        // Animate price change
        priceEl.style.opacity = '0';
        setTimeout(() => {
            priceEl.textContent = displayPrice;
            priceEl.style.opacity = '1';
        }, 150);
    }
}

function handlePlanSelection(event) {
    if (!currentUser) {
        alert("Please sign in to choose a plan.");
        // Here you would trigger your sign-in modal
        return;
    }
    const card = event.target.closest('.plan-card');
    selectedPlan = card.dataset.plan;
    
    populateModal();
    toggleModal(true);
}

function populateModal() {
    const planData = plans[selectedPlan];
    const totalCharge = billingCycle === 'monthly' ? planData.prices.monthly : Math.round(planData.prices.yearly);

    document.getElementById('modal-plan-name').textContent = planData.name;
    document.getElementById('modal-billing-cycle').textContent = billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1);
    document.getElementById('modal-total-charge').textContent = `₹${totalCharge}`;
    document.getElementById('modal-expiry-info').textContent = `Expiry: ${planData.expiry}`;

    if (billingCycle === 'yearly') {
        const firstAllocation = Math.floor(planData.credits / 12);
        document.getElementById('modal-credit-info-now').textContent = `Credits added now: ${firstAllocation} generations.`;
        document.getElementById('modal-credit-info-later').textContent = `Subsequent allocations: ${firstAllocation} generations per month for 11 months.`;
    } else {
        document.getElementById('modal-credit-info-now').textContent = `Credits to be added: ${planData.credits} generations.`;
        document.getElementById('modal-credit-info-later').textContent = '';
    }
}

function toggleModal(show) {
    if (show) {
        DOMElements.checkoutModal.classList.remove('opacity-0', 'invisible');
        DOMElements.checkoutModal.setAttribute('aria-hidden', 'false');
    } else {
        DOMElements.checkoutModal.classList.add('opacity-0', 'invisible');
        DOMElements.checkoutModal.setAttribute('aria-hidden', 'true');
    }
}


// --- Payment Logic ---

async function initiatePayment() {
    DOMElements.proceedToPaymentBtn.disabled = true;
    DOMElements.proceedToPaymentBtn.textContent = 'Processing...';

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                planId: selectedPlan,
                billingCycle: billingCycle
            })
        });

        if (!response.ok) throw new Error('Failed to create order.');

        const orderDetails = await response.json();
        
        const options = {
            key: orderDetails.key,
            amount: orderDetails.amount,
            currency: "INR",
            name: "GenArt",
            description: `Payment for ${plans[selectedPlan].name}`,
            order_id: orderDetails.id,
            subscription_id: orderDetails.subscription_id,
            handler: handlePaymentSuccess,
            prefill: {
                name: currentUser.displayName || "",
                email: currentUser.email || ""
            },
            notes: {
                userId: currentUser.uid,
                planId: selectedPlan,
                billingCycle: billingCycle
            },
            theme: { color: "#4F46E5" }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Payment Initiation Error:", error);
        alert("Could not start payment. Please try again.");
    } finally {
        DOMElements.proceedToPaymentBtn.disabled = false;
        DOMElements.proceedToPaymentBtn.textContent = 'Proceed to Secure Checkout';
    }
}

async function handlePaymentSuccess(response) {
    try {
        const token = await currentUser.getIdToken();
        const verificationResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                planId: selectedPlan,
                billingCycle: billingCycle
            })
        });

        if (!verificationResponse.ok) throw new Error('Payment verification failed.');

        alert('Payment successful! Your account will be updated shortly.');
        window.location.href = '/dashboard.html'; // Redirect to dashboard

    } catch (error) {
        console.error("Payment Verification Error:", error);
        alert("Payment verification failed. Please contact support.");
    }
}

