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

    // Contact form handling — POSTs to /api/contact (Cloudflare Pages Function → Resend).
    // Replaces the previous mailto: handler that failed silently when the user
    // had no default mail client configured (very common in 2026 with web mail).
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = contactForm.querySelector('#name').value;
            const email = contactForm.querySelector('#email').value;
            const interestEl = contactForm.querySelector('#interest');
            const interest = interestEl ? interestEl.value : '';
            const message = contactForm.querySelector('#message').value;

            const submitBtn = contactForm.querySelector('button[type="submit"]') || contactForm.querySelector('input[type="submit"]');
            const originalText = submitBtn ? (submitBtn.textContent || submitBtn.value) : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                if (submitBtn.tagName === 'BUTTON') submitBtn.textContent = 'Sending…';
                else submitBtn.value = 'Sending…';
            }

            try {
                const resp = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, interest, message }),
                });
                if (resp.ok) {
                    contactForm.reset();
                    alert("Thanks — your message has been sent. We'll be in touch.");
                } else {
                    const data = await resp.json().catch(() => ({}));
                    alert(
                        "Sorry, that didn't go through. Please email marc@instilligent.com directly.\n\n(" +
                        (data.error || resp.status) + ')'
                    );
                }
            } catch (err) {
                alert('Network error. Please email marc@instilligent.com directly.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    if (submitBtn.tagName === 'BUTTON') submitBtn.textContent = originalText;
                    else submitBtn.value = originalText;
                }
            }
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
