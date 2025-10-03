// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- Plan Details (Source of Truth) ---
const planDetails = {
    'starter': { name: 'Starter', credits: 575 },
    'pro': { name: 'Pro', credits: 975 },
    'elite': { name: 'Elite', credits: 1950 },
};

// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once to avoid repeated lookups
    DOMElements.headerAuthSection = document.getElementById('header-auth-section');
    DOMElements.mobileMenu = document.getElementById('mobile-menu');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.heroSection = document.getElementById('hero-section');
    DOMElements.planCards = document.querySelectorAll('.plan-card');
    DOMElements.ctaBtns = document.querySelectorAll('.cta-btn');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    DOMElements.menuOpenIcon = document.getElementById('menu-open-icon');
    DOMElements.menuCloseIcon = document.getElementById('menu-close-icon');

    initializeEventListeners();
    initializeCursor();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.authModal?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.mobileMenuBtn?.addEventListener('click', toggleMobileMenu);

    DOMElements.ctaBtns.forEach(btn => {
        btn.addEventListener('click', (event) => handleCtaClick(event));
    });
}

// --- Core UI & State Management ---

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.classList.remove('opacity-0', 'invisible');
    } else {
        modal.classList.add('opacity-0', 'invisible');
    }
}

function toggleMobileMenu() {
    const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
    DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
    DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
}

async function updateUIForAuthState(user) {
    if (user) {
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error("Failed to fetch user data");
            
            const userData = await response.json();
            renderLoggedInState(user, userData);

        } catch (error) {
            console.error("Error fetching user data:", error);
            renderLoggedOutState(); // Fallback to logged out state on error
        }
    } else {
        renderLoggedOutState();
    }
}

function renderLoggedInState(user, userData) {
    const { plan, credits, nextBilling } = userData;
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    const totalCredits = planDetails[plan]?.credits;

    // --- Update Header ---
    DOMElements.headerAuthSection.innerHTML = `
        <span class="plan-badge ${plan}">${planName}</span>
        <div id="generation-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ${credits}</div>
        <button id="auth-btn" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-1.5 rounded-full hover:bg-gray-100 transition-colors">Sign Out</button>
    `;
    DOMElements.headerAuthSection.querySelector('#auth-btn').addEventListener('click', () => signOut(auth));

    // --- Update Mobile Menu ---
    DOMElements.mobileMenu.innerHTML = `
        <div class="p-4 text-center">
            <span class="plan-badge ${plan}">${planName}</span>
            <div id="mobile-generation-counter" class="text-lg font-semibold my-3">Credits: ${credits}</div>
            <button id="mobile-auth-btn" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>
        </div>
    `;
    DOMElements.mobileMenu.querySelector('#mobile-auth-btn').addEventListener('click', () => signOut(auth));


    // --- Update Hero Section ---
    if (plan === 'free') {
        DOMElements.heroSection.innerHTML = `
            <div class="hero-summary">
                <span><span class="plan-badge free">Plan: Free</span> • Free images in 30 s • Upgrade anytime</span>
            </div>
        `;
    } else {
        const nextBillingDate = nextBilling ? new Date(nextBilling).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A';
        DOMElements.heroSection.innerHTML = `
             <div class="hero-summary">
                <span>Plan: <strong class="capitalize">${plan}</strong></span>
                <span class="hero-credit-balance"><span class="remaining">${credits}</span><span class="total"> / ${totalCredits} credits remaining</span></span>
                <span>Next renewal: <strong>${nextBillingDate}</strong></span>
            </div>
        `;
    }

    // --- Update Plan Cards ---
    DOMElements.planCards.forEach(card => {
        const cardPlan = card.dataset.plan;
        card.classList.remove('active');
        const cta = card.querySelector('.cta-btn');
        if (cta) cta.disabled = false;

        if (cardPlan === plan) {
            card.classList.add('active');
            if(cta) {
                cta.textContent = 'Current Plan';
                cta.classList.add('current');
                cta.disabled = true;
            }
        } else {
            if(cta) {
                cta.classList.remove('current');
                const priceText = card.querySelector('.price')?.textContent || '';
                cta.textContent = `Upgrade`;
                 if(priceText.includes('month')) {
                    cta.textContent += ` — ${priceText.split('/')[0].trim()}`;
                }
            }
        }
    });
    
    document.getElementById('plan-free').classList.toggle('active', plan === 'free');

}

function renderLoggedOutState() {
    // --- Update Header ---
    DOMElements.headerAuthSection.innerHTML = `
        <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Pricing</a>
        <button id="auth-btn" class="text-sm font-medium bg-slate-800 text-white px-4 py-1.5 rounded-full hover:bg-slate-900 transition-colors">Sign In</button>
    `;
    DOMElements.headerAuthSection.querySelector('#auth-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));

    // --- Update Mobile Menu ---
    DOMElements.mobileMenu.innerHTML = `
        <div class="p-4">
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
            <div class="p-4 mt-4">
                <button id="mobile-auth-btn" class="w-full text-lg font-semibold bg-slate-800 text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
            </div>
        </div>
    `;
    DOMElements.mobileMenu.querySelector('#mobile-auth-btn').addEventListener('click', () => toggleModal(DOMElements.authModal, true));

    // --- Update Hero ---
    DOMElements.heroSection.innerHTML = `
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
        <p class="text-lg md:text-xl text-gray-500">
             <a href="#" id="hero-signin-link" class="text-blue-600 font-semibold hover:underline">Sign in</a> to see your plan and remaining credits.
        </p>
    `;
    DOMElements.heroSection.querySelector('#hero-signin-link').addEventListener('click', (e) => {
        e.preventDefault();
        toggleModal(DOMElements.authModal, true)
    });

    // --- Reset Plan Cards ---
    DOMElements.planCards.forEach(card => {
        card.classList.remove('active');
        const cta = card.querySelector('.cta-btn');
        if (cta) {
            cta.disabled = false;
            cta.classList.remove('current');
            if (cta.dataset.plan) {
                 cta.textContent = 'Sign in to subscribe';
            } else {
                 cta.textContent = 'Start free';
            }
        }
    });
}

function handleCtaClick(event) {
    const clickedButton = event.currentTarget;
    const plan = clickedButton.dataset.plan;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (plan) {
        handlePurchase(plan, clickedButton);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            alert("Failed to sign in. Please try again.");
        });
}

async function handlePurchase(plan, button) {
    const originalButtonText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `Server Error: ${response.status}`);
        }

        const { paymentData } = await response.json();
        redirectToPayU(paymentData);

    } catch (error) {
        console.error('Payment initiation failed:', error);
        alert(`Could not start the payment process: ${error.message}. Please try again.`);
        button.disabled = false;
        button.innerHTML = originalButtonText;
    }
}

function redirectToPayU(data) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://secure.payu.in/_payment'; 

    for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        }
    }

    document.body.appendChild(form);
    form.submit();
}

// --- Utility: Custom Cursor ---
function initializeCursor() {
    if (!DOMElements.cursorDot || !DOMElements.cursorOutline) return;
    
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        DOMElements.cursorDot.style.left = `${mouseX}px`;
        DOMElements.cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline.classList.remove('cursor-hover'));
    });
}
