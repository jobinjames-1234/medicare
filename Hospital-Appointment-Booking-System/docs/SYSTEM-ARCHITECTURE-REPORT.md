# System Architecture Report — CarePlus Hospital Appointment Booking System

**Purpose:** Complete architecture diagram and system map for safe refactoring. No code was modified. This document ensures **no functionality is lost** during refactoring.

---

## 1. ROLE DEFINITIONS

Roles are defined in `users.role` ENUM and enforced in session and API checks.

| Role | Enum Value | Responsibilities |
|------|------------|-----------------|
| **Patient** | `patient` | Register (self only via register.html); log in; book appointments (booking.html); view/cancel own appointments and access booking documents; update own profile; submit contact form (when not logged in as other roles). |
| **Doctor** | `doctor` | Log in; view and manage own appointments (confirm, mark complete); manage availability (available_days, available_slots); update own profile and photo. |
| **Admin** | `admin` | Log in; manage doctors (add, edit, delete); manage customer support staff (add, edit, delete); view all appointments; view and manage contact messages (resolve, ignore, delete); update own profile. No dedicated profile table. |
| **Customer Support** | `cu_support` | Log in; view contact messages; mark messages as Resolved or Ignored; update own profile. **Does not manage appointments** (no schema or API link). |

---

## 2. FRONTEND PAGE MAP

| Page | Role(s) | Main features | JavaScript modules | APIs called |
|------|--------|----------------|--------------------|-------------|
| **index.html** | Public; role-specific UI after login | Home, specialties, doctors list, contact form; role-based CTA (Admin→dashboard, Doctor→profile, Patient→booking) | auth.js, script.js | auth.php (check_session), get_doctors.php, contact.php, doctor.php?action=get_profile (doctor only) |
| **login.html** | Public | Login; redirect by role; link to register, forgot password | auth.js | auth.php (check_session, login) |
| **register.html** | Public | Patient registration (name, email, password, phone, address, DOB) | auth.js | auth.php (register) |
| **booking.html** | Patient (required to book) | Select doctor, date, slot; book appointment; confirmation modal; generate receipt PDF; redirect to patient dashboard | script.js | auth.php (check_session), patient.php?action=get_profile, get_doctors.php, check_slots.php, book_appointment.php, generate_booking_document.php |
| **forgot_password.html** | Public | Request password reset by email; redirect to reset with token | password_reset.js | password_reset.php?action=request_reset |
| **reset_password.html** | Public (with valid token) | Validate token; set new password; redirect to login | password_reset.js | password_reset.php?action=validate_token, password_reset.php?action=reset_password |
| **patient_dashboard.html** | Patient | My Bookings (history, cancel, view document); My Profile (view, edit, change password) | auth.js, patient.js | auth.php (check_session), patient.php (get_history, get_profile, update_profile, cancel_appointment) |
| **doctor_dashboard.html** | Doctor | My Appointments (view, confirm, mark complete, view document); My Schedule (edit availability); My Profile (edit, photo) | auth.js, doctor.js | auth.php (check_session), doctor.php (get_schedule, get_profile, update_profile, update_schedule, update_status) |
| **admin_dashboard.html** | Admin | All Appointments; Manage Doctors (add, edit, delete); Customer Support (add, edit, delete staff); Messages (list, resolve, ignore, delete); My Profile | auth.js, admin.js | auth.php (check_session), admin.php (get_appointments, get_doctors, get_support_staff, get_messages, get_profile, add_doctor, update_doctor, delete_doctor, add_support_staff, update_support_staff, delete_support_staff, update_profile, get_messages, mark_message_resolved, mark_message_ignored, delete_message) |
| **customer_support_dashboard.html** | Customer Support | Messages (list, resolve, ignore); My Profile | auth.js, customer_support.js | auth.php (check_session), customer_support.php (get_messages, mark_message_resolved, mark_message_ignored, get_profile, update_profile) |
| **admin_registration.php** | One-time setup | Create first admin user (form POST to self); delete file after use | (inline form) | Self POST |

---

## 3. JAVASCRIPT MODULE MAP

