# Tixigo — PERN (JavaScript-only) MVP

**Stack**
- **Frontend:** Vite + React (JSX), HTML, CSS (Tailwind), Axios
- **Backend:** Node.js + Express (pure JS/ESM), REST API, JWT auth
- **Database:** PostgreSQL via Prisma (JS)
- **Extras:**  QR tickets (JWT), html5-qrcode scanner, Owner/Organizer/Staff/Customer roles


# Tixigo — discover events, book tickets, scan on entry

Hi, I’m Saiteja. Still there are lot of applications which are similar to our application are existed in our real-world, This is my own idea built **Tixigo** to make small-event ticketing feel “enterprise-grade” without the busywork. My main motive as a graduate who finished my Masters in Computer Science is,i want to show my recruiters and fellow members about my entreprenuership skills(i believed my idea which came from day to day problems and planned how to  work on this project to make it more effectively), strong foundation in my Full-stack(PERN STACK) Development with strong background , problem-solving and innovative skills(which i planned right from the beginning to end, solved each and every problem by completely dedicating my time, efforts on this and able to finish it wonderfully and successfully).

The pitch is simple: organisers create events with showtimes and ticket types, customers buy tickets, and 
staff scan people in at the door. There’s an **Owner** role that sees revenue and approves new organisers.

This README is written as if I’m handing the project to a teammate. It covers how the app works, how to run it, 
design decisions, and trade‑offs. If you’re a recruiter: this shows how I structure and ship production-facing code.

<figure>
  <img src="docs/T_Homepage.png"  align="center" alt="Home Page" width="900">
  <figcaption><i>HOME PAGE</i></figcaption>
</figure>


---

## Key capabilities

### For customers
- Create Account and verify the link through mail to create account.
- Login and reset password flows.
- Manage Profile
- Browse and search public events(filter options is added).
- Buy tickets; each ticket gets a unique code + QR image.
- See **My Tickets** and present the QR at entry.

  ### For Staff
- Open account, request the oragniser using link to be a Staff.

- Open the **Staff tools page** to scan the tickets

- Initiate refunds if necessary

### For organisers
- Submit a **“Become an organiser”** request.
- Once approved, create events with:
  - Multiple **showtimes** (date/time + capacity).
  - Multiple **ticket types** (name, price, currency, perks).
  - Photo gallery and description.
- Invite and approve staff for scanning.
- View per‑event **insights**: capacity, sold, left, checked‑in, refunded, breakdown per showtime.

### For owner
- **Admin dashboard**: KPIs (revenue, events, tickets).
- View **pending organiser requests**; approve/reject.
- Segment events: upcoming / today / past.
- Soft-cancel events (auto-issue refunds per ticket).
- Access to every event organiser Dashboards

---

## System design (one‑pager)

```
Client (React + Tailwind)
  ↕ JSON over HTTPS
Server (Node/Express)
  ↔ Prisma ORM
PostgreSQL
Stripe (payments) | SMTP (email)
```

- **Auth:** JWT in `Authorization: Bearer <token>`; email verification required.
- **Authorisation:** `requireRole([...])` guards routes. Server is the authority; UI also hides forbidden actions.
- **Database:** Prisma schema; relations for User ↔ Events ↔ Tickets, and admin flows (organiser requests, staff invites).
- **Idempotency:** create routes keep side‑effects minimal; organiser request creation is upsert-like.
- **Cancellations:** owner cancels an event → per-ticket refund + mail (best‑effort) + soft flags in DB.

---

## Data model (short tour)

### Core tables
- **User** — roles: `CUSTOMER | ORGANIZER | STAFF | OWNER` (+ profile bits).
- **OrganizerRequest** — one row per user; `pending/approved/rejected` with owner decision metadata.
- **Event** — organiserId, title, description, photos[], category, location, date range, active flag.
- **ShowTime** — `(eventId, dateTime, capacity)`.
- **TicketType** — `(eventId, name, priceCents, currency, perks)`.
- **Order** — `(userId, eventId, showTimeId, amountCents, status)`.
- **Ticket** — `(orderId, eventId, showTimeId, ticketTypeId, userId?, code, qrPng?, ticketNumber, admitted, refunded)`.
- **StaffInvite / StaffAssignment** — controlled access for scanning.
- **EmailVerification / PasswordReset** — token flows.
- **RefundRequest** — audit trail for refunds.

### ERD (ASCII)
```
User (role) 1---* Event
User 1---1 OrganizerRequest
Event 1---* ShowTime
Event 1---* TicketType
Order 1---* Ticket
Event 1---* Ticket
ShowTime 1---* Ticket
TicketType 1---* Ticket
User 1---* StaffAssignment *---1 Event
```

---

## API overview (selected)

Public
- `GET   /api/events` — list (search: `?q=`)
- `GET   /api/events/:id` — detail (with showtimes & ticket types)

Auth (customer)
- `POST  /api/auth/register|/login|/verify|/forgot|/reset`
- `GET   /api/auth/me`

Organiser / Owner
- `POST  /api/events` — create (organiser or owner)
- `PUT   /api/events/:id` — update (owner or event’s organiser)
- `POST  /api/events/:id/toggle` — cancel/restore
- `GET   /api/events/mine` — my events (owner sees all)
- `GET   /api/events/:id/insights` — capacity/sold/left/admitted/refunded (+ per showtime)
- `GET   /api/events/:id/tickets` — full ticket list for the event

