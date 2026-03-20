<?php
/**
 * CarePlus Hospital System - Doctor Directory API
 */
header('Content-Type: application/json');
require_once '../includes/config.php';

try {
    $stmt = $pdo->query("SELECT doctor_id, doctor_name, specialization, experience, fee, photo_url, available_days, available_slots FROM doctors");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $slotLabelMap = [
        '1' => '09:00 AM',
        '2' => '10:00 AM',
        '3' => '11:00 AM',
        '4' => '03:00 PM',
        '5' => '04:00 PM',
        '6' => '05:00 PM'
    ];
    $dayNameMap = [
        'mon' => '1',
        'tue' => '2',
        'wed' => '3',
        'thu' => '4',
        'fri' => '5',
        'sat' => '6',
        'sun' => '7'
    ];

    $doctors = [];
    foreach ($rows as $doc) {
        $rawDayTokens = array_values(array_filter(array_map('trim', explode(',', (string) $doc['available_days']))));
        $dayIds = [];
        foreach ($rawDayTokens as $token) {
            if (preg_match('/^[1-7]$/', $token)) {
                $dayIds[] = $token;
                continue;
            }
            $key = strtolower(substr($token, 0, 3));
            if (isset($dayNameMap[$key])) {
                $dayIds[] = $dayNameMap[$key];
            }
        }
        $dayIds = array_values(array_unique($dayIds));
        $slotKeys = array_values(array_filter(array_map('trim', explode(',', (string) $doc['available_slots']))));

        $daySlots = [];
        foreach ($slotKeys as $slotKey) {
            if (!preg_match('/^([1-7])_([1-6])$/', $slotKey, $m)) {
                continue;
            }
            $dayId = $m[1];
            $slotId = $m[2];
            if (!isset($slotLabelMap[$slotId])) {
                continue;
            }
            if (!isset($daySlots[$dayId])) {
                $daySlots[$dayId] = [];
            }
            $daySlots[$dayId][] = $slotLabelMap[$slotId];
        }

        // Backward compatibility for old slot format like "09:00 AM,10:00 AM".
        if (empty($daySlots) && !empty($slotKeys)) {
            $targetDays = !empty($dayIds) ? $dayIds : ['1', '2', '3', '4', '5', '6', '7'];
            foreach ($targetDays as $dayId) {
                $daySlots[$dayId] = $slotKeys;
            }
        }

        // Keep backward compatibility: flatten all slots for quick display.
        $flatSlots = [];
        foreach ($daySlots as $slotsForDay) {
            foreach ($slotsForDay as $slotLabel) {
                $flatSlots[$slotLabel] = true;
            }
        }
        $flatSlots = array_values(array_keys($flatSlots));

        $doctors[] = [
            'id' => (int) $doc['doctor_id'],
            'name' => $doc['doctor_name'],
            'specialization' => $doc['specialization'],
            'experience' => $doc['experience'],
            'fee' => $doc['fee'],
            'photo' => $doc['photo_url'],
            'available_days' => $doc['available_days'],
            'available_slots' => $doc['available_slots'],
            'day_ids' => $dayIds,
            'day_slots' => $daySlots,
            'slots' => $flatSlots
        ];
    }

    echo json_encode($doctors);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
