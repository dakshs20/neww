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
        initHeroCanvas();
        animateHero();
        animateMission();
        animateTech();
        animateExplore();
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

function initHeroCanvas() {
    const container = document.getElementById('hero-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const particlesCount = 5000;
    const positions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 10;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.015,
        color: 0x517CBE,
    });
    
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    camera.position.z = 5;
    
    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    const clock = new THREE.Clock();
    const animate = () => {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        particles.rotation.y = elapsedTime * 0.05;
        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05;
        renderer.render(scene, camera);
    };
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function animateHero() {
    const tl = gsap.timeline({ delay: 0.3 });
    tl.to(".hero-headline .animated-word", { y: 0, stagger: 0.1, duration: 1.2, ease: "expo.out" })
      .fromTo(".hero-subline", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, "-=0.8");
}

function animateMission() {
    gsap.from(".mission-card", {
        opacity: 0,
        y: 30,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: ".mission-section", start: "top 70%" }
    });
}

function animateTech() {
    const tl = gsap.timeline({
        scrollTrigger: { trigger: ".tech-section", start: "top 70%" }
    });
    tl.from(".section-title, .section-subtitle", { opacity: 0, y: 20, duration: 1, ease: "expo.out" })
      .from(".tech-card", { opacity: 0, y: 30, stagger: 0.1, duration: 0.8, ease: "power2.out" }, "-=0.5");
}

function animateExplore() {
    const trigger = ".explore-section";
    gsap.from(gsap.utils.toArray('.explore-section .section-title, .explore-card'), {
        opacity: 0,
        y: 30,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: trigger, start: "top 70%" }
    });
}

function animateCTA() {
    const ctaSection = document.querySelector(".cta-section");
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: ctaSection,
            start: "top 70%",
            onEnter: () => ctaSection.classList.add('is-active')
        }
    });
    tl.from(".cta-headline", { opacity: 0, y: 30, duration: 1, ease: "expo.out" })
      .from(".cta-button", { opacity: 0, scale: 0.9, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.7");
}

