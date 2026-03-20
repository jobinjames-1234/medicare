<?php
/**
 * CarePlus Hospital System - Authentication & Session API
 */
session_start();
header('Content-Type: application/json');
require_once '../includes/config.php';

$data = json_decode(file_get_contents("php://input"), true);
$action = isset($_GET['action']) ? $_GET['action'] : (isset($data['action']) ? $data['action'] : '');

switch ($action) {
    case 'login':
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Email and password are required']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['name'] = $user['name'];
            $_SESSION['role'] = $user['role'];
            
            // If they are a patient or doctor, we might want their specific ID too
            if ($user['role'] === 'patient') {
                $stmt2 = $pdo->prepare("SELECT patient_id FROM patients WHERE user_id = ?");
                $stmt2->execute([$user['user_id']]);
                if ($p = $stmt2->fetch()) $_SESSION['patient_id'] = $p['patient_id'];
            } else if ($user['role'] === 'doctor') {
                $stmt3 = $pdo->prepare("SELECT doctor_id FROM doctors WHERE user_id = ?");
                $stmt3->execute([$user['user_id']]);
                if ($d = $stmt3->fetch()) $_SESSION['doctor_id'] = $d['doctor_id'];
            }

            echo json_encode(['success' => true, 'role' => $user['role'], 'name' => $user['name']]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        }
        break;

    case 'register':
        $name = $data['name'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        $confirmPassword = $data['confirm_password'] ?? '';
        $phone = $data['phone'] ?? '';
        $address = $data['address'] ?? '';
        $dob = $data['date_of_birth'] ?? '';
        $role = 'patient'; // Only patients register themselves via signup

        if (empty($name) || empty($email) || empty($password) || empty($confirmPassword)) {
            echo json_encode(['success' => false, 'message' => 'Please fill in required fields']);
            exit;
        }
        if ($password !== $confirmPassword) {
            echo json_encode(['success' => false, 'message' => 'Password and confirm password do not match']);
            exit;
        }
        if (strlen($password) < 6) {
            echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
            exit;
        }

        try {
            $pdo->beginTransaction();
            $hashed = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $email, $hashed, $role]);
            $user_id = $pdo->lastInsertId();

            $stmt2 = $pdo->prepare("INSERT INTO patients (user_id, phone, address, date_of_birth) VALUES (?, ?, ?, ?)");
            $stmt2->execute([$user_id, $phone, $address, $dob]);

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Registration successful']);
        } catch (Exception $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) { // Duplicate entry
                echo json_encode(['success' => false, 'message' => 'Email already exists']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()]);
            }
        }
        break;

    case 'logout':
        session_destroy();
        echo json_encode(['success' => true]);
        break;

    case 'check_session':
        if (isset($_SESSION['user_id'])) {
            echo json_encode([
                'success' => true,
                'user_id' => $_SESSION['user_id'],
                'name' => $_SESSION['name'],
                'role' => $_SESSION['role'],
                'patient_id' => $_SESSION['patient_id'] ?? null,
                'doctor_id' => $_SESSION['doctor_id'] ?? null
            ]);
        } else {
            echo json_encode(['success' => false]);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
?>
