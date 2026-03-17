class AuthSystem {
    constructor() {
        this.apiBaseUrl = '/api/auth';
        this.init();
    }

    init() {
        this.setupForms();
        this.setupValidation();
        this.setupPasswordToggle();
    }

    setupForms() {
        document.getElementById('login-form')?.addEventListener('submit', e => this.handleLogin(e));
    }

    setupPasswordToggle() {
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                const icon = btn.querySelector('.eye-icon');
                input.type = input.type === 'password' ? 'text' : 'password';
                icon.textContent = input.type === 'password' ? '👁️' : '🙈';
            });
        });
    }

    setupValidation() {
        // Email validation
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input, 'email'));
            input.addEventListener('input', () => this.clearError(input));
        });

        // Login email field specific validation
        const loginEmail = document.getElementById('login-email');
        if (loginEmail) {
            loginEmail.addEventListener('blur', () => this.validateField(loginEmail, 'email'));
            loginEmail.addEventListener('input', () => this.clearError(loginEmail));
        }

        // Password validation
        document.querySelectorAll('input[name="password"]').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input, 'password'));
            input.addEventListener('input', () => this.clearError(input));
        });

        // Select validation
        document.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', () => this.validateField(select, 'required'));
        });

        // Text field validation
        document.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input, 'required'));
            input.addEventListener('input', () => this.clearError(input));
        });
    }

    validateField(input, type) {
        const value = input.value.trim();
        let isValid = true;
        let errorMsg = '';

        switch (type) {
            case 'email':
                if (!value) errorMsg = 'Email is required';
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorMsg = 'Invalid email format';
                break;
            case 'password':
                if (!value) errorMsg = 'Password is required';
                break;
            case 'required':
                if (!value) errorMsg = `${input.previousElementSibling?.textContent?.replace(':', '') || 'Field'} is required`;
                break;
        }

        if (errorMsg) {
            this.showError(input, errorMsg);
            isValid = false;
        } else {
            this.showSuccess(input);
        }

        return isValid;
    }

    showError(input, msg) {
        input.classList.add('error');
        input.classList.remove('success');
        
        // Find error message container
        let errorEl = input.parentElement.querySelector('.error-message');
        if (!errorEl) {
            // If password input, look in the wrapper
            const wrapper = input.closest('.password-input-wrapper');
            if (wrapper) {
                errorEl = wrapper.parentElement.querySelector('.error-message');
            }
        }
        
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
    }

    showSuccess(input) {
        input.classList.add('success');
        input.classList.remove('error');
        
        // Find error message container
        let errorEl = input.parentElement.querySelector('.error-message');
        if (!errorEl) {
            // If password input, look in the wrapper
            const wrapper = input.closest('.password-input-wrapper');
            if (wrapper) {
                errorEl = wrapper.parentElement.querySelector('.error-message');
            }
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    clearError(input) {
        input.classList.remove('error', 'success');
        
        // Find error message container
        let errorEl = input.parentElement.querySelector('.error-message');
        if (!errorEl) {
            // If password input, look in the wrapper
            const wrapper = input.closest('.password-input-wrapper');
            if (wrapper) {
                errorEl = wrapper.parentElement.querySelector('.error-message');
            }
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        
        // Clear previous errors
        this.clearAllErrors();
        
        // Validate form
        let isValid = true;
        const emailField = document.getElementById('login-email');
        const passwordField = document.getElementById('login-password');
        
        if (!this.validateField(emailField, 'email')) isValid = false;
        if (!this.validateField(passwordField, 'password')) isValid = false;
        
        if (!isValid) return;
        
        this.showLoading();
        try {
            const res = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            if (res.ok) {
                this.showMessage('Login successful!', 'success');
                localStorage.setItem('token', result.token);
                if (result.user) {
                    localStorage.setItem('userData', JSON.stringify(result.user));
                }

                // Check user role and redirect accordingly
                try {
                    const payload = JSON.parse(atob(result.token.split('.')[1]));
                    if (payload.role === 'admin') {
                        setTimeout(() => window.location.href = '/admin/dashboard', 1500);
                    } else if (payload.role === 'teacher') {
                        setTimeout(() => window.location.href = '/teacher/dashboard', 1500);
                    } else if (payload.role === 'student') {
                        setTimeout(() => window.location.href = '/student/dashboard', 1500);
                    } else {
                        setTimeout(() => window.location.href = '/login', 1500);
                    }
                } catch (jwtError) {
                    // Fallback to generic dashboard
                    setTimeout(() => window.location.href = '/login', 1500);
                }
            } else {
                // Show specific inline error messages
                if (result.message && result.message.includes('email')) {
                    this.showError(emailField, result.message || 'Invalid email address');
                } else if (result.message && result.message.includes('password')) {
                    this.showError(passwordField, result.message || 'Incorrect password');
                } else {
                    this.showError(emailField, result.message || 'Invalid email or password');
                }
            }
        } catch (error) {
            this.showError(emailField, 'Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    clearAllErrors() {
        document.querySelectorAll('input, select').forEach(input => this.clearError(input));
    }

    showLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.add('active');
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.remove('active');
        }
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container');
        if (!container) return;
        
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.innerHTML = `${text}<button class="message-close">&times;</button>`;
        container.appendChild(msg);

        setTimeout(() => msg.remove(), 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => new AuthSystem());
