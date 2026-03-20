<?php
/**
 * CarePlus Hospital System - Public Contact Message API
 * No login required to submit a message.
 */
header('Content-Type: application/json');
require_once '../includes/config.php';

/**
 * Read JSON payload or form-urlencoded payload.
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
 * Ensure contact_messages table exists for older databases.
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
    ensureContactMessagesTable($pdo);
    $data = readRequestData();

    $name = trim((string) ($data['name'] ?? ''));
    $email = trim((string) ($data['email'] ?? ''));
    $whatsappNumber = trim((string) ($data['whatsapp_number'] ?? ''));
    $subject = trim((string) ($data['subject'] ?? ''));
    $message = trim((string) ($data['message'] ?? ''));

    if ($name === '' || $email === '' || $whatsappNumber === '' || $message === '') {
        echo json_encode(['success' => false, 'message' => 'Name, email, WhatsApp number, and message are required.']);
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Please provide a valid email address.']);
        exit;
    }
    if (!preg_match('/^\+?[\d\s-]{8,20}$/', $whatsappNumber)) {
        echo json_encode(['success' => false, 'message' => 'Please provide a valid WhatsApp number.']);
        exit;
    }
    if (strlen($name) < 2) {
        echo json_encode(['success' => false, 'message' => 'Name must be at least 2 characters.']);
        exit;
    }
    if (strlen($message) < 5) {
        echo json_encode(['success' => false, 'message' => 'Message must be at least 5 characters.']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO contact_messages (name, email, whatsapp_number, subject, message)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $name,
        $email,
        $whatsappNumber,
        $subject !== '' ? $subject : null,
        $message
    ]);

    echo json_encode(['success' => true, 'message' => 'Message sent successfully. We will get back to you soon.']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
