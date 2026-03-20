<?php
/**
 * API to fetch bookings.
 * Supports optional patient_phone filter.
 */
header('Content-Type: application/json');
require_once '../includes/config.php';

try {
    $patientPhone = isset($_GET['patient_phone']) ? trim($_GET['patient_phone']) : '';
    $columnCheck = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'booking_documents'");
    $hasBookingDocuments = $columnCheck && $columnCheck->fetch();
    $bookingDocumentsSelect = $hasBookingDocuments ? 'a.booking_documents' : 'NULL AS booking_documents';

    $sql = "SELECT
                a.appointment_id,
                a.reference_no,
                a.patient_id,
                a.patient_name,
                a.patient_phone,
                a.doctor_id,
                d.doctor_name,
                d.specialization,
                a.appointment_date AS date,
                a.time_slot AS slot,
                a.status,
                {$bookingDocumentsSelect},
                a.created_at
            FROM appointments a
            LEFT JOIN doctors d ON d.doctor_id = a.doctor_id";

    if ($patientPhone !== '') {
        $sql .= " WHERE a.patient_phone = :patient_phone";
    }

    $sql .= " ORDER BY a.appointment_date ASC, a.time_slot ASC";

    $stmt = $pdo->prepare($sql);
    if ($patientPhone !== '') {
        $stmt->bindValue(':patient_phone', $patientPhone, PDO::PARAM_STR);
    }
    $stmt->execute();

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
