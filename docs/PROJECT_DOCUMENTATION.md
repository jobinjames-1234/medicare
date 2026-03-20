# 🏥 CarePlus Project Documentation

## 1. Introduction
CarePlus is a full-stack web application that automates hospital scheduling, reducing waiting times and eliminating manual coordination errors.

## 2. System Roles
| Role | Permissions |
| :--- | :--- |
| **Patient** | Register, login, book appointments, management profile (DOB), and view history. |
| **Doctor** | View personal schedules and manage upcoming patient visits. |
| **Admin** | Manage the doctor directory (Add/Edit/Delete) and monitor all system appointments. |

## 3. Core Modules
- **Authentication**: Role-based login and patient registration with secure session management.
- **Appointment Booking**: Dynamic AJAX form that prevents double-booking and validates slots in real-time.
- **Dashboards**: Glassmorphic user interfaces for Patients, Doctors, and Admins to manage their respective data.
- **Profile Management**: Patients can update personal details, and Admins can update doctor credentials without record deletion.

## 4. Database Schema
- **`users`**: Authentication credentials (`email`, `password`, `role`).
- **`patients`**: Personal details (`phone`, `address`, `date_of_birth`).
- **`doctors`**: Professional credentials (`specialization`, `experience`, `fee`, `available_days`, `slots`).
- **`appointments`**: Booking records (`doctor_id`, `patient_id`, `date`, `time_slot`, `status`).

## 5. Workflow
1. Patient signs up (DOB mandatory).
2. Patient selects doctor/date.
3. System checks availability via AJAX.
4. Patient confirms booking -> Received instant dashboard update.
5. Admin/Doctor monitors records in real-time.

---
*Developed with PHP, MySQL, and Modern UI principles.*
