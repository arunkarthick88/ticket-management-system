# 🎫 IT Helpdesk - Ticket Management System

A full-stack, enterprise-grade Ticket Management System built with **FastAPI** (Backend) and **React** (Frontend). This application features a complete Role-Based Access Control (RBAC) system, allowing standard users to submit issues, support agents to manage their assigned workflow, and administrators to oversee the entire operation.

## ✨ Features

* **Role-Based Access Control (RBAC):** Three distinct user roles (`User`, `Support`, `Admin`) with isolated dashboards and secure API endpoints.
* **Real-time Notifications:** Users receive automated alerts when their ticket status or priority is updated, complete with an interactive unread badge.
* **Support Workflow:** Dedicated dashboards for support technicians to view assigned tasks and post troubleshooting updates.
* **Admin Command Center:** A master view for administrators to triage tickets, reassign tasks, and update statuses.
* **Interactive UI:** Built with React, Tailwind CSS, and Lucide Icons for a clean, modern, and responsive user experience.

## 🛠️ Tech Stack

**Frontend:**
* React (Vite)
* Tailwind CSS
* React Router DOM
* Axios
* Lucide React (Icons)

**Backend:**
* Python / FastAPI
* PostgreSQL
* SQLAlchemy (ORM)
* Pydantic (Data Validation)

## 🚀 Getting Started

### Prerequisites
* Python 3.8+
* Node.js & npm
* PostgreSQL installed and running locally

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend