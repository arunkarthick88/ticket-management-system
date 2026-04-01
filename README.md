# IT Helpdesk - Ticket Management System

A full-stack, enterprise-grade Ticket Management System built with **FastAPI** (Backend) and **React** (Frontend). This application features a complete Role-Based Access Control (RBAC) system, real-time WebSocket notifications, automated background tasks, and extensive API optimizations for high performance.

## Features
* **Role-Based Access Control (RBAC):** Three distinct user roles (`user`, `support`, `admin`) with isolated dashboards and secure API endpoints.
* **Real-Time WebSockets:** Instant, live popup notifications and dynamic unread badge updates without requiring page reloads.
* **Comprehensive Audit Trail:** Tracks and displays a chronological timeline of every action performed on a ticket (creation, reassignment, status changes, reopening).
* **Advanced Ticket Handling:** Features duplicate ticket detection, user-driven ticket reopening with required reasoning, and automated background tasks for priority escalation (e.g., auto-escalating open tickets to 'High' after 48 hours).
* **API Optimization & Security:** Global rate limiting (100 requests/minute) using `slowapi` to prevent abuse, combined with extensive PostgreSQL database indexing for lightning-fast querying.
* **Support Workflow:** Dedicated dashboards for support technicians to view assigned tasks and post troubleshooting updates.
* **Admin Command Center:** A master view for administrators to triage tickets, reassign tasks, and update statuses.
* **Interactive UI:** Built with React, Tailwind CSS, and Lucide Icons for a clean, modern, and responsive user experience.

## Tech Stack
**Frontend:** React (Vite), Tailwind CSS, React Router DOM, Axios, Lucide React (Icons)
**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy (ORM), Pydantic, JWT Authentication, FastAPI WebSockets, SlowAPI, BackgroundTasks

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
pip install fastapi uvicorn sqlalchemy psycopg2 pydantic passlib python-jose python-multipart slowapi websockets
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

## Implementation Logic

### 1. Real-Time Engine (WebSockets & Background Tasks)
* **Connection Manager:** A centralized WebSocket manager maps active `user_id`s to their socket connections, allowing the backend to broadcast targeted, real-time JSON payloads to specific users when their tickets are updated.
* **Automated Escalation:** Utilizes FastAPI's `BackgroundTasks`. When a ticket is created, a non-blocking asynchronous timer starts. If the ticket remains unresolved after 48 hours, the system automatically escalates its priority and fires a WebSocket alert to the user.

### 2. Activity Timeline (Audit Trail)
* **Database Layer (`models.py`):** A dedicated `TicketActivity` table logs every state change. It utilizes foreign keys to link the action to both the `ticket_id` and the `user_id` of the person who initiated the change.
* **Frontend Integration (`TicketDetails.jsx`):** The React UI fetches this data and renders it as a chronological timeline component, giving administrators and users a transparent, timestamped history of the ticket's lifecycle.

### 3. Ticket Updates Module
The **Ticket Updates** module is a core feature that allows Support Staff and Admins to communicate troubleshooting steps and progress on a specific ticket.
* **Database Layer (`models.py`):** We created a `TicketUpdate` table in PostgreSQL using SQLAlchemy. It relies on **Foreign Keys** to establish strict relational integrity: `ticket_id` links the update to a specific ticket, and `support_user_id` links it to the staff member who wrote it. A `created_at` timestamp ensures updates are inherently chronologically ordered.
* **Backend Layer (`ticket_router.py`):** Two secure endpoints manage this data:
  * `POST /tickets/{ticket_id}/updates`: The route actively checks the JWT token (rejecting standard `"user"` roles) and verifies assignment validation before allowing a support member to insert a record.
  * `GET /tickets/{ticket_id}/updates`: Fetches the timeline of comments, ordered by newest first.
* **Frontend Layer (`TicketDetails.jsx`):** The React component dynamically adjusts based on who is viewing it. The "Add New Update" text area and submit button are completely hidden from standard users by evaluating `currentUserRole === 'admin' || currentUserRole === 'support'`. Submitting the form triggers a `POST` request, clears the local state input, and immediately re-fetches the timeline to display the new comment without reloading the page.