<?php
/**
 * CarePlus Hospital System - Admin Management API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * Read request payload from JSON or multipart/form-data.
 */
function readRequestData(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $decoded = json_decode(file_get_contents('php://input'), true);
        return is_array($decoded) ? $decoded : [];
    }

    return $_POST;
}

/**
 * Upload doctor profile picture to assets/doctors and return relative path.
 */
function uploadDoctorPhoto(string $fileKey, ?string $existingPhoto = null): ?string
{
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] === UPLOAD_ERR_NO_FILE) {
        return $existingPhoto;
    }

    $file = $_FILES[$fileKey];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Photo upload failed.');
    }

    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid image type. Allowed: jpg, jpeg, png, webp, gif.');
    }

    $uploadDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'doctors';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        throw new Exception('Could not create doctors image directory.');
    }

    $newName = 'doctor_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetAbs = $uploadDir . DIRECTORY_SEPARATOR . $newName;
    if (!move_uploaded_file($file['tmp_name'], $targetAbs)) {
        throw new Exception('Could not save uploaded image.');
    }

    return 'assets/doctors/' . $newName;
}

/**
 * Ensure contact_messages table exists for message listing.
 */
function ensureContactMessagesTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS contact_messages (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $columns = $pdo->query("SHOW COLUMNS FROM contact_messages")->fetchAll(PDO::FETCH_COLUMN, 0);
    $existing = array_map('strtolower', $columns ?: []);
    $statusColStmt = $pdo->query("SHOW COLUMNS FROM contact_messages LIKE 'status'");
    $statusCol = $statusColStmt ? $statusColStmt->fetch(PDO::FETCH_ASSOC) : null;
    $statusType = strtolower((string) ($statusCol['Type'] ?? ''));

    if (!in_array('status', $existing, true)) {
        $pdo->exec("ALTER TABLE contact_messages ADD COLUMN status ENUM('Open', 'Resolved', 'Ignored') NOT NULL DEFAULT 'Open' AFTER message");
    } elseif ($statusType !== '' && strpos($statusType, "'ignored'") === false) {
        $pdo->exec("ALTER TABLE contact_messages MODIFY status ENUM('Open', 'Resolved', 'Ignored') NOT NULL DEFAULT 'Open'");
    }
    if (!in_array('whatsapp_number', $existing, true)) {
        $pdo->exec("ALTER TABLE contact_messages ADD COLUMN whatsapp_number VARCHAR(20) DEFAULT NULL AFTER email");
    }
    if (!in_array('resolved_at', $existing, true)) {
        $pdo->exec("ALTER TABLE contact_messages ADD COLUMN resolved_at DATETIME NULL AFTER status");
    }
    if (!in_array('resolved_by_user_id', $existing, true)) {
        $pdo->exec("ALTER TABLE contact_messages ADD COLUMN resolved_by_user_id INT NULL AFTER resolved_at");
    }
}

/**
 * Ensure customer support schema exists and users.role includes cu_support.
 */
