<?php
/**
 * One-time Admin Registration Page
 * Create initial admin account, then remove this file.
 */

require_once __DIR__ . '/backend/includes/config.php';

$errors = [];
$successMessage = '';
$existingAdminCount = 0;

try {
    $countStmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    $existingAdminCount = (int) $countStmt->fetchColumn();
} catch (Exception $e) {
    $errors[] = 'Could not verify existing admin accounts: ' . $e->getMessage();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['admin_name'] ?? '');
    $email = trim($_POST['admin_email'] ?? '');
    $password = $_POST['admin_password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if ($existingAdminCount > 0) {
        $errors[] = 'An admin account already exists. This page is intended for one-time setup only.';
    }

    if ($name === '' || strlen($name) < 3 || strlen($name) > 100) {
        $errors[] = 'Admin name must be between 3 and 100 characters.';
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    $hasMinLength = strlen($password) >= 8;
    $hasUpper = preg_match('/[A-Z]/', $password);
    $hasLower = preg_match('/[a-z]/', $password);
    $hasDigit = preg_match('/[0-9]/', $password);
    $hasSpecial = preg_match('/[^a-zA-Z0-9]/', $password);

    if (!($hasMinLength && $hasUpper && $hasLower && $hasDigit && $hasSpecial)) {
        $errors[] = 'Password must be at least 8 characters and include upper, lower, number, and special character.';
    }

    if ($password !== $confirmPassword) {
        $errors[] = 'Password and confirm password do not match.';
    }

    if (empty($errors)) {
        try {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')");
            $stmt->execute([$name, $email, $hashedPassword]);
            $successMessage = 'Admin account created successfully. Delete this file now: admin_registration.php';
            $existingAdminCount = 1;
        } catch (PDOException $e) {
            if ((int) $e->getCode() === 23000) {
                $errors[] = 'That email already exists.';
            } else {
                $errors[] = 'Failed to create admin account: ' . $e->getMessage();
            }
        } catch (Exception $e) {
            $errors[] = 'Failed to create admin account: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>One-Time Admin Registration</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        :root {
            --bg: #f4f7fb;
            --card: #ffffff;
            --primary: #0f766e;
            --primary-dark: #115e59;
            --text: #0f172a;
            --muted: #475569;
            --danger: #b91c1c;
            --success: #166534;
            --border: #dbe3ef;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--text);
            background: radial-gradient(circle at top right, #d9f2ee 0%, var(--bg) 45%, #eef2ff 100%);
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
        }

        .card {
            width: 100%;
            max-width: 560px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
            padding: 24px;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 1.5rem;
        }

        .meta {
            margin: 0 0 18px;
            color: var(--muted);
            font-size: 0.95rem;
        }

        .status {
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 14px;
            font-size: 0.92rem;
        }

        .status.error {
            background: #fef2f2;
            color: var(--danger);
            border: 1px solid #fecaca;
        }

        .status.success {
            background: #f0fdf4;
            color: var(--success);
            border: 1px solid #bbf7d0;
        }

        .status.warn {
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        form {
            display: grid;
            gap: 12px;
        }

        label {
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 4px;
            display: block;
        }

        input {
            width: 100%;
            padding: 11px 12px;
            border-radius: 10px;
            border: 1px solid var(--border);
            font-size: 0.95rem;
        }

        .password-group {
            display: flex;
            align-items: stretch;
        }

        .password-group input {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }

        .password-toggle {
            width: 46px;
            border: 1px solid var(--border);
            border-left: 0;
            border-top-right-radius: 10px;
            border-bottom-right-radius: 10px;
            background: #fff;
            color: #334155;
            cursor: pointer;
        }

        .password-toggle:hover {
            background: #f8fafc;
        }

        input:focus {
            outline: none;
            border-color: #5eead4;
            box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.25);
        }

        .hint {
            margin-top: 4px;
            color: var(--muted);
            font-size: 0.82rem;
        }

        .field-error {
            color: var(--danger);
            font-size: 0.82rem;
            margin-top: 4px;
            min-height: 16px;
        }

        button {
            margin-top: 4px;
            padding: 12px 16px;
            border: 0;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 700;
            color: #fff;
            background: var(--primary);
        }

        button:hover {
            background: var(--primary-dark);
        }

        button:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>One-Time Admin Registration</h1>
        <p class="meta">Use this page only once to create the first admin account.</p>

        <?php if (!empty($successMessage)): ?>
            <div class="status success"><?php echo htmlspecialchars($successMessage); ?></div>
        <?php endif; ?>

        <?php if ($existingAdminCount > 0): ?>
            <div class="status warn">An admin user already exists. Registration is disabled.</div>
        <?php endif; ?>

        <?php if (!empty($errors)): ?>
            <div class="status error">
                <strong>Please fix:</strong>
                <ul>
                    <?php foreach ($errors as $error): ?>
                        <li><?php echo htmlspecialchars($error); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <form id="adminRegisterForm" method="post" novalidate>
            <div>
                <label for="admin_name">Admin Name</label>
                <input type="text" id="admin_name" name="admin_name" maxlength="100" required
                    value="<?php echo htmlspecialchars($_POST['admin_name'] ?? ''); ?>">
                <div class="field-error" id="nameError"></div>
            </div>

            <div>
                <label for="admin_email">Admin Email</label>
                <input type="email" id="admin_email" name="admin_email" maxlength="100" required
                    value="<?php echo htmlspecialchars($_POST['admin_email'] ?? ''); ?>">
                <div class="field-error" id="emailError"></div>
            </div>

            <div>
                <label for="admin_password">Password</label>
                <div class="password-group">
                    <input type="password" id="admin_password" name="admin_password" minlength="8" required>
                    <button class="password-toggle" type="button" data-target="#admin_password" aria-label="Show or hide password">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
                <div class="hint">At least 8 chars with uppercase, lowercase, number, and special character.</div>
                <div class="field-error" id="passwordError"></div>
            </div>

            <div>
                <label for="confirm_password">Confirm Password</label>
                <div class="password-group">
                    <input type="password" id="confirm_password" name="confirm_password" minlength="8" required>
                    <button class="password-toggle" type="button" data-target="#confirm_password" aria-label="Show or hide confirm password">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
                <div class="field-error" id="confirmError"></div>
            </div>

            <button type="submit" <?php echo $existingAdminCount > 0 ? 'disabled' : ''; ?>>
                Create Admin Account
            </button>
        </form>
    </div>

    <script>
        (function () {
            const form = document.getElementById("adminRegisterForm");
            if (!form) return;

            const nameInput = document.getElementById("admin_name");
            const emailInput = document.getElementById("admin_email");
            const passwordInput = document.getElementById("admin_password");
            const confirmInput = document.getElementById("confirm_password");
            const toggleButtons = form.querySelectorAll(".password-toggle");

            const nameError = document.getElementById("nameError");
            const emailError = document.getElementById("emailError");
            const passwordError = document.getElementById("passwordError");
            const confirmError = document.getElementById("confirmError");

            function clearErrors() {
                nameError.textContent = "";
                emailError.textContent = "";
                passwordError.textContent = "";
                confirmError.textContent = "";
            }

            function validate() {
                clearErrors();
                let isValid = true;

                const name = nameInput.value.trim();
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                const confirmPassword = confirmInput.value;

                if (name.length < 3 || name.length > 100) {
                    nameError.textContent = "Name must be between 3 and 100 characters.";
                    isValid = false;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    emailError.textContent = "Enter a valid email address.";
                    isValid = false;
                }

                const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
                if (!strongPassword.test(password)) {
                    passwordError.textContent = "Password is not strong enough.";
                    isValid = false;
                }

                if (password !== confirmPassword) {
                    confirmError.textContent = "Passwords do not match.";
                    isValid = false;
                }

                return isValid;
            }

            toggleButtons.forEach(function (btn) {
                btn.addEventListener("click", function () {
                    const targetSelector = btn.getAttribute("data-target");
                    const input = targetSelector ? document.querySelector(targetSelector) : null;
                    if (!input) return;

                    const isHidden = input.type === "password";
                    input.type = isHidden ? "text" : "password";

                    const icon = btn.querySelector("i");
                    if (!icon) return;
                    icon.classList.toggle("bi-eye", !isHidden);
                    icon.classList.toggle("bi-eye-slash", isHidden);
                });
            });

            form.addEventListener("submit", function (e) {
                if (!validate()) {
                    e.preventDefault();
                }
            });
        })();
    </script>
</body>
</html>
