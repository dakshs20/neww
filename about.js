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
        document.querySelectorAll('.counter').forEach(c => c.textContent = c.dataset.target);
        return;
    }

    // Hero Animations
    gsap.from("#hero-headline", { opacity: 0, y: 20, duration: 0.8, ease: "power3.out", delay: 0.2 });
    gsap.from("#hero-subline", { opacity: 0, y: 20, duration: 0.8, ease: "power3.out", delay: 0.4 });
    const words = ["imagination.", "visuals.", "reality."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });

    // General Fade-in for all sections
    gsap.utils.toArray('.fade-in-section').forEach(section => {
        gsap.from(section, {
            opacity: 0,
            y: 50,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: section,
                start: 'top 85%',
                toggleActions: 'play none none none',
            }
        });
    });

    // "Why Speed Matters" Infographic Animation
    ScrollTrigger.create({
        trigger: "#speed-infographic",
        start: "top 80%",
        onEnter: () => {
            gsap.to("#traditional-icons .icon-step", {
                opacity: 1,
                scale: 1,
                stagger: 0.2,
                duration: 0.5,
                ease: "back.out(1.7)"
            });
            gsap.to("#genart-icons .icon-step", {
                opacity: 1,
                scale: 1,
                stagger: 0.2,
                duration: 0.5,
                delay: 1,
                ease: "back.out(1.7)"
            });
        }
    });

    // "AI Made Human" Tech Flow Animation
    const techTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".tech-card",
            start: "top center",
            toggleActions: "play none none reverse",
        }
    });
    techTl.staggerFromTo(".tech-list li", 0.5, { opacity: 0, x: -20 }, { opacity: 1, x: 0 }, 0.1)
          .to("#node-prompt circle", { fill: "#3b82f6" }, "-=0.5")
          .to(".connector-flow", { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" })
          .to("#node-model circle", { fill: "#3b82f6" }, "-=0.7")
          .to("#node-image circle", { fill: "#3b82f6" }, "-=0.2");


    // Counters Animation
    gsap.utils.toArray('.counter').forEach(counter => {
        gsap.from(counter, {
            textContent: 0,
            duration: 2,
            ease: 'power2.out',
            snap: { textContent: 1 },
            scrollTrigger: {
                trigger: counter,
                start: 'top 90%'
            }
        });
    });

    // Roadmap Timeline Animation
    const roadmapItems = gsap.utils.toArray('.roadmap-item');
    roadmapItems.forEach((item) => {
        ScrollTrigger.create({
            trigger: item,
            start: "top center",
            onEnter: () => item.classList.add("is-active"),
            onLeaveBack: () => item.classList.remove("is-active")
        });
    });
    
     // Founder's Note Underline Animation
     ScrollTrigger.create({
        trigger: "#founder-note",
        start: "top 80%",
        onEnter: () => document.getElementById('founder-note').classList.add('is-visible')
    });

});

