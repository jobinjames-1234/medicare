/**
 * CarePlus Hospital System - Customer Support Dashboard Logic
 */
$(document).ready(function () {
    bindPasswordToggleHandlers();
    bindEditProfileModalReset();

    $.ajax({
        url: "backend/api/auth.php?action=check_session",
        method: "GET",
        dataType: "json",
        success: function (res) {
            if (!res.success || res.role !== "cu_support") {
                window.location.href = "login.html";
            } else {
                loadMessages();
                loadProfile();
            }
        }
    });

    window.switchTab = function (tabName) {
        $(".nav-item").removeClass("active");
        $(`[onclick="switchTab('${tabName}')"]`).addClass("active");

        if (tabName === "messages") {
            $("#messagesTab").removeClass("d-none");
            $("#profileTab").addClass("d-none");
            $("#pageTitle").text("Messages");
            loadMessages();
        } else {
            $("#messagesTab").addClass("d-none");
            $("#profileTab").removeClass("d-none");
            $("#pageTitle").text("My Profile");
            loadProfile();
        }
    };

    function bindPasswordToggleHandlers() {
        $(document).on("click", ".password-toggle", function () {
            const targetSelector = $(this).data("target");
            const $input = $(targetSelector);
            if (!$input.length) return;

            const isHidden = $input.attr("type") === "password";
            $input.attr("type", isHidden ? "text" : "password");

            const $icon = $(this).find("i");
            $icon.toggleClass("bi-eye", !isHidden);
            $icon.toggleClass("bi-eye-slash", isHidden);
        });
    }

    function bindEditProfileModalReset() {
        $("#editSupportProfileModal").on("hidden.bs.modal", function () {
            clearEditPasswordFields();
        });
    }

    function clearEditPasswordFields() {
        $("#editSupportCurrentPassword, #editSupportNewPassword, #editSupportConfirmPassword")
            .val("")
            .attr("type", "password");
        $("#editSupportProfileForm .password-toggle i")
            .removeClass("bi-eye-slash")
            .addClass("bi-eye");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function loadMessages() {
        $.ajax({
            url: "backend/api/customer_support.php?action=get_messages",
            method: "GET",
            dataType: "json",
            success: function (res) {
                const tbody = $("#supportMessagesList");
                tbody.empty();

                if (res.success && Array.isArray(res.messages) && res.messages.length > 0) {
                    res.messages.forEach(function (m) {
                        const status = (m.status || "Open").toString();
                        const statusLower = status.toLowerCase();
                        const isResolved = statusLower === "resolved";
                        const isIgnored = statusLower === "ignored";
                        const badgeClass = isResolved
                            ? "bg-success"
                            : (isIgnored ? "bg-secondary" : "bg-warning text-dark");
                        const resolvedMeta = (isResolved || isIgnored) && m.resolved_at
                            ? `<div class="small text-muted mt-1">${escapeHtml(m.resolved_at)}${m.resolved_by_name ? ` by ${escapeHtml(m.resolved_by_name)}` : ""}</div>`
                            : "";
                        const resolveBtn = isResolved
                            ? `<button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" disabled>Resolved</button>`
                            : (isIgnored
                                ? `<button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" disabled>Resolve</button>`
                                : `<button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" onclick="markMessageResolved(${Number(m.message_id)})">Resolve</button>`);
                        const ignoreBtn = isIgnored
                            ? `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3" disabled>Ignored</button>`
                            : `<button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="markMessageIgnored(${Number(m.message_id)})">Ignore</button>`;
                        const actionBtn = `${resolveBtn}${ignoreBtn}`;

                        tbody.append(`
                            <tr>
                                <td>${escapeHtml(m.created_at || "N/A")}</td>
                                <td>${escapeHtml(m.name || "N/A")}</td>
                                <td>${escapeHtml(m.email || "N/A")}</td>
                                <td>${escapeHtml(m.whatsapp_number || "-")}</td>
                                <td>${escapeHtml(m.subject || "-")}</td>
                                <td style="max-width: 420px; white-space: normal;">${escapeHtml(m.message || "")}</td>
                                <td>
                                    <span class="badge ${badgeClass} rounded-pill px-3 py-2">${escapeHtml(status)}</span>
                                    ${resolvedMeta}
                                </td>
                                <td>${actionBtn}</td>
                            </tr>
                        `);
                    });
                } else {
                    tbody.append("<tr><td colspan='8' class='text-center py-4 text-muted'>No messages found.</td></tr>");
                }
            },
            error: function () {
                $("#supportMessagesList").html("<tr><td colspan='8' class='text-center py-4 text-danger'>Failed to load messages.</td></tr>");
            }
        });
    }

    window.markMessageResolved = function (messageId) {
        if (!confirm("Mark this message as resolved?")) return;

        $.ajax({
            url: "backend/api/customer_support.php?action=mark_message_resolved",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ message_id: Number(messageId) }),
            success: function (res) {
                if (res.success) {
                    loadMessages();
                } else {
                    alert("Error: " + (res.message || "Failed to update message status"));
                }
            },
            error: function () {
                alert("Server error occurred while updating message status.");
            }
        });
    };

    window.markMessageIgnored = function (messageId) {
        if (!confirm("Mark this message as ignored?")) return;

        $.ajax({
            url: "backend/api/customer_support.php?action=mark_message_ignored",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ message_id: Number(messageId) }),
            success: function (res) {
                if (res.success) {
                    loadMessages();
                } else {
                    alert("Error: " + (res.message || "Failed to update message status"));
                }
            },
            error: function () {
                alert("Server error occurred while updating message status.");
            }
        });
    };

    function loadProfile() {
        $.ajax({
            url: "backend/api/customer_support.php?action=get_profile",
            method: "GET",
            dataType: "json",
            success: function (res) {
                if (!res.success || !res.profile) return;

                const p = res.profile;
                $("#spName").text(p.staff_name || p.name || "N/A");
                $("#spEmail").text(p.email || "N/A");
                $("#spRole").text(p.role || "cu_support");
                $("#spCreatedAt").text(p.created_at || "N/A");

                $("#editSupportName").val(p.staff_name || p.name || "");
                $("#editSupportEmail").val(p.email || "");
                clearEditPasswordFields();
            }
        });
    }

    $("#editSupportProfileForm").on("submit", function (e) {
        e.preventDefault();

        const name = $("#editSupportName").val().trim();
        const email = $("#editSupportEmail").val().trim();
        const currentPassword = $("#editSupportCurrentPassword").val().trim();
        const newPassword = $("#editSupportNewPassword").val().trim();
        const confirmPassword = $("#editSupportConfirmPassword").val().trim();
        const wantsPasswordChange = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

        if (!name || !email) {
            alert("Name and email are required.");
            return;
        }

        if (wantsPasswordChange) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert("To change password, fill current password, new password, and confirm password.");
                return;
            }
            if (newPassword.length < 6) {
                alert("New password must be at least 6 characters.");
                return;
            }
            if (newPassword !== confirmPassword) {
                alert("New password and confirm password do not match.");
                return;
            }
        }

        $.ajax({
            url: "backend/api/customer_support.php?action=update_profile",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                name: name,
                email: email,
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            }),
            success: function (res) {
                if (res.success) {
                    alert("Profile updated successfully!");
                    bootstrap.Modal.getInstance(document.getElementById("editSupportProfileModal")).hide();
                    loadProfile();
                } else {
                    alert("Error: " + (res.message || "Failed to update profile"));
                }
            },
            error: function () {
                alert("Server error occurred while updating profile.");
            }
        });
    });
});
