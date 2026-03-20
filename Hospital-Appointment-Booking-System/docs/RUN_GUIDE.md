# 🚀 Project Setup Guide

### 1. Requirements
- **Server**: XAMPP / WAMP / MAMP (PHP 8.x + MySQL).
- **Public Folder**: Place project in `htdocs` (XAMPP) or `www` (WAMP).

### 2. Database Configuration
1. Open **phpMyAdmin**.
2. Create a new database named **`hospital_booking`**.
3. Import the `database/schema.sql` file.

### 3. Configuration
Check `backend/includes/config.php` to ensure database credentials match your local host:
```php
$db_name = 'hospital_booking';
$db_user = 'root';
$db_pass = ''; // Default for XAMPP
```

### 4. Running the App
Navigate to: `http://localhost/Hospital-Appointment-Booking-System/`

### 📋 Troubleshooting
- **Not Loading?** Ensure Apache and MySQL are running in your control panel.
- **Login Issues?** Check if the `users` table was correctly populated during import.