| File | Functions / behavior | AJAX calls | API endpoints |
|------|----------------------|------------|---------------|
| **script.js** | checkLoginState, updateAuthLinks, setBookingFormEnabled, updateContactFormVisibility, initializeContactForm, fetchPatientProfile, loadDoctors, renderHomeDoctors, applyIndexPageRoleUI, populateDepartmentDropdown, populateDoctorDropdown, refreshSlotView, checkAvailabilityAndRenderSlots, getDayIdFromDate, getSlotsForDoctorOnDate, renderSlots, resetSlotsView, generateReferenceNo, showBookingConfirmation, finalizeReceiptAndRedirect, validateField, validateForm, showError, clearError | GET check_session; GET get_profile; GET get_doctors; GET check_slots; POST contact; POST book_appointment; POST generate_booking_document | backend/api/auth.php?action=check_session, backend/api/patient.php?action=get_profile, backend/api/get_doctors.php, backend/api/check_slots.php, backend/api/contact.php, backend/api/book_appointment.php, backend/api/generate_booking_document.php |
| **auth.js** | checkSessionAndRedirect, redirectBasedOnRole, logout (global) | GET check_session; POST login; POST register; GET logout | backend/api/auth.php (action=check_session|login|register|logout) |
| **patient.js** | bindPasswordToggleHandlers, bindEditProfileModalReset, clearEditPasswordFields, switchTab, loadHistory, loadProfile, cancelAppt | GET check_session; GET get_history; GET get_profile; POST update_profile; POST cancel_appointment | backend/api/auth.php?action=check_session, backend/api/patient.php?action=get_history|get_profile|update_profile|cancel_appointment |
| **doctor.js** | handleHashChange, loadSchedule, renderAppointments, loadProfile, renderProfileCard, fillProfileEditForm, normalizeDayToken, parseDayIds, parseSlotData, renderScheduleReadonly, initializeScheduleEditorUI, buildScheduleEditorUI, bindScheduleEditorEvents, syncScheduleEditorInputs, applyScheduleToEditor, bindPhotoPreviewHandlers, bindPasswordToggleHandlers, clearProfilePasswordInputs, setPreviewFromFile, setPreviewFromUrl, clearPreview, updateStatus | GET check_session; GET get_schedule; GET get_profile; POST update_profile (FormData); POST update_schedule; POST update_status | backend/api/auth.php?action=check_session, backend/api/doctor.php?action=get_schedule|get_profile|update_profile|update_schedule|update_status |
| **admin.js** | switchTab, initializeAvailabilityUI, bindPhotoPreviewHandlers, bindPasswordToggleHandlers, clear*PasswordInputs, buildAvailabilityUI, bindAvailabilityEvents, syncAvailabilityInputs, applyAvailabilityFromIds, formatDayIds, loadAppointments, loadDoctors, loadSupportStaff, loadMessages, loadAdminProfile, escapeHtml, openEditModal, openEditStaffModal, deleteSupportStaff, deleteMessage, resolveMessage, ignoreMessage, deleteDoctor | GET check_session; GET get_appointments, get_doctors, get_support_staff, get_messages, get_profile; POST add_doctor, update_doctor, delete_doctor, add_support_staff, update_support_staff, delete_support_staff, update_profile, delete_message, mark_message_resolved, mark_message_ignored | backend/api/auth.php?action=check_session, backend/api/admin.php?action=* (all admin actions) |
| **customer_support.js** | switchTab, bindPasswordToggleHandlers, bindEditProfileModalReset, clearEditPasswordFields, escapeHtml, loadMessages, markMessageResolved, markMessageIgnored, loadProfile | GET check_session; GET get_messages, get_profile; POST mark_message_resolved, mark_message_ignored, update_profile | backend/api/auth.php?action=check_session, backend/api/customer_support.php?action=get_messages|get_profile|mark_message_resolved|mark_message_ignored|update_profile |
| **password_reset.js** | getSuggestedPassword, setAlert; forgot form: POST request_reset; reset page: GET validate_token, POST reset_password | POST request_reset; GET validate_token; POST reset_password | backend/api/password_reset.php?action=request_reset|validate_token, backend/api/password_reset.php (POST reset_password) |

---

## 4. API ENDPOINT MAP

