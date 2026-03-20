<?php
/**
 * CarePlus Hospital System - Doctor Portal API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'doctor') {
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
 * Resolve doctor_id from session (fallback via user_id if not explicitly set).
 */
function getDoctorId(PDO $pdo): int
{
    if (!empty($_SESSION['doctor_id'])) {
        return (int) $_SESSION['doctor_id'];
    }

    $stmt = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ? LIMIT 1");
    $stmt->execute([(int) $_SESSION['user_id']]);
    $doctorId = (int) $stmt->fetchColumn();
    if ($doctorId <= 0) {
        throw new Exception('Doctor profile not found.');
    }

    $_SESSION['doctor_id'] = $doctorId;
    return $doctorId;
}

/**
 * Upload doctor profile image and return relative path.
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

try {
    switch ($action) {
        case 'get_schedule':
            $doctorId = getDoctorId($pdo);
            $stmt = $pdo->prepare(
                "SELECT a.*, p.phone AS registered_phone
                 FROM appointments a
                 LEFT JOIN patients p ON a.patient_id = p.patient_id
                 WHERE a.doctor_id = ?
                 ORDER BY a.appointment_date, a.time_slot"
            );
            $stmt->execute([$doctorId]);
            echo json_encode(['success' => true, 'appointments' => $stmt->fetchAll()]);
            break;

        case 'get_profile':
            $doctorId = getDoctorId($pdo);
            $stmt = $pdo->prepare(
                "SELECT d.*, u.name, u.email
                 FROM doctors d
                 JOIN users u ON d.user_id = u.user_id
                 WHERE d.doctor_id = ?
                 LIMIT 1"
            );
            $stmt->execute([$doctorId]);
            $profile = $stmt->fetch();
            if ($profile) {
                echo json_encode(['success' => true, 'profile' => $profile]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Doctor profile not found']);
            }
            break;

        case 'update_profile':
            $data = readRequestData();
            $required = ['name', 'email', 'specialization', 'experience', 'fee'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                    throw new Exception("Missing field: $field");
                }
            }

            $doctorId = getDoctorId($pdo);

            $pdo->beginTransaction();
            $stmtDoctor = $pdo->prepare("SELECT user_id, photo_url FROM doctors WHERE doctor_id = ? LIMIT 1");
            $stmtDoctor->execute([$doctorId]);
            $doctor = $stmtDoctor->fetch(PDO::FETCH_ASSOC);
            if (!$doctor) {
                throw new Exception('Doctor profile not found');
            }

            $currentPassword = trim((string) ($data['current_password'] ?? ''));
            $newPassword = trim((string) ($data['new_password'] ?? ''));
            $confirmPassword = trim((string) ($data['confirm_password'] ?? ''));
            $wantsPasswordChange = $currentPassword !== '' || $newPassword !== '' || $confirmPassword !== '';

            $newHash = null;
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

                $pwdStmt = $pdo->prepare("SELECT password FROM users WHERE user_id = ? LIMIT 1");
                $pwdStmt->execute([(int) $doctor['user_id']]);
                $existingHash = $pwdStmt->fetchColumn();
                if (!$existingHash || !password_verify($currentPassword, (string) $existingHash)) {
                    throw new Exception('Current password is incorrect.');
                }

                $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
            }

            $photoUrl = uploadDoctorPhoto('photo', $doctor['photo_url'] ?? null);

            if ($wantsPasswordChange) {
                $stmtUser = $pdo->prepare("UPDATE users SET name = ?, email = ?, password = ? WHERE user_id = ?");
                $stmtUser->execute([
                    trim($data['name']),
                    trim($data['email']),
                    $newHash,
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

            $stmtUpdateDoctor = $pdo->prepare(
                "UPDATE doctors
                 SET doctor_name = ?, specialization = ?, experience = ?, fee = ?, photo_url = ?
                 WHERE doctor_id = ?"
            );
            $stmtUpdateDoctor->execute([
                trim($data['name']),
                trim($data['specialization']),
                trim($data['experience']),
                trim($data['fee']),
                $photoUrl,
                $doctorId
            ]);

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Doctor profile updated successfully']);
            break;

        case 'update_schedule':
            $data = readRequestData();
            if (!isset($data['available_days']) || trim((string) $data['available_days']) === '') {
                throw new Exception('available_days is required');
            }
            if (!isset($data['available_slots']) || trim((string) $data['available_slots']) === '') {
                throw new Exception('available_slots is required');
            }

            $doctorId = getDoctorId($pdo);
            $stmt = $pdo->prepare("UPDATE doctors SET available_days = ?, available_slots = ? WHERE doctor_id = ?");
            $success = $stmt->execute([
                trim((string) $data['available_days']),
                trim((string) $data['available_slots']),
                $doctorId
            ]);

            echo json_encode([
                'success' => (bool) $success,
                'message' => $success ? 'Schedule updated successfully' : 'Schedule update failed'
            ]);
            break;

        case 'update_status':
            $data = readRequestData();
            if (!isset($data['appointment_id']) || !isset($data['status'])) {
                throw new Exception('appointment_id and status are required');
            }

            $allowedStatus = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
            $status = trim((string) $data['status']);
            if (!in_array($status, $allowedStatus, true)) {
                throw new Exception('Invalid status value');
            }

            $doctorId = getDoctorId($pdo);
            $stmt = $pdo->prepare("UPDATE appointments SET status = ? WHERE appointment_id = ? AND doctor_id = ?");
            $success = $stmt->execute([$status, (int) $data['appointment_id'], $doctorId]);
            echo json_encode(['success' => (bool) $success]);
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
