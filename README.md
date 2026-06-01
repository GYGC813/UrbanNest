# UrbanNest

UrbanNest is a Java-backed full-stack web app for a student PG and part-time job finder platform.

## Stack

- Backend: Java 25, dependency-free HTTP API using the JDK built-in server
- Frontend: separate responsive HTML pages served by the Java backend
- Data: server-side persisted data file for users, PG listings, jobs, notifications, referrals, and applications
- Live updates: frontend pages poll the backend every few seconds, so new PGs/jobs appear without manual refresh

## Run

From this folder:

```powershell
.\run.ps1
```

Then open:

```text
http://localhost:8091
```

If port `8091` is busy, pass another port:

```powershell
.\run.ps1 8081
```

Demo login password for all roles:

```text
demo123
```

Demo emails:

- `student@urbannest.test`
- `owner@urbannest.test`
- `recruiter@urbannest.test`
- `admin@urbannest.test`

## Included Features

- Role-based registration and login for students, PG owners, recruiters, and admins
- Separate pages for home, auth, explore, student dashboard, PG owner dashboard, recruiter dashboard, admin dashboard, and resume builder
- Student dashboard with saved/recommended PGs and jobs
- PG and job listing cards with filters, map links, applications, and contact actions
- PG owner listing creation and statistics
- Recruiter job creation and applicant metrics
- Admin analytics and moderation surface
- AI-style recommendation panel
- Resume builder with live preview and print-to-PDF action
- Referral code flow and reward points
- Real-time-style notification feed
- Responsive dark/light UI with glass panels, startup-style visuals, and mobile layouts

## Host Live

The project includes a `Dockerfile` and `render.yaml` so it can be deployed as one web service on Render.

1. Push this `urbannest` folder to GitHub.
2. Create a new Render web service from the repo.
3. Render will build the Docker image and expose the Java server.
4. Share the Render URL on LinkedIn.

For a real production app with many users, replace the local server data file with PostgreSQL, Supabase, Neon, or another cloud database.


# UrbanNest

UrbanNest is a full-stack web application that helps students find PG accommodations and nearby part-time jobs.

## Features
- Student Dashboard
- PG Owner Dashboard
- Recruiter Dashboard
- Admin Dashboard
- PG Listing Management
- Job Posting System
- Responsive UI

## Tech Stack
- HTML
- CSS
- JavaScript
- Java Backend
- Docker
- Render

## Live Demo
https://urbannest-ryhq.onrender.com
