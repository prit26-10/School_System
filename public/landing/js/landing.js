document.addEventListener('DOMContentLoaded', function () {

    initNavbar();
    initScrollAnimations();
    initCounterAnimation();
    initFeeStructure();
    initCollapsibleFeeStructure();
    initTestimonialsCarousel();
    initContactForm();
    initSmoothScroll();
});



function initNavbar() {
    const header = document.getElementById('header');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
    });

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const bars = hamburger.querySelectorAll('.bar');
            if (navMenu.classList.contains('active')) {
                bars[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                bars[1].style.opacity = '0';
                bars[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                bars[0].style.transform = '';
                bars[1].style.opacity = '1';
                bars[2].style.transform = '';
            }
        });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const bars = hamburger.querySelectorAll('.bar');
            bars[0].style.transform = '';
            bars[1].style.opacity = '1';
            bars[2].style.transform = '';
        });
    });
}

function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: Unobserve after animation
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all elements with .reveal class
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });

    // Handle sections that were previously animated manually
    document.querySelectorAll('.feature-card, .benefit-card, .opportunity-card, .live-feature, .contact-card').forEach((el, index) => {
        el.classList.add('reveal', 'reveal-up');
        // Add a small staggered delay based on index if they are in the same grid
        // but IntersectionObserver handles them as they appear. 
        // For grid items, we can manually add delay classes in HTML for better control.
        observer.observe(el);
    });
}

function initCounterAnimation() {
    const counters = document.querySelectorAll('[data-count]');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-count'));
                animateCounter(counter, target);
                counterObserver.unobserve(counter);
            }
        });
    }, observerOptions);

    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

function animateCounter(element, target) {
    let current = 0;
    const increment = target / 60;
    const duration = 2000;
    const stepTime = duration / 60;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, stepTime);
}

function initTestimonialsCarousel() {
    const track = document.getElementById('testimonialsTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('testimonialDots');

    if (!track) return;

    const cards = track.querySelectorAll('.testimonial-card');
    let currentIndex = 0;

    for (let i = 0; i < cards.length; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }

    const dots = dotsContainer.querySelectorAll('.dot');

    function updateDots() {
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function goToSlide(index) {
        currentIndex = index;
        const cardWidth = cards[0].offsetWidth + 30;
        track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        updateDots();
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % cards.length;
        goToSlide(currentIndex);
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        goToSlide(currentIndex);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', nextSlide);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', prevSlide);
    }

    setInterval(nextSlide, 5000);
}

function initContactForm() {
    const form = document.getElementById('contactForm');
    const successDiv = document.getElementById('formSuccess');

    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        btn.disabled = true;

        setTimeout(function () {
            form.style.display = 'none';
            successDiv.classList.add('show');
        }, 1500);
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}
function initCollapsibleFeeStructure() {
    const feeSection = document.querySelector('.fee-structure');
    const feeSectionTitle = feeSection?.querySelector('.section-title');
    const feesContainer = feeSection?.querySelector('.fees-container');
    
    if (!feeSection || !feeSectionTitle || !feesContainer) return;
    
    // Hide fee structure by default
    feesContainer.style.display = 'none';
    
    // Add cursor pointer to title to indicate it's clickable
    feeSectionTitle.style.cursor = 'pointer';
    feeSectionTitle.style.position = 'relative';
    
    // Add toggle indicator
    const toggleIndicator = document.createElement('span');
    toggleIndicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
    toggleIndicator.style.marginLeft = '10px';
    toggleIndicator.style.transition = 'transform 0.3s ease';
    feeSectionTitle.appendChild(toggleIndicator);
    
    // Add click event to toggle visibility
    feeSectionTitle.addEventListener('click', function() {
        const isHidden = feesContainer.style.display === 'none';
        
        if (isHidden) {
            feesContainer.style.display = 'block';
            toggleIndicator.innerHTML = '<i class="fas fa-chevron-up"></i>';
            // Add reveal animation
            feesContainer.classList.add('reveal', 'reveal-up');
        } else {
            feesContainer.style.display = 'none';
            toggleIndicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }
    });
}

function initFeeStructure() {
    const feeTableBody = document.getElementById('feeTableBody');
    if (!feeTableBody) return;

    fetch('/api/fees/public')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data && data.data.length > 0) {
                feeTableBody.innerHTML = '';
                data.data.forEach(fee => {
                    // Check if fee.classId exists and has class property
                    if (fee.classId && fee.classId.class !== undefined) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="class-name">Class ${fee.classId.class}</td>
                            <td class="fee-amount">₹${fee.totalFee.toLocaleString()}</td>
                            <td class="fee-desc">${fee.description || 'Standard academic curriculum with all activities.'}</td>
                        `;
                        feeTableBody.appendChild(tr);
                    } else {
                        console.warn('Fee record missing classId:', fee);
                    }
                });
                
                // If no valid fee records were added
                if (feeTableBody.children.length === 0) {
                    feeTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No fee protocols defined yet.</td></tr>';
                }
            } else {
                feeTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No fee protocols defined yet.</td></tr>';
            }
        })
        .catch(err => {
            console.error('Error fetching fees:', err);
            feeTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error loading fees. Please try again.</td></tr>';
        });
}
