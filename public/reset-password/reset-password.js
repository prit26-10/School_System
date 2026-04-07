(function () {
    let overlayEl = null;

    function ensureModal() {
        if (overlayEl) return;

        overlayEl = document.createElement('div');
        overlayEl.className = 'reset-password-overlay';
        overlayEl.id = 'reset-password-overlay';
        overlayEl.innerHTML = `
            <div class="reset-password-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
                <div class="reset-password-header">
                    <h2 class="reset-password-title" id="reset-password-title">Reset Password</h2>
                    <button type="button" class="reset-password-close" id="reset-password-close" aria-label="Close">&times;</button>
                </div>
                <div class="reset-password-body">
                    <form id="reset-password-form">
                        <div class="reset-password-field">
                            <label class="reset-password-label" for="reset-current-password">Current Password</label>
                            <input class="reset-password-input" type="password" id="reset-current-password" required>
                        </div>
                        <div class="reset-password-field">
                            <label class="reset-password-label" for="reset-new-password">New Password</label>
                            <input class="reset-password-input" type="password" id="reset-new-password" minlength="6" required>
                        </div>
                        <div class="reset-password-field">
                            <label class="reset-password-label" for="reset-confirm-password">Confirm New Password</label>
                            <input class="reset-password-input" type="password" id="reset-confirm-password" minlength="6" required>
                        </div>
                        <div class="reset-password-actions">
                            <button type="button" class="reset-password-btn cancel" id="reset-password-cancel">Cancel</button>
                            <button type="submit" class="reset-password-btn submit" id="reset-password-submit">Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(overlayEl);

        overlayEl.addEventListener('click', function (e) {
            if (e.target === overlayEl) {
                close();
            }
        });

        document.getElementById('reset-password-close').addEventListener('click', close);
        document.getElementById('reset-password-cancel').addEventListener('click', close);
    }

    function close() {
        if (!overlayEl) return;
        overlayEl.classList.remove('show');

        const form = document.getElementById('reset-password-form');
        if (form) form.reset();
    }

    async function submitChange(config) {
        const currentPassword = document.getElementById('reset-current-password').value;
        const newPassword = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;
        const submitBtn = document.getElementById('reset-password-submit');

        const toast = config.toast || function (message) { alert(message); };

        if (newPassword !== confirmPassword) {
            toast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            toast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';

            const response = await fetch('/api/auth/change-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.token || ''}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update password');
            }

            toast('Password updated successfully', 'success');
            close();

            if (typeof config.onSuccess === 'function') {
                config.onSuccess(result);
            }
        } catch (error) {
            toast(error.message || 'Failed to update password', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
        }
    }

    function open(config) {
        ensureModal();

        if (!config || !config.token) {
            (config?.toast || alert)('Authentication token missing', 'error');
            return;
        }

        const form = document.getElementById('reset-password-form');
        const nextForm = form.cloneNode(true);
        form.parentNode.replaceChild(nextForm, form);

        nextForm.addEventListener('submit', function (e) {
            e.preventDefault();
            submitChange(config);
        });

        overlayEl.classList.add('show');
    }

    window.SmartSchoolResetPassword = {
        open,
        close
    };
})();
