// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

setPersistence(auth, browserLocalPersistence)
  .catch((error) => console.error("Firebase persistence error:", error.code, error.message));

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    DOMElements.headerAuthSection = document.getElementById('header-auth-section');
    DOMElements.mobileMenu = document.getElementById('mobile-menu');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.querySelector('#auth-modal .close-modal-btn');
    DOMElements.ctaBtns = document.querySelectorAll('.cta-btn');
    DOMElements.planCards = document.querySelectorAll('.plan-card');
    DOMElements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    DOMElements.menuOpenIcon = document.getElementById('menu-open-icon');
    DOMElements.menuCloseIcon = document.getElementById('menu-close-icon');
    DOMElements.faqItems = document.querySelectorAll('.faq-item');
    DOMElements.welcomeCreditsModal = document.getElementById('welcome-credits-modal');


    initializeEventListeners();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.authModal?.addEventListener('click', (e) => {
        if (e.target === DOMElements.authModal) toggleModal(DOMElements.authModal, false);
    });
    DOMElements.mobileMenuBtn?.addEventListener('click', toggleMobileMenu);

    DOMElements.ctaBtns.forEach(btn => {
        btn.addEventListener('click', handleCtaClick);
    });

    DOMElements.faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        question.addEventListener('click', () => {
            const isOpen = item.classList.toggle('open');
            if (isOpen) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
                answer.style.paddingTop = '0.5rem';
                answer.style.paddingBottom = '1.25rem';
            } else {
                answer.style.maxHeight = '0';
                answer.style.paddingTop = '0';
                answer.style.paddingBottom = '0';
            }
        });
    });
    
    DOMElements.welcomeCreditsModal.querySelector('.close-modal-btn').addEventListener('click', () => {
        toggleModal(DOMElements.welcomeCreditsModal, false);
    });
}

function toggleMobileMenu() {
    const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
    DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
    DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
}

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.remove('opacity-0', 'invisible'), 10);
    } else {
        modal.classList.add('opacity-0', 'invisible');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

async function updateUIForAuthState(user) {
    if (user) {
        renderInitialLoggedInHeader();
        try {
            const token = await user.getIdToken(true);
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch user data');
            const userData = await response.json();
            renderDetailedLoggedInUI(userData);
            if(userData.isNewUser) {
                toggleModal(DOMElements.welcomeCreditsModal, true);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            document.getElementById('generation-counter').textContent = "Error loading credits";
        }
    } else {
        renderLoggedOutState();
    }
}

function renderInitialLoggedInHeader() {
    // Desktop
    DOMElements.headerAuthSection.innerHTML = `
        <a href="/pricing" class="text-sm font-medium text-gray-900">Pricing</a>
        <div id="plan-display" class="text-sm font-medium text-gray-500"></div>
        <div id="generation-counter" class="text-sm font-medium text-gray-500">Loading...</div>
        <button id="auth-btn" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">Sign Out</button>
    `;
    // Mobile
    DOMElements.mobileMenu.innerHTML = `
        <div class="p-2">
            <a href="/pricing" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Pricing</a>
            <div id="mobile-plan-display" class="px-2 py-2 text-sm text-center text-gray-600"></div>
            <div id="mobile-generation-counter" class="px-2 py-2 text-sm text-center text-gray-600">Loading...</div>
            <button id="mobile-auth-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Sign Out</button>
        </div>
    `;
    addAuthEventListeners();
}

function renderDetailedLoggedInUI(userData) {
    const { plan, credits } = userData;
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

    // Update plan and credit counters
    document.getElementById('plan-display').textContent = `Plan: ${planName}`;
    document.getElementById('generation-counter').textContent = `Credits: ${credits}`;
    document.getElementById('mobile-plan-display').textContent = `Plan: ${planName}`;
    document.getElementById('mobile-generation-counter').textContent = `Credits: ${credits}`;

    // Update plan cards
    DOMElements.planCards.forEach(card => {
        const cardPlan = card.dataset.plan;
        card.classList.remove('active');
        const cta = card.querySelector('.cta-btn');
        cta.disabled = false;
        cta.classList.remove('current');

        if (cardPlan === plan) {
            card.classList.add('active');
            cta.textContent = 'Your Current Plan';
            cta.classList.add('current');
            cta.disabled = true;
        } else {
             cta.textContent = plan === 'free' ? 'Upgrade Plan' : 'Change Plan';
        }
    });
}

function renderLoggedOutState() {
    // Desktop
    DOMElements.headerAuthSection.innerHTML = `
        <a href="/pricing" class="text-sm font-medium text-gray-900">Pricing</a>
        <button id="auth-btn" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">Sign In</button>
    `;
    // Mobile
    DOMElements.mobileMenu.innerHTML = `
        <div class="p-2">
            <a href="/pricing" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Pricing</a>
            <button id="mobile-auth-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Sign In</button>
        </div>
    `;
    addAuthEventListeners();

     // Reset plan cards
    DOMElements.planCards.forEach(card => {
        card.classList.remove('active');
        const cta = card.querySelector('.cta-btn');
        cta.textContent = 'Get Started';
        cta.disabled = false;
        cta.classList.remove('current');
    });
}

function addAuthEventListeners() {
    document.getElementById('auth-btn')?.addEventListener('click', handleAuthAction);
    document.getElementById('mobile-auth-btn')?.addEventListener('click', handleAuthAction);
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function handleCtaClick(event) {
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    handlePurchase(event);
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            alert("Failed to sign in. Please try again.");
        });
}

async function handlePurchase(event) {
    const clickedButton = event.currentTarget;
    const plan = clickedButton.dataset.plan;

    if (!plan || plan === 'free') return;

    const originalButtonText = clickedButton.innerHTML;
    clickedButton.disabled = true;
    clickedButton.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/payu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        clickedButton.disabled = false;
        clickedButton.innerHTML = originalButtonText;
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

