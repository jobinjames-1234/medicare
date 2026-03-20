<?php
/**
 * API to update appointment fields by appointment_id/id or reference_no.
 */
header('Content-Type: application/json');
require_once '../includes/config.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'No input provided']);
    exit;
}

$appointmentId = isset($data['appointment_id']) ? (int) $data['appointment_id'] : null;
$legacyId = isset($data['id']) ? (int) $data['id'] : null;
$referenceNo = isset($data['reference_no']) ? trim($data['reference_no']) : null;

$targetId = $appointmentId ?: $legacyId;
if (!$targetId && !$referenceNo) {
    echo json_encode(['success' => false, 'message' => 'Missing appointment_id/id or reference_no']);
    exit;
}

$fields = [];
$params = [];

if (isset($data['patient_name'])) {
    $fields[] = 'patient_name = ?';
    $params[] = $data['patient_name'];
}
if (isset($data['patient_phone'])) {
    $fields[] = 'patient_phone = ?';
    $params[] = $data['patient_phone'];
}
if (isset($data['doctor_id'])) {
    $fields[] = 'doctor_id = ?';
    $params[] = (int) $data['doctor_id'];
}
if (isset($data['appointment_date'])) {
    $fields[] = 'appointment_date = ?';
    $params[] = $data['appointment_date'];
}
if (isset($data['appointment_time'])) {
    $fields[] = 'time_slot = ?';
    $params[] = $data['appointment_time'];
}
if (isset($data['time_slot'])) {
    $fields[] = 'time_slot = ?';
    $params[] = $data['time_slot'];
}
if (isset($data['status'])) {
    $fields[] = 'status = ?';
    $params[] = $data['status'];
}

if (empty($fields)) {
    echo json_encode(['success' => false, 'message' => 'No update fields provided']);
    exit;
}

if ($targetId) {
    $where = 'appointment_id = ?';
    $params[] = $targetId;
} else {
    $where = 'reference_no = ?';
    $params[] = $referenceNo;
}

try {
    $sql = 'UPDATE appointments SET ' . implode(', ', $fields) . ' WHERE ' . $where;
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($params);
    echo json_encode(['success' => (bool) ($result && $stmt->rowCount() > 0)]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
