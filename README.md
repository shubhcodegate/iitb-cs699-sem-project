# Campus Pulse - IITB CS699 Semester Project

Semester-long software project for **CS699: Software Lab** at the **Indian Institute of Technology Bombay**.

## Team

- Shubham Kumar [26M2111]
- Banibrata Manna [26M2114]
- Naresh M [26M2119]

## Project Overview

> To build a location-aware campus discovery platform that helps students find relevant academic, club, and community events around them by combining event information from multiple sources, filtering it by time and location, and presenting it through a personalized and accessible interface.

## Objectives

- Build a unified platform for discovering campus events and opportunities.
- Aggregate event information from emails, portals, and manual submissions.
- Extract structured details such as time, venue, organizer, and audience.
- Show nearby and relevant events on an interactive campus map and timeline.
- Personalize results based on user location, time, and event visibility permissions.
- Improve event awareness and participation across the campus community.

## Repository Structure

```text
.
├── src/               # Source code
├── tests/             # Tests
├── docs               # Project documentation
│   ├── design
│   ├── meetings
│   ├── proposal
│   │   └── PITCHDOC.md
│   └── requirements
├── README.md          # Project overview, setup, usage, and documentation
└── CONTRIBUTING.md    # Development workflow and contribution guidelines
```

## Setup

### Prerequisites

- Python 3.10 or newer
- Node.js 20.19+ or 22.12+ (with [nvm](https://github.com/nvm-sh/nvm), run `nvm install 22` and `nvm use 22`)
- A Google account, an IITB LDAP account, and access to the team's Supabase database

### 1. Install dependencies

From the repository root, create and activate a Python virtual environment, then
install the Python and Node packages:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python3 -m pip install -r backend/requirements.txt
npm install
npm --prefix frontend install
```

Activate the virtual environment in every new terminal before running the app.
`npm run dev` starts the backend with `python3`, so without it the backend
can't find its packages.

### 2. Create `private/.env`

All settings live in `private/.env`. The `private/` folder is ignored by git, so
secrets never get committed.

```bash
mkdir -p private
cp .env.example private/.env
```

Then fill in each value:

| Variable | What it's for | How to get it |
|---|---|---|
| `IITB_IMAP_SERVER` | IITB mail server | Keep `imap.iitb.ac.in` |
| `IITB_EMAIL` | Your IITB email, for the extract script | Your `@iitb.ac.in` address |
| `IITB_IMAP_ACCESS_TOKEN` | Mailbox access, for the extract script | [Steps to generate SSO Access Token](./docs/design/Steps-to-generate-SSO-Access-Token.md) |
| `GROQ_API_KEY` | Extracting event details from emails | [Steps to generate Groq API Token](./docs/design/Steps-to-generate-ChatGroq-API-Token.md) |
| `DATABASE_URL` | Postgres for user profiles and mailbox settings | Ask a teammate for the Supabase connection string (see step 4) |
| `MAILBOX_ENCRYPTION_KEY` | Encrypting saved IITB access tokens | Generate one (see step 3) |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in | Create an OAuth client (see step 3) |

The backend won't start if `MAILBOX_ENCRYPTION_KEY` or `VITE_GOOGLE_CLIENT_ID` is
missing.

### 3. Generate keys

**`MAILBOX_ENCRYPTION_KEY`**: run this with the virtual environment active and
paste the output into `private/.env`:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Everyone using the same database must use the same key. Tokens saved with one
key can't be read with another, so get the key from a teammate if the database
already has saved mailboxes.

**`VITE_GOOGLE_CLIENT_ID`**: in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
create an **OAuth client ID** of type **Web application**, and add
`http://localhost:5173` under **Authorized JavaScript origins**. Copy the client
ID (it ends in `.apps.googleusercontent.com`). Teammates can share one client ID.

### 4. Database

**Postgres (Supabase)** stores user profiles and mailbox settings. The team
shares one Supabase database, so ask a teammate for its `DATABASE_URL`.

If you set up your own database instead, create the table the backend expects:

```sql
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_users (
    google_sub            TEXT PRIMARY KEY,
    display_name          TEXT NOT NULL,
    iitb_email            TEXT,
    iitb_token_ciphertext BYTEA
);
```

**SQLite** stores manually added events. It needs no setup: the backend creates
`data/campus_pulse.db` on first start. Set `DATA_DIR` in `private/.env` to keep
it somewhere else.

## Usage

### Run the app

With the virtual environment active, from the repository root:

```bash
npm run dev
```

This starts the backend (FastAPI on port 8000) and the frontend (Vite on port
5173) together. Open http://localhost:5173. Press Ctrl+C to stop both.

To run them separately, use two terminals:

```bash
# Terminal 1: backend
cd backend
PYTHONPATH=../src fastapi dev main.py
```

```bash
# Terminal 2: frontend
cd frontend
npm run dev
```

### First use

1. Sign in with Google.
2. When asked, enter your IITB email and IITB access token. The token is
   stored encrypted.
3. The dashboard checks your recent emails and lists upcoming events.
4. Use **Add event** to add an event by hand.

### Extract events from the command line

To extract events from your own mailbox without the web app, using
`IITB_EMAIL` and `IITB_IMAP_ACCESS_TOKEN` from `private/.env`:

```bash
PYTHONPATH=src python3 -m campus_pulse.extract
```

The script stores results in `data/events.db`.

### Troubleshooting

| Problem | Fix |
|---|---|
| `KeyError: 'MAILBOX_ENCRYPTION_KEY'` or `'VITE_GOOGLE_CLIENT_ID'` | Add the missing value to `private/.env` |
| `ModuleNotFoundError` when the backend starts | Activate the virtual environment, then run `npm run dev` again |
| Vite fails with `does not provide an export named 'styleText'` | Your Node is too old. Run `nvm use 22` |
| "Could not save event. Check that the backend is running." | Start the backend; the frontend sends `/api` requests to port 8000 |
| Google sign-in button errors | Check `VITE_GOOGLE_CLIENT_ID`, and that `http://localhost:5173` is an authorized origin |

## Testing

With the virtual environment active, from the repository root:

```bash
python3 -m unittest discover tests -v
```

The tests cover email parsing, incremental fetching and event extraction. They
don't need network access, API keys or a database.

## Documentation

Project documentation is maintained in the [`docs/`](./docs/) directory.