| Endpoint | Purpose | HTTP method | Parameters / body | Role allowed | Service / logic |
|----------|---------|-------------|-------------------|--------------|-----------------|
| **auth.php** | Login, register, logout, check session | GET (check_session, logout), POST (login, register) | action; POST: email, password; register: name, email, password, confirm_password, phone, address, date_of_birth | Public (login, register, logout, check_session) | Inline: users + patients INSERT/SELECT; session set |
| **book_appointment.php** | Create appointment | POST | reference_no, patient_name, patient_phone, doctor_id, appointment_date, appointment_time | Patient (session) | Inline: doctors SELECT; slot/day validation; appointments INSERT |
| **get_bookings.php** | List bookings (optional filter by patient_phone) | GET | patient_phone (optional) | **No role check** (relies on caller) | Inline: appointments JOIN doctors SELECT |
| **get_doctors.php** | List doctors with parsed availability | GET | — | Public | Inline: doctors SELECT; day_slots parsing |
| **check_slots.php** | Booked slots for doctor+date | GET | doctor_id, date | Public | Inline: appointments SELECT time_slot |
| **check_availability.php** | Legacy booked slots (prefer check_slots.php) | GET | doctorId, date | Public | Inline: appointments SELECT |
| **cancel_appointment.php** | Cancel by appointment_id or reference_no | POST | appointment_id or id or reference_no | **No role check** | Inline: appointments UPDATE status='Cancelled' |
| **update_appointment.php** | Update appointment fields by id or reference_no | POST | appointment_id/id/reference_no + optional: patient_name, patient_phone, doctor_id, appointment_date, time_slot/appointment_time, status | **No role check** | Inline: appointments UPDATE |
| **generate_booking_document.php** | Generate/store PDF receipt for appointment | POST | reference_no | Patient (session) | pdf_receipt.php createBookingReceiptPdf; appointments UPDATE booking_documents |
| **patient.php** | Patient dashboard actions | GET/POST | action: get_history, get_profile; POST: cancel_appointment (appointment_id), update_profile (name, email, phone, address, date_of_birth, optional password fields) | Patient | Inline: appointments, users, patients |
| **doctor.php** | Doctor portal actions | GET/POST | action: get_schedule, get_profile, update_profile, update_schedule, update_status; POST: multipart or JSON per action | Doctor | Inline: appointments, doctors, users; uploadDoctorPhoto to assets/doctors |
| **admin.php** | Admin management actions | GET/POST | action: get_profile, update_profile, get_doctors, get_support_staff, add_support_staff, update_support_staff, delete_support_staff, add_doctor, update_doctor, delete_doctor, get_appointments, get_messages, delete_message, mark_message_resolved, mark_message_ignored; POST body varies | Admin | Inline: users, doctors, patients, customer_support_staff, contact_messages, appointments; ensureContactMessagesTable, ensureSupportStaffSchema |
| **customer_support.php** | Support dashboard actions | GET/POST | action: get_messages, mark_message_resolved, mark_message_ignored, get_profile, update_profile; POST: message_id, profile fields | cu_support | Inline: contact_messages, users, customer_support_staff; ensure* schema helpers |
| **contact.php** | Submit contact message (public form) | POST | name, email, whatsapp_number, subject, message | Public | Inline: ensureContactMessagesTable; contact_messages INSERT |
| **password_reset.php** | Request, validate, perform reset | GET (validate_token), POST (request_reset, reset_password) | request_reset: email; validate_token: token (query); reset_password: token, new_password, confirm_password | Public | Inline: password_resets + users |

**Note:** There is **no dedicated service layer**. All business logic and database access live inside the API scripts and `backend/includes/config.php` (PDO), `backend/includes/pdf_receipt.php` (PDF generation).

---

## 5. SERVICE LAYER MAP

The project **does not have a separate backend/services folder**. Logic is implemented as follows:

