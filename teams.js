document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const emailModal = document.getElementById('email-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const teamForm = document.getElementById('team-form');
    const emailInput = document.getElementById('email-input');
    const emailError = document.getElementById('email-error');
    const successMessage = document.getElementById('success-message');

    // All "Get Started" buttons will open the modal
    const getStartedButtons = [
        document.getElementById('get-started-header-btn'),
        document.getElementById('get-started-mobile-btn'),
        document.getElementById('get-started-hero-btn')
    ];

    // --- Event Listeners ---

    // Open modal when any "Get Started" button is clicked
    getStartedButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                emailModal.setAttribute('aria-hidden', 'false');
                teamForm.style.display = 'block';
                successMessage.style.display = 'none';
                emailInput.value = '';
                emailError.textContent = '';
            });
        }
    });

    // Close modal when the close button is clicked
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            emailModal.setAttribute('aria-hidden', 'true');
        });
    }

    // Close modal when clicking outside of it
    if (emailModal) {
        emailModal.addEventListener('click', (event) => {
            if (event.target === emailModal) {
                emailModal.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // Handle form submission
    if (teamForm) {
        teamForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission
            validateAndSubmit();
        });
    }

    // --- Functions ---

    function validateAndSubmit() {
        const email = emailInput.value.trim();
        const commonEmailProviders = [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
            'aol.com', 'icloud.com', 'protonmail.com', 'zoho.com'
        ];
        
        const domain = email.split('@')[1];

        if (!email) {
            emailError.textContent = 'Email address is required.';
            return;
        }

        // Simple regex for basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            emailError.textContent = 'Please enter a valid email format.';
            return;
        }

        // Check if the domain is a common free provider
        if (commonEmailProviders.includes(domain)) {
            emailError.textContent = 'Please use a business email address.';
            return;
        }

        // If validation passes
        emailError.textContent = '';
        console.log('Form submitted with email:', email);

        // Hide the form and show the success message
        teamForm.style.display = 'none';
        successMessage.style.display = 'block';

        // Optional: Automatically close the modal after a few seconds
        setTimeout(() => {
            emailModal.setAttribute('aria-hidden', 'true');
        }, 3000);
    }

    // --- Mobile Menu Logic from original script ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        document.addEventListener('click', (event) => {
            if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    // --- Cursor Logic from original script ---
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (cursorDot && cursorOutline) {
        let mouseX = 0, mouseY = 0;
        let outlineX = 0, outlineY = 0;
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        const animateCursor = () => {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
            const ease = 0.15;
            outlineX += (mouseX - outlineX) * ease;
            outlineY += (mouseY - outlineY) * ease;
            cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
            requestAnimationFrame(animateCursor);
        };
        requestAnimationFrame(animateCursor);

        const interactiveElements = document.querySelectorAll('a, button, input');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
            el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
        });
    }
});
