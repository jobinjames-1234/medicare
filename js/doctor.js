/**
 * CarePlus Hospital System - Doctor Portal Logic
 */
$(document).ready(function() {
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

    const DAY_NAME_TO_ID = {
        mon: "1",
        tue: "2",
        wed: "3",
        thu: "4",
        fri: "5",
        sat: "6",
        sun: "7"
    };

    let doctorProfile = null;

    initializeScheduleEditorUI();
    bindPasswordToggleHandlers();
    bindPhotoPreviewHandlers();

    // Check auth
    $.ajax({
        url: "backend/api/auth.php?action=check_session",
        method: "GET",
        dataType: "json",
        success: function(res) {
            if (!res.success || res.role !== "doctor") {
                window.location.href = "login.html";
            } else {
                // If there's a hash, handle it. Otherwise, the default view is appointments, so load its data.
                if (window.location.hash) {
                    handleHashChange();
                } else {
                    loadSchedule(); // For the default appointments view
                }
                loadProfile(); // Load profile data for modals and schedule tab regardless
            }
        }
    });

    window.switchTab = function(tabName) {
        $(".nav-item").removeClass("active");
        const $targetTabItem = $(`.nav-item[onclick*="switchTab('${tabName}')"]`);
        if ($targetTabItem.length) {
            $targetTabItem.addClass("active");
        }

        $("#appointmentsTab, #scheduleTab, #profileTab").addClass("d-none");

        if (tabName === "appointments") {
            $("#appointmentsTab").removeClass("d-none");
            $("#pageTitle").text("My Appointments");
            loadSchedule();
        } else if (tabName === "schedule") {
            $("#scheduleTab").removeClass("d-none");
            $("#pageTitle").text("My Schedule");
            if (doctorProfile) {
                renderScheduleReadonly(doctorProfile.available_days, doctorProfile.available_slots);
                applyScheduleToEditor(doctorProfile.available_days, doctorProfile.available_slots);
            } else {
                loadProfile();
            }
        } else if (tabName === "profile") {
            $("#profileTab").removeClass("d-none");
            $("#pageTitle").text("My Profile");
            loadProfile();
        }
    };

    function handleHashChange() {
        if (window.location.hash) {
            const tab = window.location.hash.substring(1).toLowerCase();
            if (['appointments', 'schedule', 'profile'].includes(tab)) {
                switchTab(tab);
            }
        }
    }

    $(window).on('hashchange', handleHashChange);

    function loadSchedule() {
        $.ajax({
            url: "backend/api/doctor.php?action=get_schedule",
            method: "GET",
            success: function(res) {
                renderAppointments(res.success && Array.isArray(res.appointments) ? res.appointments : []);
            }
        });
    }

    function renderAppointments(appointments) {
        const tbody = $("#docAppointmentsList");
        tbody.empty();

        if (appointments.length === 0) {
            tbody.append(`<tr><td colspan="5" class="text-center py-4 text-muted">No appointments found.</td></tr>`);
            return;
        }

        appointments.forEach(function(a) {
            const phone = a.registered_phone || a.patient_phone;
            const viewDocBtn = a.booking_documents
                ? `<a class="btn btn-sm btn-outline-primary rounded-pill px-3 me-2" href="${a.booking_documents}" target="_blank" rel="noopener">View Document</a>`
                : `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3 me-2" disabled title="Receipt PDF not generated yet">View Document</button>`;
            const badgeClass = a.status === "Cancelled" ? "bg-danger" :
                a.status === "Completed" ? "bg-secondary" :
                    a.status === "Pending" ? "bg-warning text-dark" : "bg-success";

            let actionHtml = viewDocBtn;
            if (a.status === "Confirmed") {
                actionHtml = `${viewDocBtn}<button class="btn btn-sm btn-outline-success rounded-pill px-3" onclick="updateStatus(${a.appointment_id}, 'Completed')">Mark Complete</button>`;
            } else if (a.status === "Pending") {
                actionHtml = `${viewDocBtn}<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="updateStatus(${a.appointment_id}, 'Confirmed')">Confirm</button>`;
            }

            tbody.append(`
                <tr>
                    <td>
                        <div class="fw-bold" style="color: var(--medical-teal);">${a.appointment_date}</div>
                        <small class="text-muted"><i class="bi bi-clock"></i> ${a.time_slot}</small>
                    </td>
                    <td>
                        <div class="fw-bold text-dark">${a.patient_name}</div>
                        <small class="text-secondary">Ref: #${a.reference_no}</small>
                    </td>
                    <td>${phone}</td>
                    <td><span class="badge ${badgeClass} rounded-pill px-3 py-2">${a.status}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `);
        });
    }

    function loadProfile() {
        $.ajax({
            url: "backend/api/doctor.php?action=get_profile",
            method: "GET",
            success: function(res) {
                if (!res.success || !res.profile) {
                    return;
                }

                doctorProfile = res.profile;
                renderProfileCard(doctorProfile);
                renderScheduleReadonly(doctorProfile.available_days, doctorProfile.available_slots);
                fillProfileEditForm(doctorProfile);
                applyScheduleToEditor(doctorProfile.available_days, doctorProfile.available_slots);
            }
        });
    }

    function renderProfileCard(profile) {
        $("#dName").text(profile.doctor_name || profile.name || "N/A");
        $("#dEmail").text(profile.email || "N/A");
        $("#dSpec").text(profile.specialization || "N/A");
        $("#dExp").text(profile.experience || "N/A");
        $("#dFee").text(profile.fee || "N/A");

        if (profile.photo_url) {
            $("#dPhotoWrap").html(`<img src="${profile.photo_url}" alt="Doctor photo" style="width:72px;height:72px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;">`);
        } else {
            $("#dPhotoWrap").html(`<span class="text-muted">N/A</span>`);
        }
    }

    function fillProfileEditForm(profile) {
        $("#editDoctorName").val(profile.doctor_name || profile.name || "");
        $("#editDoctorEmail").val(profile.email || "");
        $("#editDoctorSpec").val(profile.specialization || "");
        $("#editDoctorExp").val(profile.experience || "");
        $("#editDoctorFee").val(profile.fee || "");
        $("#editDoctorPhoto").val("");
        clearProfilePasswordInputs();

        if (profile.photo_url) {
            setPreviewFromUrl(
                profile.photo_url,
                "#editDoctorPhotoPreviewWrap",
                "#editDoctorPhotoPreview",
                "#editDoctorPhotoPreviewText",
                "Current doctor image",
                false
            );
        } else {
            clearPreview(
                "#editDoctorPhotoPreviewWrap",
                "#editDoctorPhotoPreview",
                "#editDoctorPhotoPreviewText",
                "Current/selected image preview"
            );
        }
    }

    function normalizeDayToken(token) {
        const t = (token || "").toString().trim();
        if (!t) return "";
        if (/^[1-7]$/.test(t)) return t;
        const short = t.substring(0, 3).toLowerCase();
        return DAY_NAME_TO_ID[short] || "";
    }

    function parseDayIds(dayCsv) {
        const set = new Set();
        (dayCsv || "")
            .split(",")
            .map(v => normalizeDayToken(v))
            .filter(Boolean)
            .forEach(v => set.add(v));
        return set;
    }

    function parseSlotData(slotCsv) {
        const structuredKeys = new Set();
        const legacyLabels = new Set();

        (slotCsv || "")
            .split(",")
            .map(v => v.trim())
            .filter(Boolean)
            .forEach(function(token) {
                if (/^[1-7]_[1-6]$/.test(token)) {
                    structuredKeys.add(token);
                } else {
                    legacyLabels.add(token);
                }
            });

        return { structuredKeys: structuredKeys, legacyLabels: legacyLabels };
    }

    function renderScheduleReadonly(dayCsv, slotCsv) {
        const daySet = parseDayIds(dayCsv);
        const slotData = parseSlotData(slotCsv);
        const container = $("#doctorAvailabilityView");

        let html = "";
        DAY_OPTIONS.forEach(function(day) {
            const isDayChecked = daySet.has(day.id);
            html += `
                <details class="availability-day" ${isDayChecked ? "open" : ""}>
                    <summary>
                        <div class="form-check m-0">
                            <input class="form-check-input" type="checkbox" disabled ${isDayChecked ? "checked" : ""}>
                            <label class="form-check-label">${day.label}</label>
                        </div>
                    </summary>
                    <div class="availability-content">
                        <div class="slot-grid">
                            ${SLOT_OPTIONS.map(function(slot) {
                                const key = `${day.id}_${slot.id}`;
                                const checked = slotData.structuredKeys.has(key) || slotData.legacyLabels.has(slot.label);
                                return `
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" disabled ${checked ? "checked" : ""}>
                                        <label class="form-check-label">${slot.label}</label>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </details>
            `;
        });

        container.html(html);
    }

    function initializeScheduleEditorUI() {
        buildScheduleEditorUI();
        bindScheduleEditorEvents();
        syncScheduleEditorInputs();
    }

    function buildScheduleEditorUI() {
        const container = $("#editScheduleAvailabilityBuilder");
        if (!container.length) return;

        let html = "";
        DAY_OPTIONS.forEach(function(day) {
            html += `
                <details class="availability-day" ${day.id === "1" ? "open" : ""}>
                    <summary>
                        <div class="form-check m-0">
                            <input class="form-check-input edit-day-checkbox" type="checkbox" data-day-id="${day.id}" id="edit_sched_day_${day.id}">
                            <label class="form-check-label" for="edit_sched_day_${day.id}">${day.label}</label>
                        </div>
                    </summary>
                    <div class="availability-content">
                        <div class="slot-grid">
                            ${SLOT_OPTIONS.map(function(slot) {
                                const key = `${day.id}_${slot.id}`;
                                return `
                                    <div class="form-check">
                                        <input class="form-check-input edit-slot-checkbox" type="checkbox" data-day-id="${day.id}" data-slot-id="${slot.id}" data-slot-key="${key}" id="edit_sched_slot_${key}">
                                        <label class="form-check-label" for="edit_sched_slot_${key}">${slot.label}</label>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </details>
            `;
        });
        container.html(html);
    }

    function bindScheduleEditorEvents() {
        const container = $("#editScheduleAvailabilityBuilder");
        if (!container.length) return;

        container.on("change", ".edit-day-checkbox", function() {
            const dayId = $(this).data("dayId").toString();
            if (!this.checked) {
                container.find(`.edit-slot-checkbox[data-day-id="${dayId}"]`).prop("checked", false);
            }
            syncScheduleEditorInputs();
        });

        container.on("change", ".edit-slot-checkbox", function() {
            const dayId = $(this).data("dayId").toString();
            const dayCheckbox = container.find(`.edit-day-checkbox[data-day-id="${dayId}"]`);
            const anyChecked = container.find(`.edit-slot-checkbox[data-day-id="${dayId}"]:checked`).length > 0;

            if (this.checked) {
                dayCheckbox.prop("checked", true);
            } else if (!anyChecked) {
                dayCheckbox.prop("checked", false);
            }
            syncScheduleEditorInputs();
        });
    }

    function syncScheduleEditorInputs() {
        const container = $("#editScheduleAvailabilityBuilder");
        const dayIds = container.find(".edit-day-checkbox:checked").map(function() {
            return $(this).data("dayId").toString();
        }).get();
        const slotKeys = container.find(".edit-slot-checkbox:checked").map(function() {
            return $(this).data("slotKey").toString();
        }).get();

        $("#editScheduleDays").val(dayIds.join(","));
        $("#editScheduleSlots").val(slotKeys.join(","));
    }

    function applyScheduleToEditor(dayCsv, slotCsv) {
        const container = $("#editScheduleAvailabilityBuilder");
        if (!container.length) return;

        container.find(".edit-day-checkbox, .edit-slot-checkbox").prop("checked", false);

        const daySet = parseDayIds(dayCsv);
        const slotData = parseSlotData(slotCsv);

        daySet.forEach(function(dayId) {
            container.find(`.edit-day-checkbox[data-day-id="${dayId}"]`).prop("checked", true);
        });

        slotData.structuredKeys.forEach(function(slotKey) {
            const slotCheckbox = container.find(`.edit-slot-checkbox[data-slot-key="${slotKey}"]`);
            slotCheckbox.prop("checked", true);
            const dayId = (slotCheckbox.data("dayId") || "").toString();
            if (dayId) {
                container.find(`.edit-day-checkbox[data-day-id="${dayId}"]`).prop("checked", true);
            }
        });

        if (slotData.legacyLabels.size > 0) {
            container.find(".edit-slot-checkbox").each(function() {
                const slotLabel = SLOT_OPTIONS.find(s => s.id === $(this).data("slotId").toString());
                if (slotLabel && slotData.legacyLabels.has(slotLabel.label)) {
                    $(this).prop("checked", true);
                    const dayId = $(this).data("dayId").toString();
                    container.find(`.edit-day-checkbox[data-day-id="${dayId}"]`).prop("checked", true);
                }
            });
        }

        syncScheduleEditorInputs();
    }

    function bindPhotoPreviewHandlers() {
        $("#editDoctorPhoto").on("change", function() {
            setPreviewFromFile(
                this,
                "#editDoctorPhotoPreviewWrap",
                "#editDoctorPhotoPreview",
                "#editDoctorPhotoPreviewText",
                "Selected new image preview"
            );
        });

        $("#editDoctorProfileModal").on("hidden.bs.modal", function() {
            clearPreview(
                "#editDoctorPhotoPreviewWrap",
                "#editDoctorPhotoPreview",
                "#editDoctorPhotoPreviewText",
                "Current/selected image preview"
            );
            $("#editDoctorPhoto").val("");
            clearProfilePasswordInputs();
        });
    }

    function bindPasswordToggleHandlers() {
        $(document).on("click", ".password-toggle", function() {
            const targetSelector = $(this).data("target");
            const input = $(targetSelector);
            if (!input.length) return;

            const isHidden = input.attr("type") === "password";
            input.attr("type", isHidden ? "text" : "password");

            const icon = $(this).find("i");
            icon.toggleClass("bi-eye", !isHidden);
            icon.toggleClass("bi-eye-slash", isHidden);
        });
    }

    function clearProfilePasswordInputs() {
        $("#editDoctorCurrentPassword, #editDoctorNewPassword, #editDoctorConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#editDoctorProfileForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    function setPreviewFromFile(fileInput, wrapSel, imgSel, textSel, labelText) {
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreviewFromUrl(url, wrapSel, imgSel, textSel, labelText, true);
    }

    function setPreviewFromUrl(url, wrapSel, imgSel, textSel, labelText, isObjectUrl) {
        const wrap = $(wrapSel);
        const img = $(imgSel);
        const text = $(textSel);

        const prevObjectUrl = img.data("objectUrl");
        if (prevObjectUrl) {
            URL.revokeObjectURL(prevObjectUrl);
            img.removeData("objectUrl");
        }

        if (!url) {
            clearPreview(wrapSel, imgSel, textSel, "Current/selected image preview");
            return;
        }

        img.attr("src", url);
        text.text(labelText);
        wrap.addClass("show");

        if (isObjectUrl) {
            img.data("objectUrl", url);
        }
    }

    function clearPreview(wrapSel, imgSel, textSel, defaultText) {
        const wrap = $(wrapSel);
        const img = $(imgSel);
        const text = $(textSel);

        const prevObjectUrl = img.data("objectUrl");
        if (prevObjectUrl) {
            URL.revokeObjectURL(prevObjectUrl);
            img.removeData("objectUrl");
        }

        img.attr("src", "");
        text.text(defaultText || "Current/selected image preview");
        wrap.removeClass("show");
    }

    $("#editDoctorProfileForm").on("submit", function(e) {
        e.preventDefault();

        const currentPassword = $("#editDoctorCurrentPassword").val().trim();
        const newPassword = $("#editDoctorNewPassword").val().trim();
        const confirmPassword = $("#editDoctorConfirmPassword").val().trim();
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

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

        const formData = new FormData();
        formData.append("name", $("#editDoctorName").val().trim());
        formData.append("email", $("#editDoctorEmail").val().trim());
        formData.append("specialization", $("#editDoctorSpec").val().trim());
        formData.append("experience", $("#editDoctorExp").val().trim());
        formData.append("fee", $("#editDoctorFee").val().trim());
        if (wantsPasswordChange) {
            formData.append("current_password", currentPassword);
            formData.append("new_password", newPassword);
            formData.append("confirm_password", confirmPassword);
        }

        const photo = $("#editDoctorPhoto")[0].files[0];
        if (photo) {
            formData.append("photo", photo);
        }

        $.ajax({
            url: "backend/api/doctor.php?action=update_profile",
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function(res) {
                if (res.success) {
                    alert("Profile updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editDoctorProfileModal")).hide();
                    loadProfile();
                    loadSchedule();
                } else {
                    alert("Error: " + (res.message || "Failed to update profile"));
                }
            }
        });
    });

    $("#editScheduleForm").on("submit", function(e) {
        e.preventDefault();
        syncScheduleEditorInputs();

        const dayCsv = $("#editScheduleDays").val().trim();
        const slotCsv = $("#editScheduleSlots").val().trim();
        if (!dayCsv || !slotCsv) {
            alert("Please select at least one day and one slot.");
            return;
        }

        $.ajax({
            url: "backend/api/doctor.php?action=update_schedule",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                available_days: dayCsv,
                available_slots: slotCsv
            }),
            success: function(res) {
                if (res.success) {
                    alert("Schedule updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editScheduleModal")).hide();
                    loadProfile();
                } else {
                    alert("Error: " + (res.message || "Failed to update schedule"));
                }
            }
        });
    });

    window.updateStatus = function(id, status) {
        if (!confirm(`Mark appointment as ${status}?`)) return;

        $.ajax({
            url: "backend/api/doctor.php?action=update_status",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ appointment_id: id, status: status }),
            success: function(res) {
                if (res.success) {
                    loadSchedule();
                } else {
                    alert("Failed to update status.");
                }
            }
        });
    };
});
