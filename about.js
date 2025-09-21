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

    // Typewriter Animation
    const words = ["imagination.", "visuals.", "reality."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });

    // Fade-in Sections
    gsap.utils.toArray('.fade-in-section').forEach(section => {
        gsap.fromTo(section, 
            { opacity: 0, y: 50 },
            {
                opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                    onEnter: () => section.classList.add('is-visible')
                }
            }
        );
    });
    
    // Timeline Comparison Animation
    ScrollTrigger.create({
        trigger: "#timeline-comparison",
        start: "top 80%",
        onEnter: () => {
            gsap.to("#traditional-bar", { width: "100%", duration: 1.5, ease: "power2.inOut" });
            gsap.to("#genart-bar", { width: "5%", duration: 1.5, ease: "power2.inOut", delay: 0.2 });
        }
    });
    
    // Tech Flow SVG Animation
    ScrollTrigger.create({
        trigger: "#tech-flow-svg",
        start: "top 75%",
        onEnter: () => document.getElementById('tech-flow-svg').classList.add('is-animating')
    });


    // Counters Animation
    gsap.utils.toArray('.counter').forEach(counter => {
        const target = +counter.dataset.target;
        const obj = { value: 0 };
        gsap.to(obj, {
            value: target,
            duration: 2.5,
            ease: 'power3.out',
            onUpdate: () => {
                counter.textContent = Math.round(obj.value);
            },
            scrollTrigger: {
                trigger: counter,
                start: 'top 90%'
            }
        });
    });

    // Roadmap Timeline Animation
    const roadmapItems = gsap.utils.toArray('.roadmap-item');
    gsap.to("#roadmap-line-progress", {
      width: "100%",
      scrollTrigger: {
        trigger: "#roadmap",
        start: "top center",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: (self) => {
            const progress = self.progress;
            const step = 1 / (roadmapItems.length - 1);
             roadmapItems.forEach((item, i) => {
                if (progress >= i * step) {
                    item.classList.add('is-active');
                } else {
                    item.classList.remove('is-active');
                }
            });
        }
      }
    });
    
     // Founder's Note Underline Animation
     ScrollTrigger.create({
        trigger: "#founder-note",
        start: "top 80%",
        onEnter: () => document.getElementById('founder-note').classList.add('is-visible')
    });

});

