/**
 * CarePlus Hospital System - Authentication Logic
 */
$(document).ready(function() {
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

    // Toggle password visibility only on auth pages to avoid duplicate handlers on dashboards.
    if (isAuthPage) {
        $(document).off('click.authPasswordToggle').on('click.authPasswordToggle', '.password-toggle', function() {
            const targetSelector = $(this).data('target');
            const $input = $(targetSelector);
            if (!$input.length) return;

            const isPassword = $input.attr('type') === 'password';
            $input.attr('type', isPassword ? 'text' : 'password');

            const $icon = $(this).find('i');
            $icon.toggleClass('bi-eye', !isPassword);
            $icon.toggleClass('bi-eye-slash', isPassword);
        });
    }
    
    // Show redirect notice
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('redirect') === 'booking.html') {
        $('#loginAlert').removeClass('d-none').addClass('alert-info').text('Please login to book your appointment.');
    }
    if(urlParams.get('reset') === 'success') {
        $('#loginAlert').removeClass('d-none').removeClass('alert-danger').addClass('alert-success').text('Password reset successful. Please login with your new password.');
    }
    
    // Check Session function - Redirects if already logged in based on role
    function checkSessionAndRedirect() {
        $.ajax({
            url: 'backend/api/auth.php?action=check_session',
            method: 'GET',
            dataType: 'json',
            success: function(res) {
                if (res.success) {
                    redirectBasedOnRole(res.role);
                }
            }
        });
    }

    function redirectBasedOnRole(role) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect) {
            window.location.href = redirect;
            return;
        }

        if (role === 'admin') window.location.href = 'admin_dashboard.html';
        else if (role === 'doctor') window.location.href = 'doctor_dashboard.html';
        else if (role === 'patient') window.location.href = 'patient_dashboard.html';
        else if (role === 'cu_support') window.location.href = 'customer_support_dashboard.html';
    }

    // Call on load for auth pages
    if(isAuthPage) {
        checkSessionAndRedirect();
    }

    // Login Form Submit
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();
        let email = $('#email').val();
        let password = $('#password').val();

        $.ajax({
            url: 'backend/api/auth.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: 'login', email: email, password: password }),
            success: function(res) {
                if (res.success) {
                    redirectBasedOnRole(res.role);
                } else {
                    $('#loginAlert').removeClass('d-none').text(res.message);
                }
            },
            error: function() {
                $('#loginAlert').removeClass('d-none').text('Server error occurred.');
            }
        });
    });

    // Register Form Submit
    $('#registerForm').on('submit', function(e) {
        e.preventDefault();
        const password = $('#regPassword').val();
        const confirmPassword = $('#regConfirmPassword').val();

        if (password !== confirmPassword) {
            $('#regAlert').removeClass('d-none').text('Password and confirm password do not match.');
            return;
        }
        
        let data = {
            action: 'register',
            name: $('#regName').val(),
            email: $('#regEmail').val(),
            password: password,
            confirm_password: confirmPassword,
            phone: $('#regPhone').val(),
            address: $('#regAddress').val(),
            date_of_birth: $('#regDob').val()
        };

        $.ajax({
            url: 'backend/api/auth.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(res) {
                if (res.success) {
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                } else {
                    $('#regAlert').removeClass('d-none').text(res.message);
                }
            },
            error: function() {
                $('#regAlert').removeClass('d-none').text('Server error occurred.');
            }
        });
    });

});

// Global Logout Function
function logout() {
    $.ajax({
        url: 'backend/api/auth.php?action=logout',
        method: 'GET',
        success: function() {
            window.location.href = 'login.html';
        }
    });
}
