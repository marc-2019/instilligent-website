// Instilligent - Main JS

document.addEventListener('DOMContentLoaded', () => {
    // Init Lucide icons
    lucide.createIcons();

    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        });
    }

    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            navToggle.classList.toggle('active');
        });

        // Close on link click
        navLinks.querySelectorAll('.nav-link:not(.nav-dropdown-trigger)').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                navToggle.classList.remove('active');
            });
        });
    }

    // Contact form handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;

            btn.innerHTML = 'Sending...';
            btn.disabled = true;

            // For now, open mailto as fallback
            // TODO: Replace with Cloudflare Worker endpoint
            const name = contactForm.querySelector('#name').value;
            const email = contactForm.querySelector('#email').value;
            const interest = contactForm.querySelector('#interest').value;
            const message = contactForm.querySelector('#message').value;

            const subject = encodeURIComponent(`Website Enquiry: ${interest || 'General'}`);
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nInterest: ${interest}\n\n${message}`);

            window.location.href = `mailto:marc@instilligent.com?subject=${subject}&body=${body}`;

            setTimeout(() => {
                btn.innerHTML = 'Message Sent ✓';
                btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                    contactForm.reset();
                    lucide.createIcons();
                }, 2000);
            }, 500);
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Animate on scroll (simple IntersectionObserver)
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .product-card, .why-card, .tech-badge, .feature-item, .industry-card, .service-card, .engagement-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
});
