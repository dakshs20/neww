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
    
    gsap.registerPlugin(ScrollTrigger, TextPlugin);

    // --- Header Authentication ---
    const headerNav = document.getElementById('header-nav');
    function updateUIForAuthState(user) {
        if (user) {
            headerNav.innerHTML = `
                <a href="index.html" class="text-sm font-medium text-slate-300 hover:text-white transition-colors">Generator</a>
                <a href="about.html" class="text-sm font-medium text-white">About</a>
                <button id="sign-out-btn" class="text-sm font-medium text-slate-300 hover:text-white transition-colors">Sign Out</button>
            `;
            document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        } else {
            headerNav.innerHTML = `
                <a href="pricing.html" class="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</a>
                <a href="about.html" class="text-sm font-medium text-white">About</a>
                <button id="sign-in-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-colors">Sign In</button>
            `;
            document.getElementById('sign-in-btn').addEventListener('click', () => signInWithPopup(auth, provider));
        }
    }
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    // --- Animations ---
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.querySelectorAll('.counter, .counter-decimal').forEach(c => c.textContent = c.dataset.target);
        return;
    }

    // Hero Animations
    gsap.from("#hero-headline", { opacity: 0, y: 20, duration: 0.8, ease: "power3.out", delay: 0.2 });
    gsap.from("#hero-subline", { opacity: 0, y: 20, duration: 0.8, ease: "power3.out", delay: 0.4 });
    gsap.from("#hero-cta", { opacity: 0, y: 20, duration: 0.8, ease: "power3.out", delay: 0.6 });
    gsap.from(".micro-demo", { opacity: 0, scale: 0.95, duration: 0.8, ease: "power3.out", delay: 0.8 });

    const words = ["imagination.", "visuals.", "reality."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });
    
    // Animate Pipeline Cards
    gsap.to(".pipeline-card", {
        opacity: 1,
        y: 0,
        stagger: 0.2,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: ".pipeline-card",
            start: "top 85%",
        }
    });

    // Counters Animation
    gsap.utils.toArray('.counter').forEach(counter => {
        gsap.from(counter, {
            textContent: 0,
            duration: 2,
            ease: 'power2.out',
            snap: { textContent: 1 },
            scrollTrigger: { trigger: counter, start: 'top 90%' }
        });
    });
     gsap.utils.toArray('.counter-decimal').forEach(counter => {
        gsap.from(counter, {
            textContent: 0,
            duration: 2,
            ease: 'power2.out',
            snap: { textContent: 0.1 },
            scrollTrigger: { trigger: counter, start: 'top 90%' },
            onUpdate: function() {
                counter.textContent = parseFloat(this.targets()[0].textContent).toFixed(1);
            }
        });
    });

    // Roadmap Timeline Animation
    const roadmapItems = gsap.utils.toArray('.roadmap-item');
    roadmapItems.forEach((item) => {
        ScrollTrigger.create({
            trigger: item,
            start: "top center",
            end: "bottom center",
            toggleClass: "is-active"
        });
    });
});

