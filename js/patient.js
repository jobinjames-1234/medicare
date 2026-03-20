/**
 * CarePlus Hospital System - Patient Dashboard Logic
 */
$(document).ready(function() {
    bindPasswordToggleHandlers();
    bindEditProfileModalReset();
    
    // Check auth
    $.ajax({
        url: 'backend/api/auth.php?action=check_session',
        method: 'GET',
        dataType: 'json',
        success: function(res) {
            if (!res.success || res.role !== 'patient') {
                window.location.href = 'login.html';
            } else {
                loadHistory();
            }
        }
    });

    function bindPasswordToggleHandlers() {
        $(document).on('click', '.password-toggle', function() {
            const targetSelector = $(this).data('target');
            const $input = $(targetSelector);
            if (!$input.length) return;

            const isHidden = $input.attr('type') === 'password';
            $input.attr('type', isHidden ? 'text' : 'password');

            const $icon = $(this).find('i');
            $icon.toggleClass('bi-eye', !isHidden);
            $icon.toggleClass('bi-eye-slash', isHidden);
        });
    }

    function bindEditProfileModalReset() {
        $('#editProfileModal').on('hidden.bs.modal', function() {
            clearEditPasswordFields();
        });
    }

    function clearEditPasswordFields() {
        $('#editCurrentPassword, #editNewPassword, #editConfirmPassword')
            .val('')
            .attr('type', 'password');
        $('#editProfileForm .password-toggle i')
            .removeClass('bi-eye-slash')
            .addClass('bi-eye');
    }

    // Tab switcher
    window.switchTab = function(tabName) {
        $('.nav-item').removeClass('active');
        $(`[onclick="switchTab('${tabName}')"]`).addClass('active');

        if(tabName === 'history') {
            $('#historyTab').removeClass('d-none');
            $('#profileTab').addClass('d-none');
            $('#pageTitle').text('My Bookings');
            loadHistory();
        } else {
            $('#historyTab').addClass('d-none');
            $('#profileTab').removeClass('d-none');
            $('#pageTitle').text('My Profile');
            loadProfile();
        }
    };

    function loadHistory() {
        $.ajax({
            url: 'backend/api/patient.php?action=get_history',
            method: 'GET',
            success: function(res) {
                let tbody = $('#patientHistoryList');
                tbody.empty();
                if(res.success && res.history.length > 0) {
                    res.history.forEach(a => {
                        let badgeClass = a.status === 'Cancelled' ? 'bg-danger' : 
                                         a.status === 'Completed' ? 'bg-secondary' : 
                                         a.status === 'Pending' ? 'bg-warning text-dark' : 'bg-success';

                        const viewDocBtn = a.booking_documents
                            ? `<a class="btn btn-sm btn-outline-primary rounded-pill px-3 me-2" href="${a.booking_documents}" target="_blank" rel="noopener">View Document</a>`
                            : `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 me-2" disabled title="Receipt PDF not generated yet">View Document</button>`;
                        
                        let actionHtml = '';
                        if (a.status === 'Confirmed' || a.status === 'Pending') {
                            actionHtml = `${viewDocBtn}<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="cancelAppt(${a.appointment_id})">Cancel</button>`;
                        } else {
                            actionHtml = viewDocBtn;
                        }

                        tbody.append(`
                            <tr>
                                <td class="fw-bold text-secondary">#${a.reference_no}</td>
                                <td>
                                    <div class="fw-bold text-primary">${a.appointment_date}</div>
                                    <small class="text-muted"><i class="bi bi-clock"></i> ${a.time_slot}</small>
                                </td>
                                <td>
                                    <div class="fw-bold">${a.doctor_name}</div>
                                    <small class="text-muted">${a.specialization}</small>
                                </td>
                                <td><span class="badge ${badgeClass} rounded-pill px-3 py-2">${a.status}</span></td>
                                <td>${actionHtml}</td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append(`<tr><td colspan="5" class="text-center py-4 text-muted">No bookings found.</td></tr>`);
                }
            }
        });
    }

    function loadProfile() {
        $.ajax({
            url: 'backend/api/patient.php?action=get_profile',
            method: 'GET',
            success: function(res) {
                if(res.success && res.profile) {
                    let p = res.profile;
                    $('#pName').text(p.name);
                    $('#pEmail').text(p.email);
                    $('#pPhone').text(p.phone);
                    $('#pAddress').text(p.address || 'N/A');
                    $('#pDob').text(p.date_of_birth || 'N/A');

                    // Pre-fill modal
                    $('#editName').val(p.name);
                    $('#editEmail').val(p.email);
                    $('#editPhone').val(p.phone);
                    $('#editAddress').val(p.address);
                    $('#editDob').val(p.date_of_birth);
                }
            }
        });
    }

    $('#editProfileForm').on('submit', function(e) {
        e.preventDefault();
        const currentPassword = $('#editCurrentPassword').val().trim();
        const newPassword = $('#editNewPassword').val().trim();
        const confirmPassword = $('#editConfirmPassword').val().trim();
        const wantsPasswordChange = currentPassword !== '' || newPassword !== '' || confirmPassword !== '';

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert('To change password, fill current password, new password, and confirm password.');
                return;
            }
            if (newPassword.length < 6) {
                alert('New password must be at least 6 characters.');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('New password and confirm password do not match.');
                return;
            }
        }

        let data = {
            name: $('#editName').val(),
            email: $('#editEmail').val(),
            phone: $('#editPhone').val(),
            address: $('#editAddress').val(),
            date_of_birth: $('#editDob').val()
        };
        if (wantsPasswordChange) {
            data.current_password = currentPassword;
            data.new_password = newPassword;
            data.confirm_password = confirmPassword;
        }

        $.ajax({
            url: 'backend/api/patient.php?action=update_profile',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(res) {
                if(res.success) {
                    alert('Profile updated successfully!');
                    bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
                    loadProfile();
                    clearEditPasswordFields();
                } else {
                    alert('Error updating profile: ' + res.message);
                }
            }
        });
    });

    window.cancelAppt = function(id) {
        if(confirm("Are you sure you want to cancel this appointment?")) {
            $.ajax({
                //url: 'backend/api/patient.php?action=cancel_appointment',
                url: 'backend/api/cancel_appointment.php',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ appointment_id: id }),
                success: function(res) {
                    if(res.success) {
                        alert("Appointment cancelled successfully.");
                        loadHistory();
                    } else {
                        alert("Failed to cancel appointment.");
                    }
                }
            });
        }
    };

});
