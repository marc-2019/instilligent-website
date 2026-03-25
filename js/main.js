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

    // Contact form handling — opens user's email client pre-filled (mailto fallback)
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        // Add a note so users know clicking Send opens their email client
        const formNote = document.createElement('p');
        formNote.style.cssText = 'margin-top:0.5rem;font-size:0.8rem;opacity:0.7;text-align:center;';
        formNote.textContent = 'Clicking Send will open your email client with this message pre-filled.';
        contactForm.appendChild(formNote);

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            // Find the text node (first child, before any icon element)
            const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            const originalText = textNode ? textNode.textContent : 'Send Message ';

            const name = contactForm.querySelector('#name').value;
            const email = contactForm.querySelector('#email').value;
            const interest = contactForm.querySelector('#interest').value;
            const message = contactForm.querySelector('#message').value;

            const subject = encodeURIComponent('Website Enquiry: ' + (interest || 'General'));
            const body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\nInterest: ' + interest + '\n\n' + message);

            window.location.href = 'mailto:info@instilligent.com?subject=' + subject + '&body=' + body;

            if (textNode) { textNode.textContent = 'Opening email client… '; }
            btn.disabled = true;

            setTimeout(() => {
                if (textNode) { textNode.textContent = originalText; }
                btn.disabled = false;
                contactForm.reset();
            }, 3000);
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
