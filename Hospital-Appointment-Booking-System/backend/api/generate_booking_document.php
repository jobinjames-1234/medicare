<?php
/**
 * Generate and store booking receipt PDF for a patient's appointment.
 */
session_start();
header('Content-Type: application/json');

require_once '../includes/config.php';
require_once '../includes/pdf_receipt.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'patient') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    echo json_encode(['success' => false, 'message' => 'Invalid payload']);
    exit;
}

$referenceNo = trim((string) ($payload['reference_no'] ?? ''));
if ($referenceNo === '') {
    echo json_encode(['success' => false, 'message' => 'reference_no is required']);
    exit;
}

$patientId = (int) ($_SESSION['patient_id'] ?? 0);
if ($patientId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid patient session']);
    exit;
}

/**
 * Add booking_documents column once if database is older than latest schema.
 */
function ensureBookingDocumentsColumn(PDO $pdo): void
{
    $check = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'booking_documents'");
    if (!$check || !$check->fetch()) {
        $pdo->exec("ALTER TABLE appointments ADD COLUMN booking_documents VARCHAR(255) DEFAULT NULL AFTER status");
    }
}

try {
    ensureBookingDocumentsColumn($pdo);

    $stmt = $pdo->prepare(
        "SELECT a.appointment_id, a.reference_no, a.patient_name, a.patient_phone, a.appointment_date, a.time_slot, a.status, a.booking_documents,
                d.doctor_name, d.specialization
         FROM appointments a
         JOIN doctors d ON d.doctor_id = a.doctor_id
         WHERE a.reference_no = ? AND a.patient_id = ?
         LIMIT 1"
    );
    $stmt->execute([$referenceNo, $patientId]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        echo json_encode(['success' => false, 'message' => 'Appointment not found']);
        exit;
    }

    $existingPath = trim((string) ($appointment['booking_documents'] ?? ''));
    if ($existingPath !== '') {
        $absoluteExisting = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $existingPath);
        if (is_file($absoluteExisting)) {
            echo json_encode(['success' => true, 'path' => $existingPath]);
            exit;
        }
    }

    $relativePath = createBookingReceiptPdf($appointment);

    $update = $pdo->prepare("UPDATE appointments SET booking_documents = ? WHERE appointment_id = ?");
    $update->execute([$relativePath, (int) $appointment['appointment_id']]);

    echo json_encode(['success' => true, 'path' => $relativePath]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
