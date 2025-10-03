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
    DOMElements.heroSection = document.getElementById('hero-section');


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
    
    const welcomeModalCloseBtn = DOMElements.welcomeCreditsModal.querySelector('.close-modal-btn');
    if(welcomeModalCloseBtn) {
        welcomeModalCloseBtn.addEventListener('click', () => {
            toggleModal(DOMElements.welcomeCreditsModal, false);
        });
    }
}

function toggleMobileMenu() {
    const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
    DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
    DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
}

function toggleModal(modal, show) {
    if (!modal) return;
    // Check if the modal is inside the pricing.html context before manipulating style
    if (document.body.contains(modal)) {
        if (show) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.remove('opacity-0', 'invisible'), 10);
        } else {
            modal.classList.add('opacity-0', 'invisible');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }
}


async function updateUIForAuthState(user) {
    const headerAuth = DOMElements.headerAuthSection;
    const mobileMenu = DOMElements.mobileMenu;

    if (user) {
        try {
            const token = await user.getIdToken(true);
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Could not load your subscription details. Please refresh the page.');
            
            const userData = await response.json();
            const { plan, credits, isNewUser } = userData;
            const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

            // Render Desktop Header
            headerAuth.innerHTML = `
                <a href="/pricing" class="text-sm font-medium text-gray-900">Pricing</a>
                <span class="text-sm font-semibold text-gray-800 bg-slate-200/80 rounded-full px-3 py-1">Plan: ${planName}</span>
                <div id="generation-counter" class="text-sm font-medium text-gray-700">Credits: ${credits}</div>
                <button id="auth-btn" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">Sign Out</button>
            `;

            // Render Mobile Menu
            mobileMenu.innerHTML = `
                <div class="p-2">
                    <a href="/pricing" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Pricing</a>
                    <div class="px-2 py-2 text-sm text-center text-gray-600 font-semibold">Plan: ${planName}</div>
                    <div id="mobile-generation-counter" class="px-2 py-2 text-sm text-center text-gray-600">Credits: ${credits}</div>
                    <button id="mobile-auth-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Sign Out</button>
                </div>
            `;
            
            // Show welcome modal for new users
            if (isNewUser) {
                toggleModal(DOMElements.welcomeCreditsModal, true);
            }

            // Update plan cards on pricing page
            updatePlanCardsUI(plan);
            updateHeroUI(true, {plan, credits});


        } catch (error) {
            console.error("Error fetching user data:", error);
            headerAuth.innerHTML = `<div class="text-sm text-red-500">${error.message}</div>`;
        }
    } else {
        // Render Logged Out State
        headerAuth.innerHTML = `
            <a href="/pricing" class="text-sm font-medium text-gray-900">Pricing</a>
            <button id="auth-btn" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">Sign In</button>
        `;
        mobileMenu.innerHTML = `
             <div class="p-2">
                <a href="/pricing" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Pricing</a>
                <div class="border-t my-1"></div>
                <button id="mobile-auth-btn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Sign In</button>
            </div>
        `;
        updatePlanCardsUI(null);
        updateHeroUI(false);
    }
    
    // Re-add event listeners to new elements
    addAuthEventListeners();
}

function updatePlanCardsUI(currentPlan) {
     DOMElements.planCards.forEach(card => {
        const cardPlan = card.dataset.plan;
        card.classList.remove('active');
        const cta = card.querySelector('.cta-btn');
        cta.disabled = false;
        cta.classList.remove('current');

        if (currentPlan) {
            if (cardPlan === currentPlan) {
                card.classList.add('active');
                cta.textContent = 'Your Current Plan';
                cta.classList.add('current');
                cta.disabled = true;
            } else {
                 cta.textContent = currentPlan === 'free' ? 'Upgrade Plan' : 'Change Plan';
            }
        } else {
            // Logged out state
            cta.textContent = 'Get Started';
        }
    });
}

function updateHeroUI(isLoggedIn, userData = {}) {
    if (isLoggedIn) {
        if (userData.plan === 'free') {
            DOMElements.heroSection.innerHTML = `
                 <h1 class="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">You are on the Free Plan</h1>
                 <p class="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">You have ${userData.credits} credits remaining. Upgrade to get more!</p>
            `;
        } else {
            DOMElements.heroSection.innerHTML = `
                <h1 class="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">Welcome back!</h1>
                <p class="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">You are on the <span class="capitalize font-bold">${userData.plan}</span> plan with ${userData.credits} credits.</p>
            `;
        }
    } else {
         DOMElements.heroSection.innerHTML = `
             <h1 class="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">Simple, credit-based pricing</h1>
             <p class="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
                 <a href="#" id="hero-signin-link" class="text-blue-600 font-semibold hover:underline">Sign in</a> to get 10 free credits and get started.
             </p>
        `;
        const signInLink = document.getElementById('hero-signin-link');
        if(signInLink) {
            signInLink.addEventListener('click', (e) => {
                e.preventDefault();
                toggleModal(DOMElements.authModal, true);
            });
        }
    }
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

