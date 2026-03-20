# 🤝 Team Contribution & Git Guide

CarePlus is developed by a **12-member team**. Each role corresponds to a specific branch in the repository.

## 👥 The team & Branches
| Role | Lead | Branch Name |
| :--- | :--- | :--- |
| **Project Lead** | Keerthana | `main` |
| **UI/UX Designer**| Milan | `ui-development` |
| **HTML Lead** | Jidhin | `html-structure` |
| **CSS Developer** | Liya | `css-styling` |
| **Bootstrap Dev** | Jasir | `bootstrap-components` |
| **JS Logic** | Krishna | `javascript-logic` |
| **jQuery Lead** | Joseph | `jQuery-developer` |
| **AJAX Lead** | Josekutty | `AJAX-Developer` |
| **Backend Dev** | Jobin | `php-backend` |
| **Database Lead** | Lamees | `mysql-database` |
| **Integrator** | Mahi | `integration` |
| **QA / Testing** | Jiya | `testing-documentation` |

---

## 🌿 Git Workflow (Step-by-Step)

### 1. Setup & Branching
```bash
# Clone and enter project
git clone <repository_url>
cd Hospital-Appointment-Booking-System

# Switch to your assigned branch
git checkout <your-branch-name>
```

### 2. Daily Development
```bash
# Get latest changes from the main branch
git pull origin main

# Add and commit your work
git add .
git commit -m "feat: your descriptive message"
```

### 3. Sharing & Merging
```bash
# Push your work to your branch
git push origin <your-branch-name>

# To merge main into your branch if needed
git merge main
```

### 4. Pull Requests
- Open a PR from your branch → `main`.
- **Keerthana** will review and merge the code.

---
*For final verification, refer to the [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md).*