Becoming an organiser
- `POST  /api/organizers/requests` — create/ensure my request
- `GET   /api/organizers/requests/mine` — my request status

Owner: organiser approvals (the endpoints Admin.jsx uses)
- `GET   /api/admin/organizers/pending`
- `POST  /api/admin/organizers/:userId/approve`
- `POST  /api/admin/organizers/:userId/remove`

Owner: KPIs & events
- `GET   /api/admin/kpis`
- `GET   /api/admin/events/segments?segment=upcoming|today|past`

---

## Running locally

### 1) Backend

```bash
cd server
cp .env.example .env
# Provide these:
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/tixigo
# JWT_SECRET=change-me
# STRIPE_SECRET_KEY=sk_test_...       # optional in local dev
# MAIL_HOST=smtp.yourprovider.com
# MAIL_PORT=587
# MAIL_USER=postmaster@yourdomain.com
# MAIL_PASS=****************
# MAIL_FROM_NAME="Tixigo"
# MAIL_FROM_EMAIL=no-reply@yourdomain.com

npm i
npx prisma migrate dev
npm run dev
```

### 2) Frontend

```bash
cd client
cp .env.example .env       # VITE_API_BASE defaults to http://localhost:4000/api
npm i
npm run dev
```

### 3) Make yourself the OWNER (local)
Register, then in Postgres:

```sql
update "User" set role='OWNER' where email='you@example.com';
```

You’ll now see **Owner Admin** and can approve organiser requests.

---

## Developer notes

### Tickets by Event — “Checked‑in” column
UI shows: `admitted ? "Yes" : "—"`. Server returns each ticket with `admitted` (boolean) and `showTime.dateTime`. 
If you prefer a timestamp, add `checkedInAt` to the schema and set it at scan time.

### Event creation date inputs
API accepts ISO datetimes and a UK-friendly `dd-mm-yyyy hh:mm` fallback. 
All are normalised server‑side in one place (`parseMaybeDMY`).

### Email “from” identity
Configure in `server/.env`:
```
MAIL_FROM_NAME="Tixigo"
MAIL_FROM_EMAIL=no-reply@yourdomain.com
```
This ensures recruiters won’t see a personal address as the sender.

### Error boundaries (client)
React Router is configured with dedicated routes; deep links like `/owner`, `/organizer` and `/become-organiser` are 
first‑class paths, so no more “No routes matched” surprises.

---

## Stripe flow (MVP)
- On checkout, we create a Payment Intent and confirm on the client.
- On success, we create an `Order` and its `Ticket` rows.
- Owner cancellation triggers a refund per ticket (best‑effort). 
- All refunds are also recorded in `RefundRequest` for auditability.

---

## Security & privacy
- Hashed passwords (bcrypt), JWTs with sensible expiry, HTTPS in prod.
- Strict server‑side role checks; client UI is purely convenience.
- Email verification is required before privileged routes.
- Invite tokens, reset tokens, and verification tokens are single‑use with expiry.
- PII: only what we need (name, email, optional phone/address).

---

## Accessibility & UX
- Colour palette tuned for contrast; focus states on buttons/inputs.
- Touch targets ≥44px where sensible.
- Reduced motion respected; no blocking animations in critical flows.

---

## Project structure

```
client/
  src/
    assets/         # tixigo-lockup.svg, favicon.svg
    components/     # Nav, ProtectedRoute, etc.
    layouts/        # AppLayout (Nav + Footer)
    lib/            # api.js
    pages/          # Explore, Admin, OrganizerDashboard, BecomeOrganiser, ...
server/
  prisma/
    schema.prisma
  src/
    routes/         # auth, events, organizers, admin, staff, orders
    middleware/     # requireAuth, requireRole
    utils/          # mailer.js, stripe.js
```

---

## Operational playbook

### Seeding an organiser
- User registers → Owner sets role to ORGANIZER (or approves their request) → organiser can create events.

### Restoring an event
- `POST /api/events/:id/toggle { isActive: true }` flips a cancelled event back on. No data loss; tickets stay linked.

### Troubleshooting
- 404 on `/owner`: check the React route exists and you’re logged in as OWNER.
- Email not showing brand name: verify `MAIL_FROM_*` and the sending domain with your SMTP provider.
- “No pending organiser profiles” while status shows `pending`: ensure Admin screen calls
  `/api/admin/organizers/pending` (pending comes from `OrganizerRequest`, not `OrganizerProfile`).

---

## What I’d build next
- WebSocket live dashboards during scanning; optimistic updates on admit.
- Payouts and Stripe Connect for organisers.
- Seat maps and reserved seating.
- Background jobs (BullMQ) for mail/retry/refund workflows.
- A small Cypress smoke suite + Vitest unit tests.

---

## Why Tixigo

Tixigo demonstrates how I design a full-stack product with the right level of abstraction:
clean contracts, measured scope, strong defaults, and a codebase you can hand to a team.
If you’re hiring for a product‑minded full‑stack role, this is the kind of thinking and ownership I bring.
