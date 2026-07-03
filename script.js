// ============================================
// MOBILE NAVIGATION TOGGLE
// ============================================

const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

// Toggle mobile menu
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when a link is clicked
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-container')) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// ============================================
// SMOOTH SCROLLING FOR ANCHOR LINKS
// ============================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            document.querySelector(href).scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// ============================================
// SHOP "GET ACCESS" BUTTONS -> STRIPE CHECKOUT
// ============================================

document.querySelectorAll('.btn-shop').forEach(button => {
    const originalText = button.textContent;

    button.addEventListener('click', async () => {
        const productId = button.dataset.productId;
        button.disabled = true;
        button.textContent = 'Redirecting...';

        try {
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [{ id: productId, quantity: 1 }] })
            });

            if (!response.ok) {
                throw new Error('Checkout session request failed');
            }

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('Checkout error:', error);
            button.disabled = false;
            button.textContent = originalText;
            alert("Something went wrong starting checkout. Please try again, or reach out through the contact form below.");
        }
    });
});

// ============================================
// CONTACT FORM HANDLING
// ============================================

const contactForm = document.getElementById('contactForm');
const formNotice = document.getElementById('formNotice');

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(contactForm);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
    };

    // Validate form
    if (!data.name || !data.email || !data.subject || !data.message) {
        showFormNotice('Please fill out all fields.', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showFormNotice('Please enter a valid email address.', 'error');
        return;
    }

    // Since this is a static site without backend, we'll show a success message
    // In production, you would send this data to a backend service or email service
    console.log('Form submitted with data:', data);
    
    // Show success message
    showFormNotice('Message received! Thank you for reaching out. We\'ll be in touch soon.', 'success');

    // Reset form
    contactForm.reset();

    // Clear message after 5 seconds
    setTimeout(() => {
        formNotice.textContent = '';
        formNotice.classList.remove('success', 'error');
    }, 5000);
});

// Helper function to display form messages
function showFormNotice(message, type) {
    formNotice.textContent = message;
    formNotice.classList.remove('success', 'error');
    formNotice.classList.add(type);
}

// ============================================
// SCROLL ANIMATIONS (optional enhancement)
// ============================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeIn 0.6s ease-out forwards';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe feature cards and blog posts
document.querySelectorAll('.feature-card, .blog-post').forEach(element => {
    element.style.opacity = '0';
    observer.observe(element);
});

// ============================================
// NAVBAR STYLE ON SCROLL
// ============================================

const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
        navbar.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
    } else {
        navbar.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// ============================================
// CONSOLE MESSAGE (optional brand touch)
// ============================================

console.log('%c BPD UNBOXED', 'font-size: 20px; color: #EF4444; font-weight: bold; font-family: Bebas Neue, sans-serif;');
console.log('%c Feel Loudly. Heal Loudly.', 'font-size: 14px; color: #FFFFFF; font-family: Ubuntu, sans-serif;');
console.log('%c Borderlegend. Undertrained, not broken.', 'font-size: 12px; color: #E5E7EB; font-family: Ubuntu, sans-serif;');
