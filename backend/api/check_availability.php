<?php
/**
 * Legacy compatibility endpoint to check booked slots.
 * Preferred endpoint is check_slots.php.
 */
header('Content-Type: application/json');
require_once '../includes/config.php';

$doctorId = isset($_GET['doctorId']) ? (int) $_GET['doctorId'] : 0;
$date = isset($_GET['date']) ? trim($_GET['date']) : null;

if (!$doctorId || !$date) {
    echo json_encode(['error' => 'Missing doctorId or date']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        "SELECT time_slot AS slot
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'"
    );
    $stmt->execute([$doctorId, $date]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $bookedSlots = array_map(function ($row) {
        return $row['slot'];
    }, $rows);

    echo json_encode(['bookedSlots' => $bookedSlots]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
