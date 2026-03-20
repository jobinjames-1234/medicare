/**
 * CarePlus Hospital System - Password Reset Logic
 */
$(document).ready(function() {
    const path = window.location.pathname.toLowerCase();
    const isForgotPage = path.includes('forgot_password.html');
    const isResetPage = path.includes('reset_password.html');
    const urlParams = new URLSearchParams(window.location.search);

    function getSuggestedPassword() {
        const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `Care${randomDigits}`;
    }

    function setAlert(selector, message, type) {
        const cls = type || 'info';
        $(selector)
            .removeClass('d-none alert-info alert-danger alert-success')
            .addClass(`alert-${cls}`)
            .text(message);
    }

    // Toggle password visibility. Reset page starts with visible text mode.
    $(document).off('click.passwordResetToggle').on('click.passwordResetToggle', '.password-toggle', function() {
        const targetSelector = $(this).data('target');
        const $input = $(targetSelector);
        if (!$input.length) return;

        const currentlyVisible = $input.attr('type') === 'text';
        $input.attr('type', currentlyVisible ? 'password' : 'text');

        const $icon = $(this).find('i');
        // Visible => eye-slash icon, Hidden => eye icon.
        $icon.toggleClass('bi-eye-slash', !currentlyVisible);
        $icon.toggleClass('bi-eye', currentlyVisible);
    });

    if (isForgotPage) {
        $('#forgotPasswordForm').on('submit', function(e) {
            e.preventDefault();
            const email = $('#forgotEmail').val().trim();
            if (!email) {
                setAlert('#forgotAlert', 'Please enter your email address.', 'danger');
                return;
            }

            $.ajax({
                url: 'backend/api/password_reset.php?action=request_reset',
                method: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({ email: email }),
                success: function(res) {
                    if (!res.success) {
                        setAlert('#forgotAlert', res.message || 'Failed to start reset process.', 'danger');
                        return;
                    }

                    if (res.reset_token) {
                        const tokenKey = `reset_prefill_${res.reset_token}`;
                        const suggestedPassword = res.generated_password || getSuggestedPassword();
                        sessionStorage.setItem(tokenKey, suggestedPassword);
                        window.location.href = `reset_password.html?token=${encodeURIComponent(res.reset_token)}`;
                    } else {
                        setAlert('#forgotAlert', res.message || 'If this email is registered, reset instructions will be available.', 'info');
                    }
                },
                error: function() {
                    setAlert('#forgotAlert', 'Server error occurred. Please try again.', 'danger');
                }
            });
        });
    }

    if (isResetPage) {
        const token = (urlParams.get('token') || '').trim();
        const tokenKey = `reset_prefill_${token}`;
        const storedSuggestedPassword = token ? sessionStorage.getItem(tokenKey) : null;
        const suggestedPassword = storedSuggestedPassword || getSuggestedPassword();

        if (token) {
            $('#newPassword').val(suggestedPassword);
            $('#confirmPassword').val(suggestedPassword);
        }

        if (!token) {
            setAlert('#resetAlert', 'Invalid reset link. Missing token.', 'danger');
            $('#resetPasswordForm :input').prop('disabled', true);
            $('#resetEmailDisplay').text('Unavailable');
            return;
        }

        $.ajax({
            url: `backend/api/password_reset.php?action=validate_token&token=${encodeURIComponent(token)}`,
            method: 'GET',
            dataType: 'json',
            success: function(res) {
                if (!res.success) {
                    setAlert('#resetAlert', res.message || 'Reset link is invalid.', 'danger');
                    $('#resetPasswordForm :input').prop('disabled', true);
                    $('#resetEmailDisplay').text('Unavailable');
                    return;
                }

                $('#resetEmailDisplay').text(res.email || 'Unknown');
                setAlert('#resetAlert', 'Reset link is valid. You can set your new password now.', 'info');
            },
            error: function() {
                setAlert('#resetAlert', 'Unable to validate reset link right now.', 'danger');
                $('#resetPasswordForm :input').prop('disabled', true);
                $('#resetEmailDisplay').text('Unavailable');
            }
        });

        $('#resetPasswordForm').on('submit', function(e) {
            e.preventDefault();
            const newPassword = $('#newPassword').val().trim();
            const confirmPassword = $('#confirmPassword').val().trim();

            if (newPassword.length < 6) {
                setAlert('#resetAlert', 'Password must be at least 6 characters.', 'danger');
                return;
            }
            if (newPassword !== confirmPassword) {
                setAlert('#resetAlert', 'Password and confirm password do not match.', 'danger');
                return;
            }

            $.ajax({
                url: 'backend/api/password_reset.php?action=reset_password',
                method: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    token: token,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                }),
                success: function(res) {
                    if (!res.success) {
                        setAlert('#resetAlert', res.message || 'Failed to reset password.', 'danger');
                        return;
                    }

                    sessionStorage.removeItem(tokenKey);
                    setAlert('#resetAlert', 'Password reset successful. Redirecting to login...', 'success');
                    setTimeout(function() {
                        window.location.href = 'login.html?reset=success';
                    }, 1200);
                },
                error: function() {
                    setAlert('#resetAlert', 'Server error occurred. Please try again.', 'danger');
                }
            });
        });
    }
});
