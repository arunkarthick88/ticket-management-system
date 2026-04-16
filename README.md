# IT Helpdesk - Ticket Management System

A full-stack, enterprise-grade Ticket Management System built with **FastAPI** (Backend) and **React** (Frontend). This application features a complete Role-Based Access Control (RBAC) system, real-time WebSocket notifications, automated background tasks, visual data analytics, and extensive API optimizations for high performance.

## Features
* **Role-Based Access Control (RBAC):** Three distinct user roles (`user`, `support`, `admin`) with isolated dashboards and secure API endpoints.
* **Real-Time WebSockets & Automated Emails:** Instant, live popup notifications without requiring page reloads, coupled with asynchronous background email alerts for ticket assignments and status updates.
* **Advanced Data Analytics:** Admin dashboard featuring interactive Chart.js visualizations for status and priority distributions, plus one-click CSV data exports.
* **Secure File Management:** End-users and staff can attach validation-checked files (Images/PDFs, max 5MB) to tickets, stored securely via asynchronous file handling.
* **High-Performance Data Grids:** Server-side pagination, keyword searching, and filtering to ensure the frontend remains lightning-fast regardless of database size.
* **Comprehensive Audit Trail:** Tracks and displays a chronological timeline of every action performed on a ticket (creation, reassignment, status changes, reopening).
* **Advanced Ticket Handling:** Features duplicate ticket detection, user-driven ticket reopening, and automated background tasks for priority escalation (e.g., auto-escalating open tickets after 48 hours).

## Tech Stack
**Frontend:** React (Vite), Tailwind CSS, React Router DOM, Axios, Lucide React (Icons), Chart.js, React-Chartjs-2
**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy (ORM), Pydantic, JWT Authentication, FastAPI WebSockets, SlowAPI, FastAPI-Mail, Aiofiles

---

## Getting Started

### Prerequisites
* Python 3.8+
* Node.js & npm
* PostgreSQL installed and running locally
* A Gmail account with an "App Password" generated for email services.

### 1. Backend Setup
Navigate to the backend directory and set up your Python environment:

```bash
cd backend
python -m venv venv
# Activate the environment
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2 pydantic passlib python-jose python-multipart slowapi websockets aiofiles fastapi-mail
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

### 1. Real-Time Engine & Asynchronous Communications
The system relies on background processes and active connections to deliver instant updates without blocking the main API thread.
* **Connection Manager:** A centralized WebSocket manager maps active `user_id`s to their socket connections, allowing the backend to broadcast targeted, real-time JSON payloads to specific users when their tickets are updated.
* **Automated Escalation:** Utilizes FastAPI's `BackgroundTasks`. When a ticket is created, a non-blocking asynchronous timer starts. If the ticket remains unresolved after 48 hours, the system automatically escalates its priority to 'High' and fires a WebSocket alert to the user.
* **Email Notifications (`email_service.py`):** Integrates `fastapi-mail` to dispatch background HTML emails upon ticket assignment, reopening, or status changes, ensuring users are notified even when offline.

### 2. Activity Timeline (Audit Trail)
Provides a transparent, timestamped history of a ticket's lifecycle for security and accountability.
* **Database Layer (`models.py`):** A dedicated `TicketActivity` table logs every state change. It utilizes foreign keys to link the action to both the `ticket_id` and the `user_id` of the person who initiated the change.
* **Frontend Integration (`TicketDetails.jsx`):** The React UI fetches this data and renders it as a chronological timeline component, giving administrators and users a clear history of events.

### 3. Ticket Updates Module
A core feature that allows Support Staff and Admins to communicate troubleshooting steps and progress on a specific ticket.
* **Database Layer (`models.py`):** We created a `TicketUpdate` table in PostgreSQL using SQLAlchemy. It relies on **Foreign Keys** to establish strict relational integrity: `ticket_id` links the update to a specific ticket, and `support_user_id` links it to the staff member who wrote it. A `created_at` timestamp ensures updates are inherently chronologically ordered.
* **Backend Layer (`ticket_router.py`):** Two secure endpoints manage this data:
  * `POST /tickets/{ticket_id}/updates`: The route actively checks the JWT token (rejecting standard `"user"` roles) and verifies assignment validation before allowing a support member to insert a record.
  * `GET /tickets/{ticket_id}/updates`: Fetches the timeline of comments, ordered by newest first.
* **Frontend Layer (`TicketDetails.jsx`):** The React component dynamically adjusts based on who is viewing it. The "Add New Update" text area and submit button are completely hidden from standard users by evaluating `currentUserRole === 'admin' || currentUserRole === 'support'`. Submitting the form triggers a `POST` request, clears the local state input, and immediately re-fetches the timeline to display the new comment without reloading the page.

### 4. Secure File Attachment System
Allows users and staff to upload diagnostic images and PDFs directly to tickets.
* **Database Layer (`models.py`):** A `TicketAttachment` table tracks metadata (`file_name`, `content_type`) and maps it to a local `file_path`. This approach prevents database bloat by storing files on the filesystem rather than as binary blobs in PostgreSQL.
* **Backend Layer (`ticket_router.py`):** Implements `python-multipart` to accept `UploadFile` objects. The route enforces a strict 5MB size limit and MIME-type validation (`image/jpeg`, `image/png`, `application/pdf`) in memory before writing the file asynchronously using `aiofiles` to a local directory. Download endpoints verify JWT ownership before serving the file via `FileResponse`.
* **Frontend Layer (`CreateTicket.jsx` & `TicketDetails.jsx`):** Utilizes `FormData` objects to post binary data. Implements a clever two-step upload during ticket creation (creates the text ticket -> receives the new ID -> uploads the file to that ID) and provides secure, token-authenticated download handlers.

### 5. High-Performance Data Grids (Pagination & Search)
Ensures the Admin Dashboard remains highly responsive and memory-efficient regardless of database size.
* **Backend Layer (`admin_router.py`):** The `GET /admin/tickets/search` endpoint bypasses standard queries to leverage SQLAlchemy's `limit` and `offset` for true server-side pagination. It uses `or_` and `ilike` operators to perform case-insensitive keyword searches across ticket titles and descriptions directly at the database level.
* **Frontend Layer (`AdminDashboard.jsx`):** Manages `page`, `limit`, and active filters in React state. Automatically re-fetches data dynamically when filters change via `useEffect`, relying on the backend's `meta` response payload to calculate total pages and render navigation controls.

### 6. Advanced Data Analytics & CSV Export
Provides administrators with a high-level, visual overview of system health and raw data access.
* **Backend Layer (`admin_router.py`):** The `/analytics` endpoint offloads heavy mathematical aggregations to PostgreSQL using `func.count` and `group_by`, returning a lightweight JSON payload. The `/export-csv` endpoint generates a real-time CSV file purely in server memory using Python's `io.StringIO` and streams it back to the client via `StreamingResponse`.
* **Frontend Layer (`Analytics.jsx`):** Consumes the aggregated JSON data to render interactive, animated `Doughnut` and `Bar` charts using `react-chartjs-2`. Triggers seamless file downloads by creating a temporary DOM blob link to capture the incoming backend CSV stream.

## SLA Engine API Documentation

### New SLA Endpoints
| Method | Endpoint | Purpose | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/tickets/sla/scan` | Triggers the background scanner to evaluate all open tickets, updating statuses to `at_risk` or `breached` based on current time vs `due_at`. | Admin |
| **GET** | `/admin/sla-summary` | Returns aggregated metrics (`breached_count`, `at_risk_count`, `compliance_percentage`) for the dashboard. | Admin |

