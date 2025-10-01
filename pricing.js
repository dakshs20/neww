import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const plans = {
    create: {
        name: 'Create',
        monthly: { price: 798, credits: 575 },
        yearly: { price: 7980, credits: 575 },
        features: {
            "Image Resolution": "Standard",
            "Generation Speed": "~17s",
            "Commercial License": true,
            "Support": "Standard"
        }
    },
    elevate: {
        name: 'Elevate',
        monthly: { price: 1596, credits: 975 },
        yearly: { price: 15960, credits: 975 },
        features: {
            "Image Resolution": "High",
            "Generation Speed": "~17s",
            "Commercial License": true,
            "Support": "Priority"
        }
    },
    pro: {
        name: 'Pro',
        monthly: { price: 2571, credits: 1950 },
        yearly: { price: 25710, credits: 1950 },
        features: {
             "Image Resolution": "Highest (4K+)",
            "Generation Speed": "Fastest",
            "Commercial License": true,
            "Support": "Dedicated"
        }
    }
};

const faqData = [
    { question: "How do credits work?", answer: "One credit allows you to generate one image at standard resolution. Higher resolution images may consume more credits. Your monthly credits are added to your account automatically after each successful subscription payment." },
    { question: "Can I cancel my subscription anytime?", answer: "Yes, you can cancel your subscription at any time from your account settings. You will retain access to your credits until the end of your current billing period." },
    { question: "What happens if I use all my credits?", answer: "If you run out of credits, you can upgrade to a higher plan to get more credits immediately. One-time credit packs will also be available for purchase soon." },
    { question: "What payment methods do you accept?", answer: "We accept all major credit cards, debit cards, UPI, and other popular payment methods through our secure payment partner, Razorpay." }
];

const DOMElements = {
    billingToggle: document.getElementById('billing-toggle'),
    pricingCards: document.querySelectorAll('.pricing-card'),
    monthlyLabel: document.getElementById('monthly-label'),
    yearlyLabel: document.getElementById('yearly-label'),
    authBtn: document.getElementById('auth-btn'),
    mobileAuthBtn: document.getElementById('mobile-auth-btn'),
    authModal: document.getElementById('auth-modal'),
    googleSignInBtn: document.getElementById('google-signin-btn'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    generationCounter: document.getElementById('generation-counter'),
    mobileGenerationCounter: document.getElementById('mobile-generation-counter'),
    selectPlanBtns: document.querySelectorAll('.select-plan-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    userPlanDisplayContainer: document.getElementById('user-plan-display-container'),
    userPlanDisplay: document.getElementById('user-plan-display'),
    featuresTable: document.getElementById('features-table'),
    faqContainer: document.getElementById('faq-container'),
};

const fetchUserPlan = async (token) => {
    const response = await fetch('/api/get-subscription', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        console.error("Failed to fetch user plan");
        return { plan: 'Free Plan' };
    }
    const data = await response.json();
    return { plan: data.planName };
};

const updatePricing = (isYearly) => {
    DOMElements.monthlyLabel.classList.toggle('text-brand', !isYearly);
    DOMElements.yearlyLabel.classList.toggle('text-brand', isYearly);

    DOMElements.pricingCards.forEach(card => {
        const planName = card.dataset.plan;
        const planData = plans[planName];
        if (!planData) return;

        const currentCycle = isYearly ? 'yearly' : 'monthly';
        const newPrice = planData[currentCycle].price;
        const periodText = isYearly ? '/year' : '/month';
        
        const priceEl = card.querySelector('.price-amount');
        const periodEl = card.querySelector('.price-period');
        
        animateValue(priceEl, parseInt(priceEl.innerText.replace(/,/g, '')), newPrice, 300);
        periodEl.textContent = periodText;
    });
};

const handleAuthAction = () => auth.currentUser ? signOut(auth) : toggleModal(DOMElements.authModal, true);
const signInWithGoogle = () => signInWithPopup(auth, provider).then(() => toggleModal(DOMElements.authModal, false)).catch(console.error);

const updateUIForAuthState = async (user) => {
    const signedIn = !!user;
    DOMElements.authBtn.textContent = signedIn ? 'Sign Out' : 'Sign In';
    DOMElements.mobileAuthBtn.textContent = signedIn ? 'Sign Out' : 'Sign In';
    DOMElements.userPlanDisplayContainer.classList.toggle('hidden', !signedIn);

    if (signedIn) {
        try {
            const token = await user.getIdToken();
            const [creditsResponse, planResponse] = await Promise.all([
                fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetchUserPlan(token)
            ]);

            if (creditsResponse.ok) {
                const data = await creditsResponse.json();
                DOMElements.generationCounter.textContent = `Credits: ${data.credits}`;
                DOMElements.mobileGenerationCounter.textContent = `Credits: ${data.credits}`;
            } else { throw new Error("Failed to fetch credits"); }

            const planName = planResponse.plan || 'Free Plan';
            if (planName !== 'Free') {
                DOMElements.userPlanDisplay.textContent = `${planName} Plan`;
            } else {
                DOMElements.userPlanDisplayContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            DOMElements.generationCounter.textContent = "Credits: Error";
        }
    } else {
        DOMElements.generationCounter.textContent = 'Sign in for credits';
    }
};

async function handlePlanSelection(event) {
    const button = event.currentTarget;
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    
    const card = button.closest('.pricing-card');
    const planId = card.dataset.plan;
    const isYearly = DOMElements.billingToggle.checked;
    const cycle = isYearly ? 'yearly' : 'monthly';
    
    button.disabled = true;
    button.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/razorpay-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ plan: planId, cycle: cycle })
        });

        if (!response.ok) throw new Error(await response.text());
        const { subscription_id, razorpay_key_id } = await response.json();
        
        const rzp = new Razorpay({
            key: razorpay_key_id,
            subscription_id: subscription_id,
            name: 'GenArt Subscription',
            description: `GenArt ${plans[planId].name} - ${cycle}`,
            handler: () => {
                alert('Payment Successful! Your subscription is being processed.');
                window.location.href = '/settings.html';
            },
            modal: {
                ondismiss: function(){
                    button.disabled = false;
                    button.innerHTML = 'Select Plan';
                }
            },
            prefill: { name: auth.currentUser.displayName, email: auth.currentUser.email },
            theme: { color: '#3C5B8B' }
        });
        rzp.open();
    } catch (error) {
        console.error('Subscription failed:', error);
        alert(`Could not start the subscription. Please try again.`);
        button.disabled = false;
        button.innerHTML = 'Select Plan';
    }
}

