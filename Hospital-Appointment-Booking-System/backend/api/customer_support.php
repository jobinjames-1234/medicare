<?php
/**
 * CarePlus Hospital System - Customer Support API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'cu_support') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * Read request payload from JSON.
 */
function readRequestData(): array
{
    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Ensure role enum and support table are available.
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

/**
 * Ensure contact_messages table exists for viewing customer messages.
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

try {
    switch ($action) {
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

        case 'mark_message_resolved':
            ensureContactMessagesTable($pdo);
            $data = readRequestData();
            if (!isset($data['message_id'])) {
                throw new Exception('message_id is required.');
            }

            $messageId = (int) $data['message_id'];
            $stmt = $pdo->prepare(
                "UPDATE contact_messages
                 SET status = 'Resolved', resolved_at = NOW(), resolved_by_user_id = ?
                 WHERE message_id = ?"
            );
            $stmt->execute([(int) $_SESSION['user_id'], $messageId]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Message not found or already resolved.');
            }

            echo json_encode(['success' => true, 'message' => 'Message marked as resolved.']);
            break;

        case 'mark_message_ignored':
            ensureContactMessagesTable($pdo);
            $data = readRequestData();
            if (!isset($data['message_id'])) {
                throw new Exception('message_id is required.');
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

            echo json_encode(['success' => true, 'message' => 'Message marked as ignored.']);
            break;

        case 'get_profile':
            ensureSupportStaffSchema($pdo);
            $stmt = $pdo->prepare(
                "SELECT u.user_id, u.name, u.email, u.role, u.created_at, cs.staff_id, COALESCE(cs.staff_name, u.name) AS staff_name
                 FROM users u
                 LEFT JOIN customer_support_staff cs ON cs.user_id = u.user_id
                 WHERE u.user_id = ? AND u.role = 'cu_support'
                 LIMIT 1"
            );
            $stmt->execute([(int) $_SESSION['user_id']]);
            $profile = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$profile) {
                throw new Exception('Support profile not found.');
            }
            echo json_encode(['success' => true, 'profile' => $profile]);
            break;

        case 'update_profile':
            ensureSupportStaffSchema($pdo);
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
            $stmtUser = $pdo->prepare("SELECT password FROM users WHERE user_id = ? AND role = 'cu_support' LIMIT 1");
            $stmtUser->execute([(int) $_SESSION['user_id']]);
            $existingHash = $stmtUser->fetchColumn();
            if (!$existingHash) {
                throw new Exception('Support account not found.');
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
                $stmtUpdate = $pdo->prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE user_id = ? AND role = 'cu_support'");
                $stmtUpdate->execute([$name, $email, $newHash, (int) $_SESSION['user_id']]);
            } else {
                $stmtUpdate = $pdo->prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ? AND role = 'cu_support'");
                $stmtUpdate->execute([$name, $email, (int) $_SESSION['user_id']]);
            }

            $stmtStaff = $pdo->prepare(
                "INSERT INTO customer_support_staff (user_id, staff_name)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE staff_name = VALUES(staff_name)"
            );
            $stmtStaff->execute([(int) $_SESSION['user_id'], $name]);

            $pdo->commit();
            $_SESSION['name'] = $name;
            echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
            break;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ((int) $e->getCode() === 23000) {
        echo json_encode(['success' => false, 'message' => 'Email already exists']);
    } else {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>
