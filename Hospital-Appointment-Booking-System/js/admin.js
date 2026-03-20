/**
 * CarePlus Hospital System - Admin Management Logic
 */
$(document).ready(function () {
    const DAY_OPTIONS = [
        { id: "1", label: "Monday", short: "Mon" },
        { id: "2", label: "Tuesday", short: "Tue" },
        { id: "3", label: "Wednesday", short: "Wed" },
        { id: "4", label: "Thursday", short: "Thu" },
        { id: "5", label: "Friday", short: "Fri" },
        { id: "6", label: "Saturday", short: "Sat" },
        { id: "7", label: "Sunday", short: "Sun" }
    ];

    const SLOT_OPTIONS = [
        { id: "1", label: "09:00 AM" },
        { id: "2", label: "10:00 AM" },
        { id: "3", label: "11:00 AM" },
        { id: "4", label: "03:00 PM" },
        { id: "5", label: "04:00 PM" },
        { id: "6", label: "05:00 PM" }
    ];
    let adminProfile = null;

    initializeAvailabilityUI();
    bindPhotoPreviewHandlers();
    bindPasswordToggleHandlers();

    // Check auth
    $.ajax({
        url: "backend/api/auth.php?action=check_session",
        method: "GET",
        dataType: "json",
        success: function (res) {
            if (!res.success || res.role !== "admin") {
                window.location.href = "login.html";
            } else {
                loadAppointments();
                loadAdminProfile();
            }
        }
    });

    // Tab switcher
    window.switchTab = function (tabName) {
        $(".nav-item").removeClass("active");
        $(`[onclick="switchTab('${tabName}')"]`).addClass("active");
        $("#appointmentsTab, #doctorsTab, #supportTab, #profileTab, #messagesTab").addClass("d-none");

        if (tabName === "appointments") {
            $("#appointmentsTab").removeClass("d-none");
            $("#pageTitle").text("All Appointments");
            loadAppointments();
        } else if (tabName === "doctors") {
            $("#doctorsTab").removeClass("d-none");
            $("#pageTitle").text("Manage Doctors");
            loadDoctors();
        } else if (tabName === "support") {
            $("#supportTab").removeClass("d-none");
            $("#pageTitle").text("Customer Support");
            loadSupportStaff();
        } else if (tabName === "profile") {
            $("#profileTab").removeClass("d-none");
            $("#pageTitle").text("My Profile");
            loadAdminProfile();
        } else {
            $("#messagesTab").removeClass("d-none");
            $("#pageTitle").text("Messages");
            loadMessages();
        }
    };

    // Build availability controls for add/edit forms.
    function initializeAvailabilityUI() {
        buildAvailabilityUI("add");
        buildAvailabilityUI("edit");
        bindAvailabilityEvents("add");
        bindAvailabilityEvents("edit");
        syncAvailabilityInputs("add");
        syncAvailabilityInputs("edit");
    }

    // Wire add/edit photo input fields to show live thumbnail previews.
    function bindPhotoPreviewHandlers() {
        $("#docPhoto").on("change", function () {
            setPreviewFromFile(this, "#docPhotoPreviewWrap", "#docPhotoPreview", "#docPhotoPreviewWrap .photo-preview-text", "Selected image preview");
        });

        $("#editDocPhoto").on("change", function () {
            setPreviewFromFile(this, "#editDocPhotoPreviewWrap", "#editDocPhotoPreview", "#editDocPhotoPreviewText", "Selected new image preview");
        });

        $("#addDoctorModal").on("hidden.bs.modal", function () {
            clearPreview("#docPhotoPreviewWrap", "#docPhotoPreview", "#docPhotoPreviewWrap .photo-preview-text", "Selected image preview");
            $("#docPhoto").val("");
            clearAddPasswordInputs();
        });

        $("#editDoctorModal").on("hidden.bs.modal", function () {
            clearPreview("#editDocPhotoPreviewWrap", "#editDocPhotoPreview", "#editDocPhotoPreviewText", "Current/selected image preview");
            $("#editDocPhoto").val("");
            clearEditPasswordInputs();
        });

        $("#editAdminProfileModal").on("hidden.bs.modal", function () {
            clearAdminPasswordInputs();
        });

        $("#addSupportModal").on("hidden.bs.modal", function () {
            if ($("#addStaffForm").length) {
                $("#addStaffForm")[0].reset();
            }
            clearAddSupportPasswordInputs();
        });

        $("#editSupportModal").on("hidden.bs.modal", function () {
            clearEditSupportPasswordInputs();
        });
    }

    // Toggle password visibility for any eye button linked by data-target.
    function bindPasswordToggleHandlers() {
        $(document).on("click", ".password-toggle", function () {
            const targetSelector = $(this).data("target");
            const $input = $(targetSelector);
            if (!$input.length) return;

            const isHidden = $input.attr("type") === "password";
            $input.attr("type", isHidden ? "text" : "password");

            const $icon = $(this).find("i");
            $icon.toggleClass("bi-eye", !isHidden);
            $icon.toggleClass("bi-eye-slash", isHidden);
        });
    }

    // Clear edit password fields and reset eye icons to hidden state.
    function clearEditPasswordInputs() {
        $("#editCurrentPassword, #editNewPassword, #editConfirmNewPassword")
            .val("")
            .attr("type", "password");
        $("#editDoctorForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    // Clear add-doctor password fields and reset eye icons to hidden state.
    function clearAddPasswordInputs() {
        $("#docPassword, #docConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#addDoctorForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    // Clear admin profile password fields and reset eye icons to hidden state.
    function clearAdminPasswordInputs() {
        $("#editAdminCurrentPassword, #editAdminNewPassword, #editAdminConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#editAdminProfileForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    // Clear add-support password fields and reset eye icons.
    function clearAddSupportPasswordInputs() {
        $("#staffPassword, #staffConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#addStaffForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    // Clear edit-support password fields and reset eye icons.
    function clearEditSupportPasswordInputs() {
        $("#editStaffCurrentPassword, #editStaffNewPassword, #editStaffConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#editStaffForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    // Show an image preview from a selected file input.
    function setPreviewFromFile(fileInput, wrapSel, imgSel, textSel, labelText) {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!file) {
            return;
        }
        const url = URL.createObjectURL(file);
        setPreviewFromUrl(url, wrapSel, imgSel, textSel, labelText, true);
    }

    // Show an image preview from an existing URL (for current doctor photo).
    function setPreviewFromUrl(url, wrapSel, imgSel, textSel, labelText, isObjectUrl) {
        const $wrap = $(wrapSel);
        const $img = $(imgSel);
        const $text = $(textSel);

        const previousObjectUrl = $img.data("objectUrl");
        if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            $img.removeData("objectUrl");
        }

        if (!url) {
            clearPreview(wrapSel, imgSel, textSel, "Current/selected image preview");
            return;
        }

        $img.attr("src", url);
        $text.text(labelText);
        $wrap.addClass("show");

        if (isObjectUrl) {
            $img.data("objectUrl", url);
        }
    }

    // Clear image preview UI and free temporary object URLs.
    function clearPreview(wrapSel, imgSel, textSel, defaultText) {
        const $wrap = $(wrapSel);
        const $img = $(imgSel);
        const $text = $(textSel);

        const previousObjectUrl = $img.data("objectUrl");
        if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            $img.removeData("objectUrl");
        }

        $img.attr("src", "");
        $text.text(defaultText || "Current/selected image preview");
        $wrap.removeClass("show");
    }

    // Render per-day dropdown sections with slot checkboxes.
    function buildAvailabilityUI(prefix) {
        const containerId = prefix === "add" ? "#addAvailabilityBuilder" : "#editAvailabilityBuilder";
        const $container = $(containerId);
        if (!$container.length) return;

        let html = "";
        DAY_OPTIONS.forEach(function (day) {
            html += `
                <details class="availability-day" ${day.id === "1" ? "open" : ""}>
                    <summary>
                        <div class="form-check m-0">
                            <input class="form-check-input day-checkbox" type="checkbox" id="${prefix}_day_${day.id}" data-day-id="${day.id}">
                            <label class="form-check-label" for="${prefix}_day_${day.id}">${day.label}</label>
                        </div>
                    </summary>
                    <div class="availability-content">
                        <div class="slot-grid">
                            ${SLOT_OPTIONS.map(function (slot) {
                                const slotKey = `${day.id}_${slot.id}`;
                                return `
                                    <div class="form-check">
                                        <input class="form-check-input slot-checkbox" type="checkbox" id="${prefix}_slot_${slotKey}" data-day-id="${day.id}" data-slot-id="${slot.id}" data-slot-key="${slotKey}">
                                        <label class="form-check-label" for="${prefix}_slot_${slotKey}">${slot.label}</label>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </details>
            `;
        });

        $container.html(html);
    }

    // Wire slot/day checkbox rules for auto-select and syncing hidden IDs.
    function bindAvailabilityEvents(prefix) {
        const containerId = prefix === "add" ? "#addAvailabilityBuilder" : "#editAvailabilityBuilder";
        const $container = $(containerId);

        $container.on("change", ".day-checkbox", function () {
            const dayId = $(this).data("dayId").toString();
            if (!this.checked) {
                $container.find(`.slot-checkbox[data-day-id="${dayId}"]`).prop("checked", false);
            }
            syncAvailabilityInputs(prefix);
        });

        $container.on("change", ".slot-checkbox", function () {
            const dayId = $(this).data("dayId").toString();
            const $dayCheckbox = $container.find(`.day-checkbox[data-day-id="${dayId}"]`);
            const dayHasAnySlot = $container.find(`.slot-checkbox[data-day-id="${dayId}"]:checked`).length > 0;

            if (this.checked) {
                $dayCheckbox.prop("checked", true);
            } else if (!dayHasAnySlot) {
                $dayCheckbox.prop("checked", false);
            }

            syncAvailabilityInputs(prefix);
        });
    }

    // Compute selected day IDs and day_slot IDs into hidden fields.
    function syncAvailabilityInputs(prefix) {
        const containerId = prefix === "add" ? "#addAvailabilityBuilder" : "#editAvailabilityBuilder";
        const daysId = prefix === "add" ? "#docDays" : "#editDocDays";
        const slotsId = prefix === "add" ? "#docSlots" : "#editDocSlots";
        const $container = $(containerId);

        const dayIds = $container.find(".day-checkbox:checked").map(function () {
            return $(this).data("dayId").toString();
        }).get();

        const slotKeys = $container.find(".slot-checkbox:checked").map(function () {
            return $(this).data("slotKey").toString();
        }).get();

        $(daysId).val(dayIds.join(","));
        $(slotsId).val(slotKeys.join(","));
    }

    // Restore checkbox states from stored comma-separated ID strings.
    function applyAvailabilityFromIds(prefix, dayIdsCsv, slotKeysCsv) {
        const containerId = prefix === "add" ? "#addAvailabilityBuilder" : "#editAvailabilityBuilder";
        const $container = $(containerId);

        $container.find(".day-checkbox, .slot-checkbox").prop("checked", false);

        const dayIds = (dayIdsCsv || "").split(",").map(v => v.trim()).filter(Boolean);
        const slotKeys = (slotKeysCsv || "").split(",").map(v => v.trim()).filter(Boolean);

        dayIds.forEach(function (dayId) {
            $container.find(`.day-checkbox[data-day-id="${dayId}"]`).prop("checked", true);
        });

        slotKeys.forEach(function (slotKey) {
            const $slot = $container.find(`.slot-checkbox[data-slot-key="${slotKey}"]`);
            $slot.prop("checked", true);
            const dayId = ($slot.data("dayId") || "").toString();
            if (dayId) {
                $container.find(`.day-checkbox[data-day-id="${dayId}"]`).prop("checked", true);
            }
        });

        syncAvailabilityInputs(prefix);
    }

    // Convert stored day ID CSV to readable day labels for table rendering.
    function formatDayIds(dayIdsCsv) {
        if (!dayIdsCsv) return "-";
        const idToShort = DAY_OPTIONS.reduce(function (acc, day) {
            acc[day.id] = day.short;
            return acc;
        }, {});

        return dayIdsCsv
            .split(",")
            .map(v => v.trim())
            .filter(Boolean)
            .map(id => idToShort[id] || `Day ${id}`)
            .join(", ");
    }

    // Load all appointments into admin table.
    function loadAppointments() {
        $.ajax({
            url: "backend/api/admin.php?action=get_appointments",
            method: "GET",
            success: function (res) {
                const tbody = $("#appointmentsList");
                tbody.empty();
                if (res.success && res.appointments.length > 0) {
                    res.appointments.forEach(a => {
                        const badgeClass = a.status === "Cancelled" ? "bg-danger" :
                            a.status === "Completed" ? "bg-secondary" :
                                a.status === "Pending" ? "bg-warning text-dark" : "bg-success";
                        tbody.append(`
                            <tr>
                                <td class="fw-bold text-secondary">#${a.reference_no}</td>
                                <td>
                                    <div class="fw-bold">${a.patient_name}</div>
                                </td>
                                <td>${a.patient_phone}</td>
                                <td>
                                    <div class="fw-bold text-primary">${a.doctor_name}</div>
                                    <small class="text-muted">${a.specialization}</small>
                                </td>
                                <td>
                                    <div class="fw-500">${a.appointment_date}</div>
                                    <small class="text-muted"><i class="bi bi-clock"></i> ${a.time_slot}</small>
                                </td>
                                <td>
                                    <span class="badge ${badgeClass} rounded-pill px-3 py-2">${a.status}</span>
                                </td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append("<tr><td colspan='6' class='text-center py-4 text-muted'>No appointments found.</td></tr>");
                }
            }
        });
    }

    // Load doctor directory into admin table.
    function loadDoctors() {
        $.ajax({
            url: "backend/api/admin.php?action=get_doctors",
            method: "GET",
            success: function (res) {
                const tbody = $("#doctorsList");
                tbody.empty();
                if (res.success && res.doctors.length > 0) {
                    res.doctors.forEach(d => {
                        const thumb = d.photo_url ? `<img src="${d.photo_url}" alt="${d.doctor_name}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;margin-right:8px;border:1px solid #e2e8f0;">` : "";
                        tbody.append(`
                            <tr>
                                <td>
                                    <div class="fw-bold" style="color: var(--primary-blue);">${thumb}${d.doctor_name}</div>
                                    <small class="text-muted">${d.email}</small>
                                </td>
                                <td><span class="badge bg-light text-dark border px-2 py-1">${d.specialization}</span></td>
                                <td>${d.experience}</td>
                                <td><small class="text-muted">${formatDayIds(d.available_days)}</small></td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3 me-1" onclick='openEditModal(${JSON.stringify(d)})'>Edit</button>
                                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteDoctor(${d.doctor_id})">Remove</button>
                                </td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append("<tr><td colspan='5' class='text-center py-4 text-muted'>No doctors found.</td></tr>");
                }
            }
        });
    }

    // Load customer support staff list into admin table.
    function loadSupportStaff() {
        $.ajax({
            url: "backend/api/admin.php?action=get_support_staff",
            method: "GET",
            dataType: "json",
            success: function (res) {
                const tbody = $("#supportList");
                tbody.empty();

                if (res.success && Array.isArray(res.staff) && res.staff.length > 0) {
                    res.staff.forEach(function (s) {
                        const payload = encodeURIComponent(JSON.stringify(s));
                        tbody.append(`
                            <tr>
                                <td><div class="fw-bold">${escapeHtml(s.staff_name || "N/A")}</div></td>
                                <td>${escapeHtml(s.email || "N/A")}</td>
                                <td>${escapeHtml(s.created_at || "N/A")}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3 me-1" onclick="openEditStaffModal('${payload}')">Edit</button>
                                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteSupportStaff(${Number(s.staff_id)})">Remove</button>
                                </td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append("<tr><td colspan='4' class='text-center py-4 text-muted'>No support staff found.</td></tr>");
                }
            },
            error: function () {
                $("#supportList").html("<tr><td colspan='4' class='text-center py-4 text-danger'>Failed to load support staff.</td></tr>");
            }
        });
    }

    // Escape untrusted text before rendering in table cells.
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Load public contact messages for admin review.
    function loadMessages() {
        $.ajax({
            url: "backend/api/admin.php?action=get_messages",
            method: "GET",
            dataType: "json",
            success: function (res) {
                const tbody = $("#messagesList");
                tbody.empty();

                if (res.success && Array.isArray(res.messages) && res.messages.length > 0) {
                    res.messages.forEach(function (m) {
                        const statusText = (m.status || "Open").toString();
                        const statusLower = statusText.toLowerCase();
                        const isResolved = statusLower === "resolved";
                        const isIgnored = statusLower === "ignored";
                        const statusBadgeClass = isResolved
                            ? "bg-success"
                            : (isIgnored ? "bg-secondary" : "bg-warning text-dark");
                        const resolvedBy = m.resolved_by_name ? `by ${escapeHtml(m.resolved_by_name)}` : "";
                        const resolvedAt = m.resolved_at ? `${escapeHtml(m.resolved_at)}` : "";
                        const resolvedMeta = (isResolved || isIgnored) && (resolvedBy || resolvedAt)
                            ? `<div class="small text-muted mt-1">${resolvedBy}${resolvedBy && resolvedAt ? " | " : ""}${resolvedAt}</div>`
                            : "";

                        const resolveButton = isResolved
                            ? `<button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" disabled>Resolved</button>`
                            : (isIgnored
                                ? `<button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" disabled>Resolve</button>`
                                : `<button class="btn btn-sm btn-outline-primary rounded-pill px-3 me-1" onclick="resolveMessage(${Number(m.message_id)})">Resolve</button>`);

                        const ignoreButton = isIgnored
                            ? `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 me-1" disabled>Ignored</button>`
                            : `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 me-1" onclick="ignoreMessage(${Number(m.message_id)})">Ignore</button>`;

                        tbody.append(`
                            <tr>
                                <td>${escapeHtml(m.created_at || "N/A")}</td>
                                <td>${escapeHtml(m.name || "N/A")}</td>
                                <td>${escapeHtml(m.email || "N/A")}</td>
                                <td>${escapeHtml(m.whatsapp_number || "-")}</td>
                                <td>${escapeHtml(m.subject || "-")}</td>
                                <td style="max-width: 360px; white-space: normal;">${escapeHtml(m.message || "")}</td>
                                <td>
                                    <span class="badge ${statusBadgeClass} rounded-pill px-3 py-2">${escapeHtml(statusText)}</span>
                                    ${resolvedMeta}
                                </td>
                                <td>
                                    ${resolveButton}
                                    ${ignoreButton}
                                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteMessage(${Number(m.message_id)})">Delete</button>
                                </td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append("<tr><td colspan='8' class='text-center py-4 text-muted'>No messages found.</td></tr>");
                }
            },
            error: function () {
                const tbody = $("#messagesList");
                tbody.html("<tr><td colspan='8' class='text-center py-4 text-danger'>Failed to load messages.</td></tr>");
            }
        });
    }

    // Load logged-in admin profile details and prefill edit modal fields.
    function loadAdminProfile() {
        $.ajax({
            url: "backend/api/admin.php?action=get_profile",
            method: "GET",
            dataType: "json",
            success: function (res) {
                if (!res.success || !res.profile) {
                    return;
                }

                adminProfile = res.profile;
                $("#adminName").text(adminProfile.name || "N/A");
                $("#adminEmail").text(adminProfile.email || "N/A");
                $("#adminRole").text(adminProfile.role || "admin");
                $("#adminCreatedAt").text(adminProfile.created_at || "N/A");

                $("#editAdminName").val(adminProfile.name || "");
                $("#editAdminEmail").val(adminProfile.email || "");
                clearAdminPasswordInputs();
            }
        });
    }

    // Submit add doctor form with profile image + day/slot ID strings.
    $("#addDoctorForm").on("submit", function (e) {
        e.preventDefault();
        syncAvailabilityInputs("add");

        const availableDays = $("#docDays").val().trim();
        const availableSlots = $("#docSlots").val().trim();
        const password = $("#docPassword").val().trim();
        const confirmPassword = $("#docConfirmPassword").val().trim();

        if (!availableDays || !availableSlots) {
            alert("Please select at least one day and one slot.");
            return;
        }
        if (password.length < 6) {
            alert("Doctor password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            alert("Password and confirm password do not match.");
            return;
        }

        const formData = new FormData();
        formData.append("name", $("#docName").val().trim());
        formData.append("email", $("#docEmail").val().trim());
        formData.append("password", password);
        formData.append("confirm_password", confirmPassword);
        formData.append("specialization", $("#docSpec").val().trim());
        formData.append("experience", $("#docExp").val().trim());
        formData.append("fee", $("#docFee").val().trim());
        formData.append("available_days", availableDays);
        formData.append("available_slots", availableSlots);

        const photo = $("#docPhoto")[0].files[0];
        if (photo) {
            formData.append("photo", photo);
        }

        $.ajax({
            url: "backend/api/admin.php?action=add_doctor",
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.success) {
                    alert("Doctor added successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("addDoctorModal")).hide();
                    $("#addDoctorForm")[0].reset();
                    applyAvailabilityFromIds("add", "", "");
                    clearPreview("#docPhotoPreviewWrap", "#docPhotoPreview", "#docPhotoPreviewWrap .photo-preview-text", "Selected image preview");
                    loadDoctors();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    });

    // Open edit modal and restore day/slot IDs into checkbox UI.
    window.openEditModal = function (doctor) {
        $("#editDocId").val(doctor.doctor_id);
        $("#editDocName").val(doctor.doctor_name);
        $("#editDocEmail").val(doctor.email);
        $("#editDocSpec").val(doctor.specialization);
        $("#editDocExp").val(doctor.experience);
        $("#editDocFee").val(doctor.fee);
        $("#editDocPhoto").val("");
        clearEditPasswordInputs();

        if (doctor.photo_url) {
            setPreviewFromUrl(
                doctor.photo_url,
                "#editDocPhotoPreviewWrap",
                "#editDocPhotoPreview",
                "#editDocPhotoPreviewText",
                "Current doctor image",
                false
            );
        } else {
            clearPreview("#editDocPhotoPreviewWrap", "#editDocPhotoPreview", "#editDocPhotoPreviewText", "Current/selected image preview");
        }

        applyAvailabilityFromIds("edit", doctor.available_days, doctor.available_slots);

        const editModal = new bootstrap.Modal(document.getElementById("editDoctorModal"));
        editModal.show();
    };

    // Submit doctor updates including optional new profile image.
    $("#editDoctorForm").on("submit", function (e) {
        e.preventDefault();
        syncAvailabilityInputs("edit");

        const availableDays = $("#editDocDays").val().trim();
        const availableSlots = $("#editDocSlots").val().trim();
        const currentPassword = $("#editCurrentPassword").val().trim();
        const newPassword = $("#editNewPassword").val().trim();
        const confirmNewPassword = $("#editConfirmNewPassword").val().trim();
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmNewPassword !== "";
        if (!availableDays || !availableSlots) {
            alert("Please select at least one day and one slot.");
            return;
        }
        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmNewPassword) {
                alert("To change password, fill current password, new password, and confirm new password.");
                return;
            }
            if (newPassword.length < 6) {
                alert("New password must be at least 6 characters.");
                return;
            }
            if (newPassword !== confirmNewPassword) {
                alert("New password and confirm new password do not match.");
                return;
            }
        }

        const formData = new FormData();
        formData.append("doctor_id", $("#editDocId").val());
        formData.append("name", $("#editDocName").val().trim());
        formData.append("email", $("#editDocEmail").val().trim());
        formData.append("specialization", $("#editDocSpec").val().trim());
        formData.append("experience", $("#editDocExp").val().trim());
        formData.append("fee", $("#editDocFee").val().trim());
        formData.append("available_days", availableDays);
        formData.append("available_slots", availableSlots);
        if (wantsPasswordChange) {
            formData.append("current_password", currentPassword);
            formData.append("new_password", newPassword);
            formData.append("confirm_new_password", confirmNewPassword);
        }

        const photo = $("#editDocPhoto")[0].files[0];
        if (photo) {
            formData.append("photo", photo);
        }

        $.ajax({
            url: "backend/api/admin.php?action=update_doctor",
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.success) {
                    alert("Doctor updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editDoctorModal")).hide();
                    loadDoctors();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    });

    // Submit admin profile updates with optional password change.
    $("#editAdminProfileForm").on("submit", function (e) {
        e.preventDefault();

        const name = $("#editAdminName").val().trim();
        const email = $("#editAdminEmail").val().trim();
        const currentPassword = $("#editAdminCurrentPassword").val().trim();
        const newPassword = $("#editAdminNewPassword").val().trim();
        const confirmPassword = $("#editAdminConfirmPassword").val().trim();
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

        if (!name || !email) {
            alert("Name and email are required.");
            return;
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert("To change password, fill current password, new password, and confirm password.");
                return;
            }
            if (newPassword.length < 6) {
                alert("New password must be at least 6 characters.");
                return;
            }
            if (newPassword !== confirmPassword) {
                alert("New password and confirm password do not match.");
                return;
            }
        }

        $.ajax({
            url: "backend/api/admin.php?action=update_profile",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                name: name,
                email: email,
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            }),
            success: function (res) {
                if (res.success) {
                    alert("Profile updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editAdminProfileModal")).hide();
                    loadAdminProfile();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    });

    // Add new customer support staff account.
    $("#addStaffForm").on("submit", function (e) {
        e.preventDefault();

        const name = $("#staffName").val().trim();
        const email = $("#staffEmail").val().trim();
        const password = $("#staffPassword").val().trim();
        const confirmPassword = $("#staffConfirmPassword").val().trim();

        if (!name || !email || !password || !confirmPassword) {
            alert("All fields are required.");
            return;
        }
        if (password.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            alert("Password and confirm password do not match.");
            return;
        }

        $.ajax({
            url: "backend/api/admin.php?action=add_support_staff",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                name: name,
                email: email,
                password: password,
                confirm_password: confirmPassword
            }),
            success: function (res) {
                if (res.success) {
                    alert("Support staff added successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("addSupportModal")).hide();
                    loadSupportStaff();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    });

    // Open support edit modal with selected row data.
    window.openEditStaffModal = function (encodedPayload) {
        let staff = null;
        try {
            staff = JSON.parse(decodeURIComponent(encodedPayload));
        } catch (err) {
            alert("Could not open staff record.");
            return;
        }

        $("#editStaffId").val(staff.staff_id);
        $("#editStaffName").val(staff.staff_name || "");
        $("#editStaffEmail").val(staff.email || "");
        clearEditSupportPasswordInputs();

        const modal = new bootstrap.Modal(document.getElementById("editSupportModal"));
        modal.show();
    };

    // Submit support staff edits with optional password change.
    $("#editStaffForm").on("submit", function (e) {
        e.preventDefault();

        const staffId = $("#editStaffId").val();
        const name = $("#editStaffName").val().trim();
        const email = $("#editStaffEmail").val().trim();
        const currentPassword = $("#editStaffCurrentPassword").val().trim();
        const newPassword = $("#editStaffNewPassword").val().trim();
        const confirmPassword = $("#editStaffConfirmPassword").val().trim();
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

        if (!staffId || !name || !email) {
            alert("Name and email are required.");
            return;
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert("To change password, fill current password, new password, and confirm password.");
                return;
            }
            if (newPassword.length < 6) {
                alert("New password must be at least 6 characters.");
                return;
            }
            if (newPassword !== confirmPassword) {
                alert("New password and confirm password do not match.");
                return;
            }
        }

        $.ajax({
            url: "backend/api/admin.php?action=update_support_staff",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                staff_id: Number(staffId),
                name: name,
                email: email,
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            }),
            success: function (res) {
                if (res.success) {
                    alert("Support staff updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editSupportModal")).hide();
                    loadSupportStaff();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    });

    // Delete support staff.
    window.deleteSupportStaff = function (staffId) {
        if (!confirm("Are you sure you want to remove this support staff account?")) return;

        $.ajax({
            url: "backend/api/admin.php?action=delete_support_staff",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ staff_id: Number(staffId) }),
            success: function (res) {
                if (res.success) {
                    loadSupportStaff();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    };

    // Delete a contact message from admin messages view.
    window.deleteMessage = function (messageId) {
        if (!confirm("Delete this message?")) return;

        $.ajax({
            url: "backend/api/admin.php?action=delete_message",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ message_id: Number(messageId) }),
            success: function (res) {
                if (res.success) {
                    loadMessages();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    };

    // Mark a contact message as resolved from admin messages view.
    window.resolveMessage = function (messageId) {
        if (!confirm("Mark this message as resolved?")) return;

        $.ajax({
            url: "backend/api/admin.php?action=mark_message_resolved",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ message_id: Number(messageId) }),
            success: function (res) {
                if (res.success) {
                    loadMessages();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    };

    // Mark a contact message as ignored from admin messages view.
    window.ignoreMessage = function (messageId) {
        if (!confirm("Mark this message as ignored?")) return;

        $.ajax({
            url: "backend/api/admin.php?action=mark_message_ignored",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ message_id: Number(messageId) }),
            success: function (res) {
                if (res.success) {
                    loadMessages();
                } else {
                    alert("Error: " + res.message);
                }
            }
        });
    };

    // Delete doctor and cascade related data according to DB constraints.
    window.deleteDoctor = function (id) {
        if (confirm("Are you sure you want to remove this doctor and all associated records?")) {
            $.ajax({
                url: "backend/api/admin.php?action=delete_doctor",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify({ doctor_id: id }),
                success: function (res) {
                    if (res.success) {
                        loadDoctors();
                    } else {
                        alert("Error: " + res.message);
                    }
                }
            });
        }
    };
});
