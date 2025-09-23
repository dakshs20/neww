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
        animateVision();
        animateFeatures();
        animateTeam();
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
    const headlineSpans = gsap.utils.toArray("#hero-headline span");

    headlineSpans.forEach(span => {
        const chars = span.textContent.split('').map(char => {
            const isWhitespace = char.trim() === '';
            return `<span class="char" style="display: inline-block; ${isWhitespace ? 'width: 0.25em;' : ''}">${char}</span>`;
        }).join('');
        span.innerHTML = chars;
    });

    const chars = gsap.utils.toArray(".char");

    gsap.timeline({ delay: 0.3 })
        .from(chars, {
            duration: 1.5,
            opacity: 0,
            y: 80,
            rotationX: -90,
            transformOrigin: "top",
            ease: "expo.out",
            stagger: {
                amount: 0.5,
                from: "random"
            },
        })
        .to("#hero-subline", {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: "expo.out"
        }, "-=1.2");
}

function animateVision() {
    gsap.timeline({
        scrollTrigger: { trigger: "#vision-section", start: "top 60%" }
    })
    .to(".title-underline", { scaleX: 1, duration: 1, ease: "expo.out" })
    .to(".section-paragraph", { opacity: 1, y: 0, stagger: 0.2, duration: 0.8, ease: "power3.out" }, "-=0.7");
    
    const images = gsap.utils.toArray('.vision-image');
    if (images.length > 0) {
        let currentIndex = 0;
        const crossfadeImages = () => {
            images.forEach((img, index) => {
                img.classList.toggle('active', index === currentIndex);
            });
            currentIndex = (currentIndex + 1) % images.length;
        };
        crossfadeImages(); // Show first image immediately
        setInterval(crossfadeImages, 3500);
    }
}

function animateFeatures() {
    const featureItems = gsap.utils.toArray('.feature-item');
    featureItems.forEach(item => {
        gsap.to(item, {
            opacity: 1,
            scrollTrigger: {
                trigger: item,
                start: "top 75%",
                end: "bottom 75%",
                scrub: true,
                toggleClass: "is-inview",
            }
        });
    });
}

function animateTeam() {
    gsap.to(".team-card", {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "expo.out",
        scrollTrigger: { trigger: ".team-card", start: "top 85%" }
    });
}

function animateCTA() {
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#cta-section",
            start: "top 50%",
            end: "bottom bottom",
            scrub: 1.2,
        }
    });
    tl.to("#cta-headline", { opacity: 1, y: 0 })
      .to("#cta-button", { opacity: 1, y: 0, scale: 1 }, "-=0.2");
}

