/**
 * CarePlus Hospital System - Main Global Logic
 * Handles doctor listing, booking flow, auth-aware nav, and slot loading.
 */
$(document).ready(function () {
    const API = {
        getDoctors: "backend/api/get_doctors.php",
        checkSlots: "backend/api/check_slots.php",
        bookAppointment: "backend/api/book_appointment.php",
        generateBookingDocument: "backend/api/generate_booking_document.php",
        contactSubmit: "backend/api/contact.php",
        checkSession: "backend/api/auth.php?action=check_session",
        getProfile: "backend/api/patient.php?action=get_profile"
    };

    let globalDoctorsData = [];
    let globalBookedSlots = [];
    let isFinalizingReceipt = false;
    const isBookingPage = window.location.pathname.toLowerCase().includes("booking.html");
    const authState = {
        checked: false,
        success: false,
        role: null
    };

    const today = new Date().toISOString().split("T")[0];
    $("#appointmentDate").attr("min", today);

    loadDoctors();
    if (isBookingPage) {
        setBookingFormEnabled(false, "Checking Login...");
    }
    checkLoginState();
    initializeContactForm();

    // Check logged-in session and adjust page behavior/nav links by role.
    function checkLoginState() {
        $.ajax({
            url: API.checkSession,
            method: "GET",
            dataType: "json",
            success: function (res) {
                authState.checked = true;
                authState.success = !!res.success;
                authState.role = res.role || null;
                updateContactFormVisibility();

                if (res.success && res.role === "patient") {
                    updateAuthLinks("patient_dashboard.html", "My Dashboard");
                    if (isBookingPage) {
                        setBookingFormEnabled(true);
                        fetchPatientProfile();
                    }
                } else if (res.success && res.role === "admin") {
                    updateAuthLinks("admin_dashboard.html", "Admin Panel");
                    if (isBookingPage) window.location.href = "admin_dashboard.html";
                } else if (res.success && res.role === "doctor") {
                    updateAuthLinks("doctor_dashboard.html", "Doctor Portal");
                    if (isBookingPage) window.location.href = "doctor_dashboard.html";
                } else if (res.success && res.role === "cu_support") {
                    updateAuthLinks("customer_support_dashboard.html", "Support Panel");
                    if (isBookingPage) window.location.href = "customer_support_dashboard.html";
                } else if (isBookingPage) {
                    window.location.href = "login.html?redirect=booking.html";
                }
                
                // Apply role-specific index page UI
                if (window.location.pathname.endsWith('/') || window.location.pathname.toLowerCase().includes('index.html')) {
                    applyIndexPageRoleUI(authState.role);
                }
            },
            error: function () {
                authState.checked = true;
                authState.success = false;
                authState.role = null;
                updateContactFormVisibility();
                if (isBookingPage) {
                    window.location.href = "login.html?redirect=booking.html";
                }
            }
        });
    }

    // Update desktop and mobile auth links consistently.
    function updateAuthLinks(href, label) {
        const $desktopAuth = $(".auth-btn");
        const $mobileAuth = $(".login-link");

        if ($desktopAuth.length) {
            $desktopAuth.attr("href", href).text(label);
        }
        if ($mobileAuth.length) {
            $mobileAuth.attr("href", href).text(label);
        }
    }

    // Enable or disable booking form controls while auth is being verified.
    function setBookingFormEnabled(enabled, loadingLabel) {
        const $form = $("#bookingForm");
        if (!$form.length) return;

        const $submitBtn = $form.find("button[type='submit']");
        $form.find("input, select, textarea, button").prop("disabled", !enabled);
        $submitBtn.text(enabled ? "Confirm Appointment" : (loadingLabel || "Checking Login..."));
    }

    // Show contact form for guests/patients; hide for logged-in non-patient roles.
    function updateContactFormVisibility() {
        const $contactForm = $("#contactForm");
        const $restrictedCard = $("#contactFormRestricted");
        if (!$contactForm.length || !$restrictedCard.length) return;

        const isLoggedInNonPatient = authState.success && authState.role && authState.role !== "patient";
        if (isLoggedInNonPatient) {
            $contactForm.addClass("d-none");
            $restrictedCard.removeClass("d-none");
            $("#contactAlert").addClass("d-none").text("");
        } else {
            $contactForm.removeClass("d-none");
            $restrictedCard.addClass("d-none");
        }
    }

    // Submit contact form and show inline status.
    function initializeContactForm() {
        const $form = $("#contactForm");
        if (!$form.length) return;

        const setContactAlert = function (message, type) {
            const kind = type || "info";
            $("#contactAlert")
                .removeClass("d-none alert-success alert-danger alert-info")
                .addClass(`alert-${kind}`)
                .text(message);
        };

        $form.on("submit", function (e) {
            e.preventDefault();

            if (authState.success && authState.role && authState.role !== "patient") {
                setContactAlert("This form is available for visitors and patient accounts only.", "danger");
                return;
            }

            const payload = {
                name: $("#contactName").val().trim(),
                email: $("#contactEmail").val().trim(),
                whatsapp_number: $("#contactWhatsapp").val().trim(),
                subject: $("#contactSubject").val().trim(),
                message: $("#contactMessage").val().trim()
            };

            if (!payload.name || !payload.email || !payload.whatsapp_number || !payload.message) {
                setContactAlert("Please fill name, email, WhatsApp number, and message.", "danger");
                return;
            }

            const phoneRegex = /^\+?[\d\s-]{8,20}$/;
            if (!phoneRegex.test(payload.whatsapp_number)) {
                setContactAlert("Please enter a valid WhatsApp number.", "danger");
                return;
            }

            $.ajax({
                url: API.contactSubmit,
                method: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(payload),
                success: function (res) {
                    if (res.success) {
                        setContactAlert(res.message || "Message sent successfully.", "success");
                        $form[0].reset();
                    } else {
                        setContactAlert(res.message || "Failed to send message.", "danger");
                    }
                },
                error: function () {
                    setContactAlert("Server error occurred while sending message.", "danger");
                }
            });
        });
    }

    // Auto-fill patient name/phone in booking form from profile.
    function fetchPatientProfile() {
        $.ajax({
            url: API.getProfile,
            method: "GET",
            dataType: "json",
            success: function (res) {
                if (res.success && res.profile && $("#patientName").length) {
                    $("#patientName").val(res.profile.name || "").prop("readonly", true);
                    $("#patientPhone").val(res.profile.phone || "").prop("readonly", true);
                }
            }
        });
    }

    // Fetch doctors from backend and initialize doctor-dependent UI sections.
    function loadDoctors() {
        $.getJSON(API.getDoctors, function (data) {
            globalDoctorsData = Array.isArray(data) ? data : [];
            populateDepartmentDropdown(globalDoctorsData);
            populateDoctorDropdown(globalDoctorsData);
            renderHomeDoctors(globalDoctorsData);
        }).fail(function () {
            console.error("Error loading doctor data from backend.");
        });
    }

    // Render doctor cards on the home page (index) if that section exists.
    function renderHomeDoctors(doctors) {
        const $grid = $("#homeDoctorsGrid");
        if (!$grid.length) return;

        $grid.empty();
        doctors.slice(0, 4).forEach(function (doc) {
            const cardHtml = `
                <div class="doc-home-card glass-card">
                    <img src="${doc.photo}" alt="${doc.name}">
                    <div class="doc-card-body">
                        <div class="doc-spec">${doc.specialization}</div>
                        <h3 style="margin: 0.5rem 0; font-size: 1.2rem;">${doc.name}</h3>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                            ${doc.experience} Exp | ${doc.fee}
                        </div>
                        <a href="booking.html" class="btn-primary doc-card-btn" style="padding: 0.5rem 1.2rem; font-size: 0.85rem; width: 100%; justify-content: center;">Book Now</a>
                    </div>
                </div>
            `;
            $grid.append(cardHtml);
        });
        
        // Ensure UI stays synced if auth state was already checked
        if (authState.checked) {
            applyIndexPageRoleUI(authState.role);
        }
    }

    // Role-specific index page DOM adjustments
    function applyIndexPageRoleUI(role) {
        if (role === 'admin') {
            $('.hero .btn-primary').text('View All Appointments').attr('href', 'admin_dashboard.html');
            
            $('#doctors .section-header h2').html('Manage Our <span>Doctors</span>');
            $('#doctors .section-header p').text('Oversee and manage our world-class specialists with years of proven clinical experience.');
            
            // Adjust buttons at the bottom of the doctors section
            $('#doctors .doctors-list-grid + div').html(`
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <a href="admin_dashboard.html" class="btn-primary">View Doctor and View Availability</a>
                    <a href="admin_dashboard.html" class="btn-secondary" style="border-radius: 50px; padding: 1rem 2rem;">View All Doctor Lists</a>
                </div>
            `);
            
            // Adjust buttons inside the doctor cards
            $('.doc-home-card .doc-card-btn').text('View Doctor').attr('href', 'admin_dashboard.html');
            
            // Remove contact section
            $('#contact').remove();
            
        } else if (role === 'doctor') {
            $('.hero .btn-primary').text('View My Appointments').attr('href', 'doctor_dashboard.html');
            
            $('#doctors .section-header h2').html('View My <span>Profile</span>');
            $('#doctors .section-header p').text('Access and manage your professional profile and information.');
            
            // Adjust buttons at the bottom of the doctors section
            $('#doctors .doctors-list-grid + div').remove();
            
            // Remove contact section
            $('#contact').remove();

            // Fetch and render the logged-in doctor's profile card
            $.ajax({
                url: 'backend/api/doctor.php?action=get_profile',
                method: 'GET',
                success: function(res) {
                    if (res.success && res.profile) {
                        const p = res.profile;
                        const cardHtml = `
                            <div class="doc-home-card glass-card" style="grid-column: 1/-1; max-width: 320px; margin: 0 auto;">
                                <img src="${p.photo_url || 'assets/img/default-doctor.jpg'}" alt="${p.doctor_name || p.name}">
                                <div class="doc-card-body">
                                    <div class="doc-spec">${p.specialization}</div>
                                    <h3 style="margin: 0.5rem 0; font-size: 1.2rem;">${p.doctor_name || p.name}</h3>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                                        ${p.experience} Exp | ${p.fee}
                                    </div>
                                    <a href="doctor_dashboard.html#profile" class="btn-primary" style="padding: 0.5rem 1.2rem; font-size: 0.85rem; width: 100%; justify-content: center;">View My Profile</a>
                                </div>
                            </div>
                        `;
                        $('#homeDoctorsGrid').html(cardHtml);
                    }
                }
            });
        }
    }

    // Fill specialty dropdown using unique doctor specializations.
    function populateDepartmentDropdown(doctors) {
        const $select = $("#departmentSelect");
        if (!$select.length) return;

        const departments = [...new Set(doctors.map(doc => doc.specialization))];
        $select.find("option:not(:first)").remove();
        departments.forEach(function (dept) {
            $select.append(`<option value="${dept}">${dept}</option>`);
        });
    }

    // Fill doctor dropdown based on selected specialty or full list.
    function populateDoctorDropdown(doctors) {
        const $select = $("#doctorSelect");
        if (!$select.length) return;

        $select.find("option:not(:first)").remove();
        doctors.forEach(function (doc) {
            $select.append(`<option value="${doc.id}">${doc.name} (${doc.specialization})</option>`);
        });
    }

    $("#departmentSelect").on("change", function () {
        const selectedDept = $(this).val();
        const filteredDoctors = selectedDept === "all"
            ? globalDoctorsData
            : globalDoctorsData.filter(doc => doc.specialization === selectedDept);

        populateDoctorDropdown(filteredDoctors);
        $("#doctorSelect").val("");
        refreshSlotView();
    });

    $("#doctorSelect, #appointmentDate").on("change", function () {
        refreshSlotView();
    });

    // Update doctor preview card and trigger slot loading for selected doctor/date.
    function refreshSlotView() {
        const doctorId = $("#doctorSelect").val();
        const selectedDate = $("#appointmentDate").val();
        const $cardSection = $("#doctorCardSection");

        if (doctorId) {
            const docInfo = globalDoctorsData.find(d => d.id === parseInt(doctorId, 10));
            if (docInfo) {
                $("#dcPhoto").attr("src", docInfo.photo);
                $("#dcName").text(docInfo.name);
                $("#dcSpec").text(docInfo.specialization);
                $("#dcExp").text(docInfo.experience);
                $("#dcFee").text(docInfo.fee);
                $cardSection.removeClass("doctor-card-hidden").addClass("doctor-card-show");
            }
        } else {
            $cardSection.removeClass("doctor-card-show").addClass("doctor-card-hidden");
        }

        if (doctorId && selectedDate) {
            checkAvailabilityAndRenderSlots(parseInt(doctorId, 10), selectedDate);
        } else {
            resetSlotsView("Please select a doctor and date to see available slots.");
        }

        $("#selectedSlot").val("");
    }

    // Fetch booked slots for a doctor/date and render slot buttons with availability state.
    function checkAvailabilityAndRenderSlots(doctorId, dateText) {
        $.ajax({
            url: `${API.checkSlots}?doctor_id=${doctorId}&date=${dateText}`,
            method: "GET",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    globalBookedSlots = Array.isArray(res.booked_slots) ? res.booked_slots : [];
                    renderSlots(doctorId, globalBookedSlots, dateText);
                } else {
                    console.error("Failed to fetch slot availability.");
                    globalBookedSlots = [];
                    renderSlots(doctorId, [], dateText);
                }
            },
            error: function () {
                console.warn("Could not load check_slots API, assuming no bookings.");
                globalBookedSlots = [];
                renderSlots(doctorId, [], dateText);
            }
        });
    }

    // Convert selected appointment date to day ID (Mon=1 ... Sun=7).
    function getDayIdFromDate(dateText) {
        const dt = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return null;
        const jsDay = dt.getDay(); // 0=Sun .. 6=Sat
        return jsDay === 0 ? "7" : String(jsDay);
    }

    // Resolve slots from doctor day-slot mapping for the selected date.
    function getSlotsForDoctorOnDate(docRecord, dateText) {
        const dayId = getDayIdFromDate(dateText);
        if (!dayId) return [];
        if (!docRecord.day_slots || !docRecord.day_slots[dayId]) return [];
        return Array.isArray(docRecord.day_slots[dayId]) ? docRecord.day_slots[dayId] : [];
    }

    // Render all slots for a doctor and mark already-booked ones as disabled.
    function renderSlots(doctorId, bookedSlotsList, dateText) {
        const $container = $("#slotsContainer");
        $container.empty();

        const docRecord = globalDoctorsData.find(d => d.id === doctorId);
        if (!docRecord) return;

        const slotsForDate = getSlotsForDoctorOnDate(docRecord, dateText);
        if (!Array.isArray(slotsForDate) || slotsForDate.length === 0) {
            resetSlotsView("No slots available for this doctor on selected day.");
            return;
        }

        slotsForDate.forEach(function (slotTime) {
            const isBooked = bookedSlotsList.includes(slotTime);
            const btnClass = isBooked ? "slot-btn booked" : "slot-btn";
            const stateAttr = isBooked ? "disabled='disabled' title='Slot is already booked'" : "";
            $container.append(`<button type="button" class="${btnClass}" data-slot="${slotTime}" ${stateAttr}>${slotTime}</button>`);
        });
    }

    // Replace slots area with a guidance/placeholder message.
    function resetSlotsView(msg) {
        $("#slotsContainer").html(`<p class="placeholder-text">${msg}</p>`);
    }

    $("#slotsContainer").on("click", ".slot-btn:not(.booked)", function () {
        $(".slot-btn").removeClass("selected");
        $(this).addClass("selected");
        $("#selectedSlot").val($(this).data("slot"));
    });

    $("#bookingForm").on("submit", function (e) {
        e.preventDefault();

        if (!(authState.checked && authState.success && authState.role === "patient")) {
            window.location.href = "login.html?redirect=booking.html";
            return;
        }

        if (!validateForm()) return;

        const patientName = $("#patientName").val().trim();
        const patientPhone = $("#patientPhone").val().trim();
        const doctorId = $("#doctorSelect").val();
        const appointmentDate = $("#appointmentDate").val();
        const selectedTimeSlot = $("#selectedSlot").val();

        if (globalBookedSlots.includes(selectedTimeSlot)) {
            showError($("#slotsContainer"), "Error: Slot already booked. Please choose another slot.");
            refreshSlotView();
            return;
        }

        const doctorInfo = globalDoctorsData.find(d => d.id === parseInt(doctorId, 10));
        const doctorName = doctorInfo ? doctorInfo.name : "";
        const category = doctorInfo ? doctorInfo.specialization : "";
        const refNo = generateReferenceNo();

        $.ajax({
            url: API.bookAppointment,
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                reference_no: refNo,
                doctor_id: parseInt(doctorId, 10),
                patient_name: patientName,
                patient_phone: patientPhone,
                appointment_date: appointmentDate,
                appointment_time: selectedTimeSlot
            }),
            success: function (res) {
                if (res.success) {
                    showBookingConfirmation(
                        res.reference_no || refNo,
                        patientName,
                        patientPhone,
                        category,
                        doctorName,
                        appointmentDate,
                        selectedTimeSlot
                    );

                    $("#selectedSlot").val("");
                    $("#departmentSelect").val("all");
                    populateDoctorDropdown(globalDoctorsData);
                    resetSlotsView("Please select a doctor and date to see available slots.");
                } else {
                    showError($("#slotsContainer"), "Error: " + (res.message || "Booking failed."));
                    refreshSlotView();
                }
            },
            error: function () {
                alert("An error occurred connecting to the server.");
            }
        });
    });

    // Generate a compact booking reference that fits DB column size.
    function generateReferenceNo() {
        const tail = Date.now().toString().slice(-8);
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `APT${tail}${rand}`;
    }

    // Show booking confirmation modal with latest booking details.
    function showBookingConfirmation(ref, patient, phone, category, doctor, date, slot) {
        $("#mRefNo").text(ref);
        $("#mPatientName").text(patient);
        $("#mPatientPhone").text(phone);
        $("#mCategory").text(category);
        $("#mDoctorName").text(doctor);
        $("#mDate").text(date);
        $("#mSlot").text(slot);
        $("#closeModalBtn").prop("disabled", false).text("Done");
        $("#modalOverlay").addClass("active");
        isFinalizingReceipt = false;
    }

    // Generate booking receipt PDF, then navigate to patient dashboard.
    function finalizeReceiptAndRedirect() {
        if (isFinalizingReceipt) return;
        isFinalizingReceipt = true;

        const referenceNo = $("#mRefNo").text().trim();
        const redirectToDashboard = function () {
            $("#modalOverlay").removeClass("active");
            window.location.href = "patient_dashboard.html";
        };

        $("#closeModalBtn").prop("disabled", true).text("Preparing Receipt...");
        if (!referenceNo) {
            redirectToDashboard();
            return;
        }

        $.ajax({
            url: API.generateBookingDocument,
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ reference_no: referenceNo }),
            complete: function () {
                redirectToDashboard();
            }
        });
    }

    $("#closeModalBtn").on("click", function (e) {
        e.preventDefault();
        finalizeReceiptAndRedirect();
    });

    $("#modalOverlay").on("click", function (e) {
        if (e.target.id === "modalOverlay") {
            finalizeReceiptAndRedirect();
        }
    });

    $("#menuBtn").on("click", function () {
        $(this).toggleClass("active");
        $("#navLinks").toggleClass("active");
    });

    $(".nav-links a").on("click", function () {
        $("#menuBtn").removeClass("active");
        $("#navLinks").removeClass("active");
    });

    $("#patientName, #patientPhone, #doctorSelect, #appointmentDate").on("input blur change", function () {
        validateField($(this));
    });

    // Validate one form field and show inline error state if invalid.
    function validateField($field) {
        const val = $field.val() ? $field.val().trim() : "";
        const id = $field.attr("id");
        let isValid = true;
        let errorMsg = "";

        if (id === "patientName") {
            if (!val) {
                isValid = false;
                errorMsg = "Patient name is required";
            } else if (val.length < 3) {
                isValid = false;
                errorMsg = "Name must be at least 3 characters";
            }
        } else if (id === "patientPhone") {
            const phoneRegex = /^\+?[\d\s-]{10,15}$/;
            if (!val) {
                isValid = false;
                errorMsg = "Phone number is required";
            } else if (!phoneRegex.test(val)) {
                isValid = false;
                errorMsg = "Please enter a valid phone number";
            }
        } else if (id === "doctorSelect") {
            if (!val) {
                isValid = false;
                errorMsg = "Please select a doctor";
            }
        } else if (id === "appointmentDate") {
            if (!val) {
                isValid = false;
                errorMsg = "Date is required";
            }
        }

        if (!isValid) {
            showError($field, errorMsg);
        } else {
            clearError($field);
        }

        return isValid;
    }

    // Run full form validation including slot selection before submit.
    function validateForm() {
        const isNameValid = validateField($("#patientName"));
        const isPhoneValid = validateField($("#patientPhone"));
        const isDoctorValid = validateField($("#doctorSelect"));
        const isDateValid = validateField($("#appointmentDate"));

        const selectedTimeSlot = $("#selectedSlot").val();
        let isSlotValid = true;

        if (!selectedTimeSlot) {
            isSlotValid = false;
            showError($("#slotsContainer"), "Please select a time slot");
        } else {
            clearError($("#slotsContainer"));
        }

        return isNameValid && isPhoneValid && isDoctorValid && isDateValid && isSlotValid;
    }

    // Apply error styling/message to a field's containing form-group.
    function showError($field, msg) {
        const $group = $field.closest(".form-group");
        $group.addClass("has-error");
        $field.addClass("error");
        $group.find(".error-msg").text(msg);
    }

    // Remove error styling/message from a field's containing form-group.
    function clearError($field) {
        const $group = $field.closest(".form-group");
        $group.removeClass("has-error");
        $field.removeClass("error");
        $group.find(".error-msg").text("");
    }

    $(window).scroll(function () {
        if ($(window).scrollTop() > 50) {
            $("nav").addClass("nav-sticky");
        } else {
            $("nav").removeClass("nav-sticky");
        }
    });
});
