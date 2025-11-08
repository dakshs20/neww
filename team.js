// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Note: Firestore is not needed for this page, so it's omitted.

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

// --- Global State ---
let currentUser;
let currentUserCredits = 0; // We still track this for the header

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'auth-modal', 'google-signin-btn', 'new-user-credits-modal',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'scroll-to-collab-btn', 'scroll-to-collab-btn-2', 'collaboration-section'
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    
    // Select all buttons and other query-based elements
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.modalBackdrops = document.querySelectorAll('.modal-backdrop');

    initializeEventListeners();
    initializeAnimations();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
});

function initializeEventListeners() {
    // --- Authentication & Modal Listeners ---
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.modalBackdrops.forEach(backdrop => {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closeAllModals();
        });
    });

    // --- Mobile Menu & Header Scroll ---
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        header.classList.toggle('scrolled', window.scrollY > 10);
    });
    
    // --- Page-specific Scroll Listeners ---
    const scrollTarget = DOMElements.collaborationSection;
    if (scrollTarget) {
        const scrollToCollab = () => {
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        DOMElements.scrollToCollabBtn?.addEventListener('click', scrollToCollab);
        DOMElements.scrollToCollabBtn2?.addEventListener('click', scrollToCollab);
    }
}

// --- Animations ---
function initializeAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    gsap.registerPlugin(ScrollTrigger);

    // Hero Animation
    gsap.from(".team-hero-item", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.2
    });

    // Collaboration Section Animation
    gsap.from(".collab-item-text", {
        opacity: 0,
        x: -50,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: "#collaboration-section",
            start: "top 80%",
        }
    });
    gsap.from(".collab-item-visual", {
        opacity: 0,
        x: 50,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: "#collaboration-section",
            start: "top 80%",
        }
    });

    // Benefits Cards Animation
    gsap.from(".benefit-card", {
        opacity: 0,
        y: 40,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: ".benefit-card",
            start: "top 85%",
        }
    });
    
    // Testimonial Animation
    gsap.from(".team-testimonial-card", {
        opacity: 0,
        scale: 0.9,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: ".team-testimonial-card",
            start: "top 85%",
        }
    });

    // Final CTA Animation
    gsap.from(".team-cta-item", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: "#team-cta-section",
            start: "top 80%",
        }
    });
}


// --- Auth & Header UI Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;
    const linkClasses = "text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors";
    const mobileLinkClasses = "block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100";

    if (user) {
        // Logged-in state
        nav.innerHTML = `
            <a href="teams.html" class="${linkClasses} bg-[#517CBE]/10 text-[#517CBE]">For Teams</a>
            <a href="pricing.html" class="${linkClasses}">Pricing</a>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div>
            <button id="sign-out-btn-desktop" class="${linkClasses}">Sign Out</button>
        `;
        mobileNav.innerHTML = `
            <a href="teams.html" class="${mobileLinkClasses} bg-gray-100">For Teams</a>
            <a href="pricing.html" class="${mobileLinkClasses}">Pricing</a>
            <div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">Credits: ...</div>
            <button id="sign-out-btn-mobile" class="w-full text-left ${mobileLinkClasses}">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        // Logged-out state
        nav.innerHTML = `
            <a href="teams.html" class="${linkClasses} bg-[#517CBE]/10 text-[#517CBE]">For Teams</a>
            <a href="pricing.html" class="${linkClasses}">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>
        `;
        mobileNav.innerHTML = `
            <a href="teams.html" class="${mobileLinkClasses} bg-gray-100">For Teams</a>
            <a href="pricing.html" class="${mobileLinkClasses}">Pricing</a>
            <div class="p-4 mt-4">
                <button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
            </div>
        `;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        document.getElementById('sign-in-btn-mobile').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    }
}

async function fetchUserCredits(user) {
    try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (!response.ok) {
            let serverError;
            try {
                const errorData = await response.json();
                serverError = errorData.error || `Server responded with status ${response.status}`;
            } catch (e) {
                serverError = response.statusText || `Server responded with status ${response.status}`;
            }
            throw new Error(`Failed to fetch credits. Server says: "${serverError}"`);
        }

        const data = await response.json();
        currentUserCredits = data.credits;
        updateCreditsDisplay(currentUserCredits);

        if (data.isNewUser) {
            setTimeout(() => {
                toggleModal(DOMElements.newUserCreditsModal, true);
            }, 1000); 
        }
        
    } catch (error) {
        console.error("Error fetching credits:", error);
        updateCreditsDisplay('Error');
    }
}

function updateCreditsDisplay(amount) {
    const creditsCounter = document.getElementById('credits-counter');
    const creditsCounterMobile = document.getElementById('credits-counter-mobile');
    if (creditsCounter) creditsCounter.textContent = `Credits: ${amount}`;
    if (creditsCounterMobile) creditsCounterMobile.textContent = `Credits: ${amount}`;
}

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => modal.setAttribute('aria-hidden', 'false'), 10);
    } else {
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function closeAllModals() {
    document.querySelectorAll('[role="dialog"]').forEach(modal => toggleModal(modal, false));
}

async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
        closeAllModals();
    } catch (error)
    {
        console.error("Google Sign-In Error:", error);
    }
}
