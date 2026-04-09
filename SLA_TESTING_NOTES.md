# SLA Engine - Manual Validation Notes

## Scenario 1: Ticket Creation & Initial Due Date Calculation
* **Action:** Created a new ticket with **Medium** priority at 10:00 AM on Monday.
* **Expected Result:** SLA engine assigns a `due_at` timestamp of 10:00 AM on Wednesday (48 hours later).
* **Actual Result:** Pass. Database correctly stamped `due_at` (+48 hours) and `sla_status` defaulted to `on_track`. UI displays the green "On Track" badge.

## Scenario 2: Dynamic Priority Recalculation
* **Action:** Admin changed the priority of a **Medium** ticket (48h) to **Urgent** (8h).
* **Expected Result:** The system recalculates the `due_at` based on the *original* `created_at` timestamp + 8 hours.
* **Actual Result:** Pass. `due_at` shifted closer. If the 8-hour window had already passed, the `/sla/scan` immediately caught the recalculation and marked it `breached`.

## Scenario 3: SLA Scanner & Thresholds
* **Action:** Ran the `POST /tickets/sla/scan` endpoint against a database containing varied tickets.
* **Expected Result:** Tickets with `< 4 hours` remaining become `at_risk`. Tickets past `due_at` become `breached`.
* **Actual Result:** Pass. Database updated statuses accordingly. Admin dashboard accurately reflected the new counts for Breached and At-Risk tickets.

## Scenario 4: SLA Resolution & Compliance
* **Action:** Support staff marked an `on_track` ticket as `Resolved`.
* **Expected Result:** `resolved_at` timestamp is captured. System compares it to `due_at` and updates `sla_status` to `completed`.
* **Actual Result:** Pass. Ticket received the blue "SLA Met" badge. The Admin Dashboard Compliance Percentage recalculated successfully.