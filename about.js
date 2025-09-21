// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Header Authentication ---
    const headerNav = document.getElementById('header-nav');

    function updateUIForAuthState(user) {
        if (user) {
            headerNav.innerHTML = `
                <a href="index.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Generator</a>
                <button id="sign-out-btn" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Sign Out</button>
            `;
            document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        } else {
            headerNav.innerHTML = `
                <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
                <button id="sign-in-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-colors">Sign In</button>
            `;
            document.getElementById('sign-in-btn').addEventListener('click', () => signInWithPopup(auth, provider));
        }
    }
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    // --- Animations ---
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
        // Hero Headline Animation (staggered fade-in)
        gsap.from("#hero-headline span", {
            duration: 0.8,
            opacity: 0,
            y: 20,
            ease: "power3.out",
            stagger: 0.05,
            delay: 0.2
        });

        // Intersection Observer for fade-in sections and counters
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Animate counters
                    if (entry.target.classList.contains('counter')) {
                        const target = +entry.target.dataset.target;
                        const counter = { value: 0 };
                        gsap.to(counter, {
                            duration: 2,
                            value: target,
                            onUpdate: () => {
                                entry.target.textContent = Math.ceil(counter.value);
                            },
                            ease: "power2.out"
                        });
                    }
                    
                    // Fade in other sections
                    if (entry.target.classList.contains('fade-in-section')) {
                         entry.target.classList.add('is-visible');
                    }

                    // Stop observing once the animation has been triggered
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px',
            threshold: 0.15
        });

        // Observe all counters and fade-in sections
        document.querySelectorAll('.counter, .fade-in-section').forEach(el => {
            observer.observe(el);
        });
    } else {
        // For reduced motion, just make sure counters have their final value
        document.querySelectorAll('.counter').forEach(counter => {
            counter.textContent = counter.dataset.target;
        });
    }
});
