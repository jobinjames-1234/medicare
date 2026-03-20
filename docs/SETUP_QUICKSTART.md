# 🚀 Quickstart: Setup & Testing Guide

This guide will help you get the **CarePlus Hospital System** running on your local machine using XAMPP.

---

### 1️⃣ XAMPP Installation & Setup
1.  **Download**: Get [XAMPP for Windows](https://www.apachefriends.org/download.html).
2.  **Install**: Follow the installer and keep the components (Apache, MySQL, PHP) checked.
3.  **Start Services**: 
    - Open the **XAMPP Control Panel**.
    - Click **Start** for **Apache**.
    - Click **Start** for **MySQL**.

---

### 2️⃣ Database Setup (Running SQL)
1.  Open your browser and navigate to: `http://localhost/phpmyadmin/`.
2.  **Create Database**:
    - Click **"New"** in the left sidebar.
    - Database name: `hospital_booking`.
    - Click **"Create"**.
3.  **Import Schema**:
    - Select the `hospital_booking` database from the left.
    - Click the **"Import"** tab at the top.
    - Click **"Choose File"** and select `database/schema.sql` from the project folder.
    - Scroll down and click **"Import"** (or **"Go"**).

---

### 3️⃣ Testing Credentials
Once the database is imported, you can use these accounts to test the different roles:

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin@careplus.com` | `password` |
| **Doctor** | `madhavan@careplus.com` | `password` |
| **Patient** | `john@example.com` | `password` |

---

### 4️⃣ Opening the App
1.  Ensure the project folder `Hospital-Appointment-Booking-System` is inside `C:\xampp\htdocs\`.
2.  Go to: [http://localhost/Hospital-Appointment-Booking-System/](http://localhost/Hospital-Appointment-Booking-System/)
3.  Click **"Book Now"** or **"Login"** to start testing!

---
*Developed by the 12-member CarePlus Team.*
