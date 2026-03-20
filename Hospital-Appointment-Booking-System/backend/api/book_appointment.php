<?php
/**
 * CarePlus Hospital System - Booking Submission API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'No data received']);
    exit;
}

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'patient') {
    echo json_encode(['success' => false, 'message' => 'Authentication required. Please login as patient.']);
    exit;
}

try {
    $required = ['reference_no', 'patient_name', 'patient_phone', 'doctor_id', 'appointment_date', 'appointment_time'];
    foreach ($required as $key) {
        if (!isset($data[$key]) || trim((string) $data[$key]) === '') {
            echo json_encode(['success' => false, 'message' => "Missing field: $key"]);
            exit;
        }
    }

    if (strlen((string) $data['reference_no']) > 20) {
        echo json_encode(['success' => false, 'message' => 'reference_no exceeds 20 characters']);
        exit;
    }

    $doctorId = (int) $data['doctor_id'];
    $appointmentDate = $data['appointment_date'];
    $appointmentTime = $data['appointment_time'];
    $requestedDayId = (string) date('N', strtotime($appointmentDate)); // 1=Mon ... 7=Sun

    $doctorStmt = $pdo->prepare("SELECT available_days, available_slots FROM doctors WHERE doctor_id = ? LIMIT 1");
    $doctorStmt->execute([$doctorId]);
    $doctor = $doctorStmt->fetch(PDO::FETCH_ASSOC);
    if (!$doctor) {
        echo json_encode(['success' => false, 'message' => 'Doctor not found']);
        exit;
    }

    $dayNameMap = [
        'mon' => '1', 'tue' => '2', 'wed' => '3', 'thu' => '4',
        'fri' => '5', 'sat' => '6', 'sun' => '7'
    ];
    $dayTokens = array_values(array_filter(array_map('trim', explode(',', (string) $doctor['available_days']))));
    $allowedDayIds = [];
    foreach ($dayTokens as $token) {
        if (preg_match('/^[1-7]$/', $token)) {
            $allowedDayIds[] = $token;
            continue;
        }
        $k = strtolower(substr($token, 0, 3));
        if (isset($dayNameMap[$k])) {
            $allowedDayIds[] = $dayNameMap[$k];
        }
    }
    $allowedDayIds = array_values(array_unique($allowedDayIds));
    if (!empty($allowedDayIds) && !in_array($requestedDayId, $allowedDayIds, true)) {
        echo json_encode(['success' => false, 'message' => 'Doctor is not available on selected day']);
        exit;
    }

    $slotLabelMap = [
        '1' => '09:00 AM',
        '2' => '10:00 AM',
        '3' => '11:00 AM',
        '4' => '03:00 PM',
        '5' => '04:00 PM',
        '6' => '05:00 PM'
    ];
    $slotTokens = array_values(array_filter(array_map('trim', explode(',', (string) $doctor['available_slots']))));
    $structured = false;
    $allowedSlotsForDay = [];

    foreach ($slotTokens as $token) {
        if (preg_match('/^([1-7])_([1-6])$/', $token, $m)) {
            $structured = true;
            if ($m[1] === $requestedDayId && isset($slotLabelMap[$m[2]])) {
                $allowedSlotsForDay[] = $slotLabelMap[$m[2]];
            }
        } else {
            // Backward compatibility: plain slot labels.
            $allowedSlotsForDay[] = $token;
        }
    }
    $allowedSlotsForDay = array_values(array_unique($allowedSlotsForDay));
    if (!empty($allowedSlotsForDay) && !in_array($appointmentTime, $allowedSlotsForDay, true)) {
        echo json_encode(['success' => false, 'message' => 'Selected slot is not available for that day']);
        exit;
    }
    if ($structured && empty($allowedSlotsForDay)) {
        echo json_encode(['success' => false, 'message' => 'No slots configured for selected day']);
        exit;
    }

    $checkStmt = $pdo->prepare(
        "SELECT appointment_id
         FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'Cancelled'
         LIMIT 1"
    );
    $checkStmt->execute([$doctorId, $appointmentDate, $appointmentTime]);
    if ($checkStmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Selected slot is already booked']);
        exit;
    }

    $patientId = $_SESSION['patient_id'] ?? null;

    $insertStmt = $pdo->prepare(
        "INSERT INTO appointments
         (reference_no, patient_id, doctor_id, patient_name, patient_phone, appointment_date, time_slot, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')"
    );

    $success = $insertStmt->execute([
        $data['reference_no'],
        $patientId,
        $doctorId,
        $data['patient_name'],
        $data['patient_phone'],
        $appointmentDate,
        $appointmentTime
    ]);

    echo json_encode([
        'success' => (bool) $success,
        'appointment_id' => $success ? (int) $pdo->lastInsertId() : null,
        'reference_no' => (string) $data['reference_no']
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
