<?php
/**
 * API to cancel an appointment by ID or reference number.
 * Uses status update instead of hard delete to keep history.
 */
header('Content-Type: application/json');
require_once '../includes/config.php';
require_once '../includes/pdf_receipt.php';

$requestData = json_decode(file_get_contents('php://input'), true);
if (!$requestData) {
    echo json_encode(['success' => false, 'message' => 'Invalid request data']);
    exit;
}

$appointmentId = isset($requestData['appointment_id']) ? (int) $requestData['appointment_id'] : null;
$legacyId = isset($requestData['id']) ? (int) $requestData['id'] : null;
$referenceNo = isset($requestData['reference_no']) ? trim($requestData['reference_no']) : null;

$targetId = $appointmentId ?: $legacyId;

if (!$targetId && !$referenceNo) {
    echo json_encode(['success' => false, 'message' => 'Missing appointment_id/id or reference_no']);
    exit;
}

try {
    /*
    if ($targetId) {
        $stmt = $pdo->prepare("UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = ? AND status != 'Completed'");
        $success = $stmt->execute([$targetId]);
    } else {
        $stmt = $pdo->prepare("UPDATE appointments SET status = 'Cancelled' WHERE reference_no = ? AND status != 'Completed'");
        $success = $stmt->execute([$referenceNo]);
    }

    echo json_encode(['success' => (bool) ($success && $stmt->rowCount() > 0)]);
    */

    try {

    if ($targetId) {
        $stmt = $pdo->prepare("UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = ? AND status != 'Completed'");
        $success = $stmt->execute([$targetId]);
        $affectedId = $targetId;

    } else {
        $stmt = $pdo->prepare("UPDATE appointments SET status = 'Cancelled' WHERE reference_no = ? AND status != 'Completed'");
        $success = $stmt->execute([$referenceNo]);

        // fetch appointment id using reference
        $idStmt = $pdo->prepare("SELECT appointment_id FROM appointments WHERE reference_no = ?");
        $idStmt->execute([$referenceNo]);
        $affectedId = $idStmt->fetchColumn();
    }

    /*
    --------------------------------------------------
    REGENERATE PDF AFTER CANCELLATION
    --------------------------------------------------
    */

    if ($success && $stmt->rowCount() > 0) {

        $stmt2 = $pdo->prepare("
        SELECT 
        a.appointment_id,
        a.reference_no,
        a.patient_name,
        a.patient_phone,
        a.appointment_date,
        a.time_slot,
        a.status,
        d.doctor_name,
        d.specialization
        FROM appointments a
        JOIN doctors d ON d.doctor_id = a.doctor_id
        WHERE a.appointment_id = ?
        ");

        $stmt2->execute([$affectedId]);
        $appointment = $stmt2->fetch(PDO::FETCH_ASSOC);

        if ($appointment) {

            $newPath = createBookingReceiptPdf($appointment);

            $pdo->prepare("
            UPDATE appointments
            SET booking_documents = ?
            WHERE appointment_id = ?
            ")->execute([$newPath, $affectedId]);

        }
    }

    echo json_encode([
        'success' => (bool) ($success && $stmt->rowCount() > 0)
    ]);

} catch (Exception $e) {

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