| Logical “service” | Location | Methods / behavior | Database usage |
|-------------------|----------|--------------------|----------------|
| **Auth / session** | auth.php | login, register, logout, check_session | users SELECT; patients INSERT (on register); session read/write |
| **Appointments (book)** | book_appointment.php | Validate doctor availability (days/slots), check double-book, INSERT appointment | doctors SELECT; appointments SELECT (slot conflict), INSERT |
| **Appointments (list)** | get_bookings.php, patient.php (get_history), doctor.php (get_schedule), admin.php (get_appointments) | List with optional filters (patient_phone, patient_id, doctor_id, all) | appointments JOIN doctors (and patients where used) |
| **Appointments (update/cancel)** | cancel_appointment.php, update_appointment.php, patient.php (cancel_appointment), doctor.php (update_status) | Update status or other fields by id/reference_no | appointments UPDATE |
| **Doctors (list)** | get_doctors.php, admin.php (get_doctors) | List with parsed day/slot structures | doctors SELECT |
| **Doctors (CRUD)** | admin.php (add_doctor, update_doctor, delete_doctor), doctor.php (get_profile, update_profile, update_schedule) | Add/update/delete doctor; update profile and schedule | users + doctors INSERT/UPDATE/DELETE; file upload assets/doctors |
| **Booking document** | generate_booking_document.php + pdf_receipt.php | createBookingReceiptPdf; store path in appointments.booking_documents | appointments SELECT/UPDATE; filesystem assets/booking_documents |
| **Contact messages** | contact.php (submit), admin.php (get_messages, delete_message, mark_message_resolved, mark_message_ignored), customer_support.php (get_messages, mark_message_resolved, mark_message_ignored) | Insert; list; update status; delete (admin only) | contact_messages INSERT/SELECT/UPDATE/DELETE; ensureContactMessagesTable |
| **Customer support staff** | admin.php (get_support_staff, add_support_staff, update_support_staff, delete_support_staff), customer_support.php (get_profile, update_profile) | CRUD staff; support profile | users, customer_support_staff |
| **Password reset** | password_reset.php | request_reset, validate_token, reset_password | password_resets INSERT/SELECT/UPDATE; users UPDATE password |
| **Config** | backend/includes/config.php | PDO connection | — |
| **PDF receipt** | backend/includes/pdf_receipt.php | buildSimplePdf, createBookingReceiptPdf (or equivalent) | Called by generate_booking_document.php; writes to assets/booking_documents |

---

## 6. DATABASE RELATIONSHIP MAP

```
users
├── password_resets (user_id)
├── patients (user_id)
├── doctors (user_id)
├── customer_support_staff (user_id)
└── contact_messages (resolved_by_user_id)

patients
└── appointments (patient_id, nullable)

doctors
└── appointments (doctor_id)

contact_messages
└── resolved_by_user_id → users
```

**Tables:** users, password_resets, patients, doctors, customer_support_staff, appointments, contact_messages.

**No direct link:** contact_messages ↔ appointments; customer_support_staff ↔ appointments.

---

## 7. WORKFLOW DIAGRAMS

### Patient booking flow

```
Patient → booking.html
    → script.js: checkLoginState() → GET auth.php?action=check_session
    → (if patient) fetchPatientProfile() → GET patient.php?action=get_profile
    → loadDoctors() → GET get_doctors.php
    → User selects doctor, date → checkAvailabilityAndRenderSlots() → GET check_slots.php?doctor_id=&date=
    → User selects slot, submits → POST book_appointment.php (reference_no, doctor_id, patient_name, patient_phone, appointment_date, appointment_time)
    → Success: showBookingConfirmation(); on "Done" → finalizeReceiptAndRedirect() → POST generate_booking_document.php (reference_no)
    → Redirect → patient_dashboard.html
```

### Doctor appointment flow

```
Doctor → doctor_dashboard.html
    → doctor.js: GET auth.php?action=check_session → (if doctor) loadSchedule()
    → GET doctor.php?action=get_schedule
    → renderAppointments() in table
    → Actions: updateStatus(id, 'Completed'|'Confirmed') → POST doctor.php?action=update_status (appointment_id, status)
    → View document: link to appointment.booking_documents (if set)
```

### Support message flow

```
Public / Patient → index.html (or page with #contact)
    → script.js: initializeContactForm() → Submit → POST contact.php (name, email, whatsapp_number, subject, message)
    → contact_messages INSERT (status Open)

Support → customer_support_dashboard.html
    → customer_support.js: loadMessages() → GET customer_support.php?action=get_messages
    → markMessageResolved(id) → POST customer_support.php?action=mark_message_resolved (message_id)
    → markMessageIgnored(id) → POST customer_support.php?action=mark_message_ignored (message_id)

Admin → admin_dashboard.html → Messages tab
    → admin.js: loadMessages() → GET admin.php?action=get_messages
    → resolveMessage(id), ignoreMessage(id), deleteMessage(id) → POST admin.php (mark_message_resolved, mark_message_ignored, delete_message)
```

---

