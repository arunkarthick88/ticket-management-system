# IT Helpdesk - Ticket Management System

A full-stack, enterprise-grade Ticket Management System built with **FastAPI** (Backend) and **React** (Frontend). This application features a complete Role-Based Access Control (RBAC) system, allowing standard users to submit issues, support agents to manage their assigned workflow, and administrators to oversee the entire operation.

## Features
* **Role-Based Access Control (RBAC):** Three distinct user roles (`user`, `support`, `admin`) with isolated dashboards and secure API endpoints.
* **Real-time Notifications:** Users receive automated alerts when their ticket status or priority is updated, complete with an interactive unread badge.
* **Support Workflow:** Dedicated dashboards for support technicians to view assigned tasks and post troubleshooting updates.
* **Admin Command Center:** A master view for administrators to triage tickets, reassign tasks, and update statuses.
* **Interactive UI:** Built with React, Tailwind CSS, and Lucide Icons for a clean, modern, and responsive user experience.

## Tech Stack
**Frontend:** React (Vite), Tailwind CSS, React Router DOM, Axios, Lucide React (Icons)
**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy (ORM), Pydantic, JWT Authentication

---

## Getting Started

### Prerequisites
* Python 3.8+
* Node.js & npm
* PostgreSQL installed and running locally

### 1. Backend Setup
Navigate to the backend directory and set up your Python environment:
```bash
cd backend
python -m venv venv
# Activate the environment
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2 pydantic passlib python-jose python-multipart
```
Ensure your PostgreSQL database is running and matches the credentials in your `database.py` file. Then, start the server:
```bash
uvicorn main:app --reload
```
*The API will be available at `http://localhost:8000` and the Swagger documentation at `http://localhost:8000/docs`.*

### 2. Frontend Setup
Open a new terminal, navigate to the frontend directory, and start the Vite development server:
```bash
cd frontend
npm install
npm run dev
```
*The application will be available at `http://localhost:5173`.*

---

## Implementation Logic: Ticket Updates Module

The **Ticket Updates** module is a core feature that allows Support Staff and Admins to communicate troubleshooting steps and progress on a specific ticket. It spans across the database, backend API, and frontend UI.

### 1. Database Layer (`models.py`)
We created a `TicketUpdate` table in PostgreSQL using SQLAlchemy. 
* It relies on **Foreign Keys** to establish strict relational integrity: `ticket_id` links the update to a specific ticket, and `support_user_id` links it to the staff member who wrote it.
* A `created_at` timestamp ensures updates are inherently chronologically ordered.

### 2. Backend Layer (`ticket_router.py`)
Two secure endpoints manage this data:
* `POST /tickets/{ticket_id}/updates`: 
  * **RBAC Security:** The route actively checks the JWT token. If the user is a standard `"user"`, it throws a 403 Forbidden error.
  * **Assignment Validation:** If the user is `"support"`, the system verifies they are actually assigned to `ticket_id` before allowing the database insertion.
* `GET /tickets/{ticket_id}/updates`: Fetches the timeline of comments, ordered by newest first.

### 3. Frontend Layer (`TicketDetails.jsx`)
The React component dynamically adjusts based on who is viewing it:
* **State Management:** Uses `useEffect` to trigger parallel Axios calls fetching both the core Ticket data and the Array of Updates.
* **Conditional Rendering:** The "Add New Update" text area and submit button are completely hidden from standard users by evaluating `currentUserRole === 'admin' || currentUserRole === 'support'`.
* **Seamless UX:** Submitting the form triggers a `PATCH` request, clears the local state input, and immediately re-fetches the timeline to display the new comment without reloading the page.