const toggleModal = (modal, show) => {
    modal.style.display = show ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', !show);
};

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function buildFeaturesTable() {
    const features = [...new Set(Object.values(plans).flatMap(p => Object.keys(p.features)))];
    const checkIcon = `<svg class="w-6 h-6 mx-auto text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    
    let headHTML = `<thead class="bg-gray-50"><tr class="text-sm text-gray-600"><th class="py-4 px-4 font-semibold text-left">Features</th>`;
    Object.values(plans).forEach(plan => {
        headHTML += `<th class="py-4 px-4 font-semibold w-1/5 text-center">${plan.name}</th>`;
    });
    headHTML += `</tr></thead>`;

    let bodyHTML = `<tbody>`;
    features.forEach((feature) => {
        bodyHTML += `<tr class="border-b border-gray-200"><td class="py-4 px-4 font-medium">${feature}</td>`;
        Object.values(plans).forEach(plan => {
            const value = plan.features[feature];
            bodyHTML += `<td class="py-4 px-4 text-center text-sm font-medium text-gray-700">${value === true ? checkIcon : (value || '–')}</td>`;
        });
        bodyHTML += `</tr>`;
    });
    bodyHTML += `</tbody>`;
    DOMElements.featuresTable.innerHTML = headHTML + bodyHTML;
}

function buildFAQ() {
    let faqHTML = '';
    faqData.forEach(item => {
        faqHTML += `
            <div class="faq-item border-b border-gray-200">
                <button class="faq-question w-full flex justify-between items-center text-left py-5">
                    <span class="font-semibold text-gray-800 pr-4">${item.question}</span>
                    <svg class="faq-arrow w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div class="faq-answer">
                    <p class="pt-0 pb-5 pr-8 text-left text-gray-600 leading-relaxed">${item.answer}</p>
                </div>
            </div>
        `;
    });
    DOMElements.faqContainer.innerHTML = faqHTML;
    DOMElements.faqContainer.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.parentElement;
            
            const currentlyActive = document.querySelector('.faq-item.active');
            if (currentlyActive && currentlyActive !== parent) {
                currentlyActive.classList.remove('active');
            }

            parent.classList.toggle('active');
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    buildFeaturesTable();
    buildFAQ();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    
    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.billingToggle.addEventListener('change', (e) => updatePricing(e.target.checked));
    DOMElements.mobileMenuBtn?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
    DOMElements.selectPlanBtns.forEach(btn => btn.addEventListener('click', handlePlanSelection));
});
