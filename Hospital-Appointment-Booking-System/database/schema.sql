-- CarePlus Hospital Booking System - Database Schema

CREATE DATABASE IF NOT EXISTS hospital_booking;
USE hospital_booking;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'patient', 'cu_support') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_resets_user_id (user_id),
    INDEX idx_password_resets_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    date_of_birth DATE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    doctor_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    experience VARCHAR(50),
    fee VARCHAR(50),
    photo_url VARCHAR(255),
    available_days VARCHAR(100),
    available_slots VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Customer Support Staff Table
CREATE TABLE IF NOT EXISTS customer_support_staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    staff_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(20) UNIQUE NOT NULL,
    patient_id INT, -- Can be NULL if booked as a guest, though the doc assumes patients book through accounts. Let's make it nullable for guest flows if needed, or NOT NULL if strict login required.
    doctor_id INT NOT NULL,
    patient_name VARCHAR(100) NOT NULL, -- Keep for redundancy or guest bookings
    patient_phone VARCHAR(20) NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') DEFAULT 'Confirmed',
    booking_documents VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE
);

-- Contact Messages Table (public form submissions)
CREATE TABLE IF NOT EXISTS contact_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    whatsapp_number VARCHAR(20) DEFAULT NULL,
    subject VARCHAR(200) DEFAULT NULL,
    message TEXT NOT NULL,
    status ENUM('Open', 'Resolved', 'Ignored') NOT NULL DEFAULT 'Open',
    resolved_at DATETIME NULL,
    resolved_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contact_messages_created_at (created_at),
    INDEX idx_contact_messages_email (email),
    INDEX idx_contact_messages_status (status),
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- Default Admin User
-- Email: admin@careplus.com
-- Password: Admin@123
-- =====================================================

INSERT INTO users (name, email, password, role)
VALUES (
    'System Administrator',
    'admin@careplus.com',
    '$2y$10$9aO0Tz8Vh6jF8pQ4kN7CzO3lqgYvY2Qm1s1uQ5bXn1s5F6j1h9F1a',
    'admin'
);
