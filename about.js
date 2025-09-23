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

document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);
    setupHeader();

    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
        animateHero();
        animatePillars();
        setupHorizontalScroll();
        animateCTA();
    }
});

function setupHeader() {
    const headerNavContainer = document.getElementById('header-nav-container');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const menuOpenIcon = document.getElementById('menu-open-icon');
    const menuCloseIcon = document.getElementById('menu-close-icon');

    mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = mobileMenu.classList.toggle('hidden');
        menuOpenIcon.classList.toggle('hidden', !isHidden);
        menuCloseIcon.classList.toggle('hidden', isHidden);
    });

    onAuthStateChanged(auth, user => {
        const desktopNav = user ? `
            <a href="index.html" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors px-3 py-1">Generator</a>
            <button id="sign-out-desktop" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors px-3 py-1">Sign Out</button>` : `
            <a href="pricing.html" class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors px-3 py-1">Pricing</a>
            <button id="sign-in-desktop" class="text-sm font-semibold bg-slate-800 text-white px-4 py-2 rounded-full hover:bg-slate-900 transition-colors">Sign In</button>`;
        
        const mobileNav = user ? `
            <a href="index.html" class="mobile-nav-link">Generator</a>
            <a href="about.html" class="mobile-nav-link">About</a>
            <div class="border-t border-slate-200 my-2"></div>
            <button id="sign-out-mobile" class="mobile-nav-link w-full text-left">Sign Out</button>` : `
            <a href="pricing.html" class="mobile-nav-link">Pricing</a>
            <a href="about.html" class="mobile-nav-link">About</a>
            <div class="p-2 mt-4"><button id="sign-in-mobile" class="w-full text-base font-semibold text-white px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900">Sign In</button></div>`;

        headerNavContainer.innerHTML = desktopNav;
        mobileMenu.innerHTML = mobileNav;

        if (user) {
            document.getElementById('sign-out-desktop').addEventListener('click', () => signOut(auth));
            document.getElementById('sign-out-mobile').addEventListener('click', () => signOut(auth));
        } else {
            document.getElementById('sign-in-desktop').addEventListener('click', () => signInWithPopup(auth, provider));
            document.getElementById('sign-in-mobile').addEventListener('click', () => signInWithPopup(auth, provider));
        }
    });
}

function animateHero() {
    gsap.timeline({ delay: 0.2 })
        .to(".hero-headline .animated-line > *", {
            y: 0,
            duration: 1,
            ease: "expo.out",
            stagger: 0.1
        })
        .to(".hero-subline", {
            opacity: 1,
            duration: 1,
            ease: "power2.out"
        }, "-=0.5");
}

function animatePillars() {
    gsap.to(".pillar-card", {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "expo.out",
        stagger: 0.15,
        scrollTrigger: {
            trigger: ".pillars-section",
            start: "top 70%",
        }
    });
}

function setupHorizontalScroll() {
    const showcaseTrack = document.querySelector(".showcase-track");
    if (!showcaseTrack) return;

    const scrollAmount = showcaseTrack.offsetWidth - window.innerWidth;

    gsap.to(showcaseTrack, {
        x: -scrollAmount,
        ease: "none",
        scrollTrigger: {
            trigger: "#showcase-section",
            start: "top top",
            end: () => `+=${scrollAmount}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
        }
    });
}


function animateCTA() {
    const ctaElements = ['.cta-headline', '.cta-subline', '.cta-button'];
    gsap.to(ctaElements, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "expo.out",
        stagger: 0.2,
        scrollTrigger: {
            trigger: ".cta-section",
            start: "top 70%",
        }
    });
}