## 8. LAYERED ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (HTML + CSS)                                                     │
│ index.html, login.html, register.html, booking.html,                     │
│ forgot_password.html, reset_password.html,                                │
│ patient_dashboard.html, doctor_dashboard.html, admin_dashboard.html,     │
│ customer_support_dashboard.html, admin_registration.php                   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ JAVASCRIPT MODULES                                                       │
│ script.js, auth.js, patient.js, doctor.js, admin.js,                      │
│ customer_support.js, password_reset.js                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API ENDPOINTS (backend/api/*.php)                                        │
│ auth, book_appointment, get_bookings, get_doctors, check_slots,           │
│ check_availability, cancel_appointment, update_appointment,               │
│ generate_booking_document, patient, doctor, admin, customer_support,     │
│ contact, password_reset                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ backend/includes/      │  │ Inline PDO logic  │  │ assets/              │
│ config.php (PDO)       │  │ in each API       │  │ doctors/,           │
│ pdf_receipt.php (PDF)  │  │                   │  │ booking_documents/  │
└───────────────────────┘  └───────────────────┘  └─────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DATABASE (hospital_booking)                                               │
│ users, password_resets, patients, doctors, customer_support_staff,         │
│ appointments, contact_messages                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Role access paths

- **Patient** → booking.html / patient_dashboard.html → script.js / patient.js → book_appointment.php, get_bookings (via script.js with patient_phone from session context), patient.php, generate_booking_document.php → **appointments** (and users, patients).
- **Doctor** → doctor_dashboard.html → doctor.js → doctor.php → **appointments** (by doctor_id), **doctors**, users.
- **Admin** → admin_dashboard.html → admin.js → admin.php → **users, doctors, patients, customer_support_staff, appointments, contact_messages**.
- **Customer Support** → customer_support_dashboard.html → customer_support.js → customer_support.php → **contact_messages**, users, customer_support_staff (no appointments).

---

## 9. FEATURE INVENTORY (BY ROLE)

Aligned with schema and existing code.

### Patient

- Register (users + patients).
- Log in / log out.
- Book appointment (doctor, date, slot; reference_no; patient_id from session).
- View own appointments (patient_dashboard via patient.php get_history).
- Cancel own appointment (patient.php cancel_appointment by patient_id).
- View/download booking document (link from history; generate_booking_document.php creates PDF and stores path).
- Update profile (name, email, phone, address, date_of_birth, optional password change) via patient.php.
- Submit contact form (when not logged in as admin/doctor/cu_support) via contact.php.
- Request password reset (forgot_password → password_reset.php request_reset).
- Set new password with valid token (reset_password → validate_token, reset_password).

### Doctor

- Log in / log out.
- View own appointments (doctor.php get_schedule).
- Update appointment status (Confirmed, Completed) for own appointments (doctor.php update_status).
- View patient details on appointment (patient_name, patient_phone, optional registered_phone from patients JOIN).
- View/download booking document link when booking_documents is set.
- Manage availability (doctor.php update_schedule: available_days, available_slots).
- View/update own profile and photo (doctor.php get_profile, update_profile with optional photo upload).

### Admin

- Log in / log out.
- View all appointments (admin.php get_appointments).
- Manage doctors: add, edit (profile + availability + optional photo/password), delete (admin.php).
- Manage customer support staff: add, edit, delete (admin.php).
- View contact messages (admin.php get_messages).
- Resolve / ignore / delete contact messages (admin.php mark_message_resolved, mark_message_ignored, delete_message).
- Update own profile and password (admin.php get_profile, update_profile).
- One-time admin creation (admin_registration.php; then remove file).

### Customer Support

- Log in / log out.
- View contact messages (customer_support.php get_messages).
- Mark message Resolved or Ignored (customer_support.php mark_message_resolved, mark_message_ignored).
- View/update own profile and password (customer_support.php get_profile, update_profile).
- **Does not:** manage appointments, manage doctors, delete messages (admin only).

---

## 10. NOTES FOR REFACTORING

- **get_bookings.php** and **cancel_appointment.php** / **update_appointment.php** do not enforce role in code; callers (script.js, patient dashboard) provide context. Consider adding role/session checks if these endpoints are ever called from other contexts.
- **contact.php** requires name, email, whatsapp_number, and message (API validation); schema allows null for whatsapp_number and subject — alignment is intentional for the current form.
- **Service layer:** All logic is in API files and includes; refactoring could introduce a formal service layer (e.g. AppointmentService, UserService) and keep APIs thin.
- **Schema-derived feature list** is in `docs/SCHEMA-DERIVED-FEATURE-SPECIFICATION.md`; use it as the feature lock contract so refactoring does not add or remove schema-unsupported features.

---

*End of System Architecture Report. Use this document together with SCHEMA-DERIVED-FEATURE-SPECIFICATION.md when refactoring.*
