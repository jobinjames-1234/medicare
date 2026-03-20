<?php
/**
 * CarePlus Hospital System - Password Reset API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}

/**
 * Keep password reset storage ready even for older DBs not yet migrated.
 */
function ensurePasswordResetTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS password_resets (
            reset_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_password_resets_user_id (user_id),
            INDEX idx_password_resets_expires_at (expires_at),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/**
 * Generate a user-friendly default password suggestion.
 */
function generateSimplePassword(): string
{
    $num = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    return 'Care' . $num;
}

function hashResetToken(string $token): string
{
    return hash('sha256', $token);
}

function jsonResponse(array $payload): void
{
    echo json_encode($payload);
    exit;
}

try {
    ensurePasswordResetTable($pdo);

    switch ($action) {
        case 'request_reset':
            $email = trim((string) ($data['email'] ?? ''));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['success' => false, 'message' => 'Please enter a valid email address.']);
            }

            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            // Keep response generic even if email is not found.
            if (!$user) {
                jsonResponse([
                    'success' => true,
                    'message' => 'If this email is registered, a reset process has been started.'
                ]);
            }

            $token = bin2hex(random_bytes(32));
            $tokenHash = hashResetToken($token);
            $expiresAt = date('Y-m-d H:i:s', time() + (30 * 60));
            $generatedPassword = generateSimplePassword();

            $pdo->beginTransaction();
            $stmtInvalidate = $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL");
            $stmtInvalidate->execute([(int) $user['user_id']]);

            $stmtInsert = $pdo->prepare(
                "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
            );
            $stmtInsert->execute([
                (int) $user['user_id'],
                $tokenHash,
                $expiresAt
            ]);
            $pdo->commit();

            jsonResponse([
                'success' => true,
                'message' => 'Reset link generated successfully.',
                'reset_token' => $token,
                'generated_password' => $generatedPassword,
                'reset_url' => 'reset_password.html?token=' . urlencode($token)
            ]);
            break;

        case 'validate_token':
            $token = trim((string) ($_GET['token'] ?? ''));
            if ($token === '') {
                jsonResponse(['success' => false, 'message' => 'Reset token is required.']);
            }

            $tokenHash = hashResetToken($token);
            $stmt = $pdo->prepare(
                "SELECT pr.reset_id, pr.expires_at, pr.used_at, u.email
                 FROM password_resets pr
                 JOIN users u ON pr.user_id = u.user_id
                 WHERE pr.token_hash = ?
                 LIMIT 1"
            );
            $stmt->execute([$tokenHash]);
            $reset = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$reset) {
                jsonResponse(['success' => false, 'message' => 'Invalid reset link.']);
            }
            if (!empty($reset['used_at'])) {
                jsonResponse(['success' => false, 'message' => 'This reset link has already been used.']);
            }
            if (strtotime((string) $reset['expires_at']) < time()) {
                jsonResponse(['success' => false, 'message' => 'This reset link has expired.']);
            }

            jsonResponse([
                'success' => true,
                'message' => 'Reset token is valid.',
                'email' => $reset['email']
            ]);
            break;

        case 'reset_password':
            $token = trim((string) ($data['token'] ?? ''));
            $newPassword = trim((string) ($data['new_password'] ?? ''));
            $confirmPassword = trim((string) ($data['confirm_password'] ?? ''));

            if ($token === '') {
                throw new Exception('Reset token is required.');
            }
            if ($newPassword === '' || $confirmPassword === '') {
                throw new Exception('New password and confirm password are required.');
            }
            if (strlen($newPassword) < 6) {
                throw new Exception('Password must be at least 6 characters.');
            }
            if ($newPassword !== $confirmPassword) {
                throw new Exception('New password and confirm password do not match.');
            }

            $tokenHash = hashResetToken($token);

            $pdo->beginTransaction();
            $stmt = $pdo->prepare(
                "SELECT reset_id, user_id, expires_at, used_at
                 FROM password_resets
                 WHERE token_hash = ?
                 LIMIT 1"
            );
            $stmt->execute([$tokenHash]);
            $reset = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$reset) {
                throw new Exception('Invalid reset token.');
            }
            if (!empty($reset['used_at'])) {
                throw new Exception('This reset token has already been used.');
            }
            if (strtotime((string) $reset['expires_at']) < time()) {
                throw new Exception('This reset token has expired.');
            }

            $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmtUpdateUser = $pdo->prepare("UPDATE users SET password = ? WHERE user_id = ?");
            $stmtUpdateUser->execute([$newHash, (int) $reset['user_id']]);

            $stmtUseToken = $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?");
            $stmtUseToken->execute([(int) $reset['reset_id']]);

            $stmtInvalidateAll = $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL");
            $stmtInvalidateAll->execute([(int) $reset['user_id']]);

            $pdo->commit();

            jsonResponse(['success' => true, 'message' => 'Password reset successful. Please login with your new password.']);
            break;

        default:
            jsonResponse(['success' => false, 'message' => 'Invalid action']);
            break;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(['success' => false, 'message' => $e->getMessage()]);
}
?>