### Updated Existing Endpoints
* **`POST /tickets/`**: Now automatically computes and injects the `due_at` timestamp based on priority (Low: 72h, Med: 48h, High: 24h, Urgent: 8h).
* **`PATCH /tickets/{id}/priority`**: Now triggers a recalculation of the `due_at` deadline using the new priority threshold.
* **`PATCH /tickets/{id}/status`**: If marked 'Resolved' or 'Closed', checks the current time against `due_at` and sets `sla_status` to `completed` if successful.
* **`POST /tickets/{id}/updates`**: Captures the `first_response_at` timestamp upon the first comment from a support user.

### 7. Advanced Full-Text Search (PostgreSQL FTS)
Replaces basic string matching with a highly intelligent, natural-language search engine natively within the database.
* **Database Layer:** Uses PostgreSQL's `tsvector` and `tsquery`. The backend dynamically concatenates the ticket `title` and `description` (using `coalesce` to handle nulls) into a searchable vector document.
* **Hybrid Matching & Ranking:** The `GET /tickets/search` endpoint utilizes a hybrid approach. It checks for exact word matches using `@@` operator and calculates a relevance score using `ts_rank` to order the best results first. It simultaneously falls back to `ILIKE` partial matching to ensure incomplete words (e.g., "err" for "error") still return valid results.

### 8. Bulk Operations & Soft Deletion (Trash Can)
Allows administrators to manage massive queues instantly without permanently destroying relational data.
* **Backend Layer (`admin_router.py`):** Bulk endpoints (`/bulk-status`, `/bulk-assign`, `/bulk-delete`) accept arrays of `ticket_ids`. Instead of looping through IDs (which is slow), it performs a single, high-performance SQLAlchemy bulk update using `synchronize_session=False`.
* **Soft Delete Architecture:** Tickets are never `DELETE`d from the database. Instead, an `is_deleted` boolean is toggled to `True`. The main active queue globally filters out these records, while a dedicated Trash Can endpoint fetches them, allowing for a 1-click "Restore" functionality.

### 9. In-Memory Caching & Background Invalidation
Optimizes dashboard load times by preventing heavy, repetitive database aggregations.
* **Backend Caching:** Heavy endpoints like `/analytics` and `/sla-summary` are wrapped with the `@cache(expire=60)` decorator from `fastapi-cache`. 
* **Cache Invalidation:** When a ticket is created, updated, or deleted, FastAPI triggers a `BackgroundTask` to instantly clear the cache namespace (`FastAPICache.clear`). This ensures users always see real-time data after making a change, while passive viewers get lightning-fast cached responses.

### 10. Saved Filter States (Custom Views)
Empowers administrators to save complex search and dropdown criteria into reusable 1-click dashboard views.
* **Database Layer:** A `SavedFilter` table maps directly to a `user_id` and utilizes a generic `JSON` column to store the exact combination of parameters (Search Term, Priority, Status, Tag) active at the time of saving.
* **Frontend Layer:** The React UI parses this JSON and dynamically overwrites the local state variables, triggering an instant re-fetch of the customized data grid.