function ensureSupportStaffSchema(PDO $pdo): void
{
    $colStmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'");
    $col = $colStmt ? $colStmt->fetch(PDO::FETCH_ASSOC) : null;
    $roleType = strtolower((string) ($col['Type'] ?? ''));
    if ($roleType !== '' && strpos($roleType, "'cu_support'") === false) {
        $pdo->exec("ALTER TABLE users MODIFY role ENUM('admin', 'doctor', 'patient', 'cu_support') NOT NULL");
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_support_staff (
            staff_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            staff_name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

try {
    switch ($action) {
        case 'get_profile':
            $stmt = $pdo->prepare(
                "SELECT user_id, name, email, role, created_at
                 FROM users
                 WHERE user_id = ? AND role = 'admin'
                 LIMIT 1"
            );
            $stmt->execute([(int) $_SESSION['user_id']]);
            $profile = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$profile) {
                throw new Exception('Admin profile not found');
            }
            echo json_encode(['success' => true, 'profile' => $profile]);
            break;

        case 'update_profile':
            $data = readRequestData();
            $name = trim((string) ($data['name'] ?? ''));
            $email = trim((string) ($data['email'] ?? ''));
            if ($name === '' || $email === '') {
                throw new Exception('Name and email are required.');
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Please provide a valid email address.');
            }

            $currentPassword = trim((string) ($data['current_password'] ?? ''));
            $newPassword = trim((string) ($data['new_password'] ?? ''));
            $confirmPassword = trim((string) ($data['confirm_password'] ?? ''));
            $wantsPasswordChange = $currentPassword !== '' || $newPassword !== '' || $confirmPassword !== '';

            $pdo->beginTransaction();
            $stmtUser = $pdo->prepare("SELECT password FROM users WHERE user_id = ? AND role = 'admin' LIMIT 1");
            $stmtUser->execute([(int) $_SESSION['user_id']]);
            $existingHash = $stmtUser->fetchColumn();
            if (!$existingHash) {
                throw new Exception('Admin account not found.');
            }

            if ($wantsPasswordChange) {
                if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
                    throw new Exception('To change password, provide current password, new password, and confirm password.');
                }
                if (strlen($newPassword) < 6) {
                    throw new Exception('New password must be at least 6 characters.');
                }
                if ($newPassword !== $confirmPassword) {
                    throw new Exception('New password and confirm password do not match.');
                }
                if (!password_verify($currentPassword, (string) $existingHash)) {
                    throw new Exception('Current password is incorrect.');
                }

                $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmtUpdate = $pdo->prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE user_id = ? AND role = 'admin'");
                $stmtUpdate->execute([$name, $email, $newHash, (int) $_SESSION['user_id']]);
            } else {
                $stmtUpdate = $pdo->prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ? AND role = 'admin'");
                $stmtUpdate->execute([$name, $email, (int) $_SESSION['user_id']]);
            }

            $pdo->commit();
            $_SESSION['name'] = $name;
            echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);
            break;

        case 'get_doctors':
            $stmt = $pdo->query("SELECT d.*, u.email FROM doctors d JOIN users u ON d.user_id = u.user_id ORDER BY d.doctor_id ASC");
            echo json_encode(['success' => true, 'doctors' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'get_support_staff':
            ensureSupportStaffSchema($pdo);
            $stmt = $pdo->query(
                "SELECT cs.staff_id, cs.staff_name, cs.created_at, u.email
                 FROM customer_support_staff cs
                 JOIN users u ON cs.user_id = u.user_id
                 ORDER BY cs.staff_id ASC"
            );
            echo json_encode(['success' => true, 'staff' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'add_support_staff':
            ensureSupportStaffSchema($pdo);
            $data = readRequestData();
            $required = ['name', 'email', 'password', 'confirm_password'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                    throw new Exception("Missing field: $field");
                }
            }

            $password = trim((string) $data['password']);
            $confirmPassword = trim((string) $data['confirm_password']);
            if (strlen($password) < 6) {
                throw new Exception('Password must be at least 6 characters.');
            }
            if ($password !== $confirmPassword) {
                throw new Exception('Password and confirm password do not match.');
            }

            $pdo->beginTransaction();
            $hashed = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'cu_support')");
            $stmt->execute([
                trim((string) $data['name']),
                trim((string) $data['email']),
                $hashed
            ]);
            $userId = (int) $pdo->lastInsertId();

            $stmtSupport = $pdo->prepare("INSERT INTO customer_support_staff (user_id, staff_name) VALUES (?, ?)");
            $stmtSupport->execute([$userId, trim((string) $data['name'])]);
            $pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Support staff added successfully']);
            break;

        case 'update_support_staff':
            ensureSupportStaffSchema($pdo);
            $data = readRequestData();
            if (!isset($data['staff_id'])) {
                throw new Exception('staff_id missing');
            }
            $name = trim((string) ($data['name'] ?? ''));
            $email = trim((string) ($data['email'] ?? ''));
            if ($name === '' || $email === '') {
                throw new Exception('Name and email are required.');
            }

            $staffId = (int) $data['staff_id'];
            $currentPassword = trim((string) ($data['current_password'] ?? ''));
            $newPassword = trim((string) ($data['new_password'] ?? ''));
            $confirmPassword = trim((string) ($data['confirm_password'] ?? ''));
            $wantsPasswordChange = $currentPassword !== '' || $newPassword !== '' || $confirmPassword !== '';

            $pdo->beginTransaction();
            $stmtStaff = $pdo->prepare(
                "SELECT cs.user_id
                 FROM customer_support_staff cs
                 WHERE cs.staff_id = ?
                 LIMIT 1"
            );
            $stmtStaff->execute([$staffId]);
            $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
            if (!$staff) {
                throw new Exception('Support staff not found.');
            }

            if ($wantsPasswordChange) {
                if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
                    throw new Exception('To change password, provide current password, new password, and confirm password.');
                }
                if (strlen($newPassword) < 6) {
                    throw new Exception('New password must be at least 6 characters.');
                }
                if ($newPassword !== $confirmPassword) {
                    throw new Exception('New password and confirm password do not match.');
                }

                $stmtPwd = $pdo->prepare("SELECT password FROM users WHERE user_id = ? LIMIT 1");
                $stmtPwd->execute([(int) $staff['user_id']]);
                $existingHash = $stmtPwd->fetchColumn();
                if (!$existingHash || !password_verify($currentPassword, (string) $existingHash)) {
                    throw new Exception('Current password is incorrect.');
                }

                $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmtUser = $pdo->prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE user_id = ?");
                $stmtUser->execute([$name, $email, $newHash, (int) $staff['user_id']]);
            } else {
                $stmtUser = $pdo->prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ?");
                $stmtUser->execute([$name, $email, (int) $staff['user_id']]);
            }

            $stmtSupport = $pdo->prepare("UPDATE customer_support_staff SET staff_name = ? WHERE staff_id = ?");
            $stmtSupport->execute([$name, $staffId]);
            $pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Support staff updated successfully']);
            break;

        case 'delete_support_staff':
            ensureSupportStaffSchema($pdo);
            $data = readRequestData();
            if (!isset($data['staff_id'])) {
                throw new Exception('staff_id missing');
            }

            $stmtStaff = $pdo->prepare("SELECT user_id FROM customer_support_staff WHERE staff_id = ? LIMIT 1");
            $stmtStaff->execute([(int) $data['staff_id']]);
            $uid = $stmtStaff->fetchColumn();
            if (!$uid) {
                throw new Exception('Support staff not found');
            }

            $stmtDeleteUser = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
            $stmtDeleteUser->execute([(int) $uid]);
            echo json_encode(['success' => true, 'message' => 'Support staff removed successfully']);
            break;

        case 'add_doctor':
            $data = readRequestData();
            $required = ['name', 'email', 'password', 'confirm_password', 'specialization', 'experience', 'fee', 'available_days', 'available_slots'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                    throw new Exception("Missing field: $field");
                }
            }

            $password = trim((string) $data['password']);
            $confirmPassword = trim((string) $data['confirm_password']);
            if (strlen($password) < 6) {
                throw new Exception('Doctor password must be at least 6 characters.');
            }
            if ($password !== $confirmPassword) {
                throw new Exception('Password and confirm password do not match.');
            }

            $pdo->beginTransaction();
            $hashed = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'doctor')");
            $stmt->execute([
                trim($data['name']),
                trim($data['email']),
                $hashed
            ]);
            $userId = (int) $pdo->lastInsertId();

            $photoUrl = uploadDoctorPhoto('photo', null);

            $stmt2 = $pdo->prepare(
                "INSERT INTO doctors (user_id, doctor_name, specialization, experience, fee, photo_url, available_days, available_slots)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt2->execute([
                $userId,
                trim($data['name']),
                trim($data['specialization']),
                trim($data['experience']),
                trim($data['fee']),
                $photoUrl,
                trim($data['available_days']),
                trim($data['available_slots'])
            ]);

            $pdo->commit();
            echo json_encode(['success' => true]);
            break;

        case 'delete_doctor':
            $data = readRequestData();
            if (!isset($data['doctor_id'])) {
                throw new Exception('doctor_id missing');
            }

            $stmt = $pdo->prepare("SELECT user_id FROM doctors WHERE doctor_id = ?");
            $stmt->execute([(int) $data['doctor_id']]);
            $uid = $stmt->fetchColumn();

            if (!$uid) {
                throw new Exception('Doctor not found');
            }

            $stmt2 = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
            $stmt2->execute([(int) $uid]);
            echo json_encode(['success' => true]);
            break;

        case 'update_doctor':
            $data = readRequestData();
            if (!isset($data['doctor_id'])) {
                throw new Exception('doctor_id missing');
            }

            $required = ['name', 'email', 'specialization', 'experience', 'fee', 'available_days', 'available_slots'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                    throw new Exception("Missing field: $field");
                }
            }

            $doctorId = (int) $data['doctor_id'];
            $currentPassword = trim((string) ($data['current_password'] ?? ''));
            $newPassword = trim((string) ($data['new_password'] ?? ''));
            $confirmNewPassword = trim((string) ($data['confirm_new_password'] ?? ''));
            $wantsPasswordChange = $currentPassword !== '' || $newPassword !== '' || $confirmNewPassword !== '';

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT user_id, photo_url FROM doctors WHERE doctor_id = ?");
            $stmt->execute([$doctorId]);
            $doctor = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$doctor) {
                throw new Exception('Doctor not found');
            }

            $newPasswordHash = null;
            if ($wantsPasswordChange) {
                if ($currentPassword === '' || $newPassword === '' || $confirmNewPassword === '') {
                    throw new Exception('To change password, provide current password, new password, and confirm new password.');
                }
                if (strlen($newPassword) < 6) {
                    throw new Exception('New password must be at least 6 characters.');
                }
                if ($newPassword !== $confirmNewPassword) {
                    throw new Exception('New password and confirm new password do not match.');
                }

                $stmtPwd = $pdo->prepare("SELECT password FROM users WHERE user_id = ?");
                $stmtPwd->execute([(int) $doctor['user_id']]);
                $existingHash = $stmtPwd->fetchColumn();
                if (!$existingHash || !password_verify($currentPassword, (string) $existingHash)) {
                    throw new Exception('Current password is incorrect.');
                }

                $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            }

            $photoUrl = uploadDoctorPhoto('photo', $doctor['photo_url'] ?? null);

            if ($wantsPasswordChange) {
                $stmtUser = $pdo->prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE user_id = ?");
                $stmtUser->execute([
                    trim($data['name']),
                    trim($data['email']),
                    $newPasswordHash,
                    (int) $doctor['user_id']
                ]);
            } else {
                $stmtUser = $pdo->prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ?");
                $stmtUser->execute([
                    trim($data['name']),
                    trim($data['email']),
                    (int) $doctor['user_id']
                ]);
            }

            $stmtDoctor = $pdo->prepare(
                "UPDATE doctors
                 SET doctor_name = ?, specialization = ?, experience = ?, fee = ?, photo_url = ?, available_days = ?, available_slots = ?
                 WHERE doctor_id = ?"
            );
            $stmtDoctor->execute([
                trim($data['name']),
                trim($data['specialization']),
                trim($data['experience']),
                trim($data['fee']),
                $photoUrl,
                trim($data['available_days']),
                trim($data['available_slots']),
                $doctorId
            ]);

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Doctor updated successfully']);
            break;

        case 'get_appointments':
            $stmt = $pdo->query(
                "SELECT a.*, d.doctor_name, d.specialization
                 FROM appointments a
                 JOIN doctors d ON a.doctor_id = d.doctor_id
                 ORDER BY a.appointment_date DESC, a.time_slot DESC"
            );
            echo json_encode(['success' => true, 'appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'get_messages':
            ensureContactMessagesTable($pdo);
            $stmt = $pdo->query(
                "SELECT cm.message_id, cm.name, cm.email, cm.whatsapp_number, cm.subject, cm.message, cm.status, cm.resolved_at, cm.resolved_by_user_id, cm.created_at,
                        u.name AS resolved_by_name
                 FROM contact_messages cm
                 LEFT JOIN users u ON cm.resolved_by_user_id = u.user_id
                 ORDER BY cm.created_at DESC, cm.message_id DESC"
            );
            echo json_encode(['success' => true, 'messages' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'delete_message':
            ensureContactMessagesTable($pdo);
            $data = readRequestData();
            if (!isset($data['message_id'])) {
                throw new Exception('message_id missing');
            }
            $stmt = $pdo->prepare("DELETE FROM contact_messages WHERE message_id = ?");
            $stmt->execute([(int) $data['message_id']]);
            echo json_encode(['success' => true, 'message' => 'Message deleted successfully']);
            break;

        case 'mark_message_resolved':
            ensureContactMessagesTable($pdo);
            $data = readRequestData();
            if (!isset($data['message_id'])) {
                throw new Exception('message_id missing');
            }

            $messageId = (int) $data['message_id'];
            $stmt = $pdo->prepare(
                "UPDATE contact_messages
                 SET status = 'Resolved', resolved_at = NOW(), resolved_by_user_id = ?
                 WHERE message_id = ? AND status <> 'Resolved'"
            );
            $stmt->execute([(int) $_SESSION['user_id'], $messageId]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Message not found or already resolved.');
            }

            echo json_encode(['success' => true, 'message' => 'Message marked as resolved']);
            break;

        case 'mark_message_ignored':
            ensureContactMessagesTable($pdo);
            $data = readRequestData();
            if (!isset($data['message_id'])) {
                throw new Exception('message_id missing');
            }

            $messageId = (int) $data['message_id'];
            $stmt = $pdo->prepare(
                "UPDATE contact_messages
                 SET status = 'Ignored', resolved_at = NOW(), resolved_by_user_id = ?
                 WHERE message_id = ? AND status <> 'Ignored'"
            );
            $stmt->execute([(int) $_SESSION['user_id'], $messageId]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Message not found or already ignored.');
            }

            echo json_encode(['success' => true, 'message' => 'Message marked as ignored']);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
            break;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
