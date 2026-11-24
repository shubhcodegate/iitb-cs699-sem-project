import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root / "src"))

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
import json
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from cryptography.fernet import Fernet
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from pydantic import EmailStr, SecretStr

import campus_pulse
from campus_pulse.extract import extract_event
from campus_pulse.fetch import connect, fetch_new_emails

from datetime import datetime
from zoneinfo import ZoneInfo

load_dotenv(project_root / "private" / ".env")
# Only the Postgres-backed endpoints (users, mailbox, upcoming events) need this;
# manual events use the local SQLite db, so they work without it.
database_url = os.environ.get("DATABASE_URL")


def postgres_connection():
    if not database_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")
    return psycopg.connect(database_url, sslmode="require", connect_timeout=5)

campus_pulse.init_db(os.environ.get("DATA_DIR", project_root / "data"))

mailbox_cipher = Fernet(os.environ["MAILBOX_ENCRYPTION_KEY"].encode())
google_client_id = os.environ["VITE_GOOGLE_CLIENT_ID"]

app = FastAPI(title="Campus Pulse API")

class UserProfile(BaseModel):
    google_sub: str
    display_name: str

class ManualEvent(BaseModel):
    title: str
    start_time: str | None = None
    end_time: str | None = None
    venue: str | None = None
    organizer: str | None = None

def save_user(google_sub: str, display_name: str): 
    with postgres_connection() as db: 
        row = db.execute(
            """
            INSERT INTO private.app_users (google_sub, display_name)
            VALUES (%s, %s)
            ON CONFLICT (google_sub) DO UPDATE
            SET display_name = EXCLUDED.display_name
            RETURNING google_sub, display_name,
            (iitb_email IS NOT NULL AND iitb_token_ciphertext IS NOT NULL)
            """,
            (google_sub, display_name),
        ).fetchone()

    return {
        "google_sub": row[0],
        "display_name": row[1],
        "mailbox_configured": row[2],
    }

def load_mailbox_credentials(google_sub: str) -> tuple[str, str] | None:
    with postgres_connection() as db:
        row = db.execute(
            """
            SELECT iitb_email, iitb_token_ciphertext
            FROM private.app_users
            WHERE google_sub = %s
            """,
            (google_sub,),
        ).fetchone()

    if row is None:
        return None

    email, encrypted_token = row
    if not email or not encrypted_token:
        return None

    token = mailbox_cipher.decrypt(encrypted_token).decode("utf-8")
    return email, token

def fetch_recent_mail(google_sub: str, limit: int = 15) -> list[dict] | None:
    credentials = load_mailbox_credentials(google_sub)
    if credentials is None:
        return None

    email_address, access_token = credentials
    with connect(email_address, access_token) as mail:
        _, emails = fetch_new_emails(mail, limit=limit, newest_first=True)

    return emails

def stream_upcoming_events(google_sub: str):
    def line(status, **fields):
        return json.dumps({"status": status, **fields}) + "\n"

    yield line("fetching")

    try:
        emails = fetch_recent_mail(google_sub)
        if emails is None:
            yield line("mailbox_required")
            return

        total = len(emails)
        events = []
        yield line("progress", processed=0, total=total)

        for processed, mail in enumerate(emails, start=1):
            event = extract_event(mail)
            if event and event.get("title"):
                events.append(event)

            yield line("progress", processed=processed, total=total)

        yield line("ready", events=filter_upcoming_events(events))

    except Exception as exc:
        print("Event extraction failed:", type(exc).__name__, flush=True)
        yield line("error")

def filter_upcoming_events(events: list[dict]) -> list[dict]:
    ist = ZoneInfo("Asia/Kolkata")
    now = datetime.now(ist)
    upcoming = []

    for event in events:
        raw_start = event.get("start_time")
        if not isinstance(raw_start, str):
            continue

        # The extractor can return a date without a known time.
        raw_start = raw_start.strip()
        if len(raw_start) <= 10:
            continue

        try:
            start = datetime.fromisoformat(raw_start)
        except ValueError:
            continue

        if start.tzinfo is None:
            start = start.replace(tzinfo=ist)
        else:
            start = start.astimezone(ist)

        if start > now:
            calendar_end = None
            raw_end = event.get("end_time")

            if isinstance(raw_end, str) and len(raw_end.strip()) > 10:
                try:
                    end = datetime.fromisoformat(raw_end.strip())
                    if end.tzinfo is None:
                        end = end.replace(tzinfo=ist)
                    if end > start:
                        calendar_end = end.isoformat()
                except ValueError:
                    pass

            upcoming.append((start, {
                **event,
                "calendar_start": start.isoformat(),
                "calendar_end": calendar_end,
            }))

    upcoming.sort(key=lambda item: item[0])
    return [event for _, event in upcoming]


@app.get("/health")
def health_check():
    return {"status": "OK"}

@app.get("/health/db")
def database_health():
    try:
        with postgres_connection() as db:
            db.execute("SELECT 1").fetchone()
    except psycopg.OperationalError:
        raise HTTPException(status_code=503, detail="Database connection failed")

    return {"database": "connected"}

@app.post("/api/users")
def save_profile(profile: UserProfile):
    return save_user(profile.google_sub, profile.display_name)

@app.get("/api/manual-events")
def list_manual_events():
    return campus_pulse.list_manual_events()

@app.post("/api/manual-events")
def add_manual_event(event: ManualEvent):
    try:
        return campus_pulse.add_manual_event(**event.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))

@app.delete("/api/manual-events/{event_id}", status_code=204)
def delete_manual_event(event_id: int):
    if not campus_pulse.delete_manual_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

class MailboxSetup(BaseModel): 
    google_credential: SecretStr
    iitb_email: EmailStr
    access_token: SecretStr

@app.post("/api/mailbox")
def save_mailbox(form: MailboxSetup):
    try:
        account = id_token.verify_oauth2_token(
            form.google_credential.get_secret_value(),
            GoogleRequest(),
            google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Please sign in again")

    token = form.access_token.get_secret_value().strip()
    if not token:
        raise HTTPException(status_code=400, detail="Enter your IITB access token")

    encrypted_token = mailbox_cipher.encrypt(token.encode())

    with postgres_connection() as db:
        row = db.execute(
            """
            UPDATE private.app_users
            SET iitb_email = %s, iitb_token_ciphertext = %s
            WHERE google_sub = %s
            RETURNING google_sub
            """,
            (str(form.iitb_email), encrypted_token, account["sub"]),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Save the user profile first")

    return {"mailbox_configured": True}

@app.get("/api/events/upcoming")
def get_upcoming_events(authorization: str = Header(default="")):
    scheme, _, credential = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credential:
        raise HTTPException(status_code=401, detail="Please sign in")

    try:
        account = id_token.verify_oauth2_token(
            credential, GoogleRequest(), google_client_id
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Please sign in again")

    return StreamingResponse(
        stream_upcoming_events(account["sub"]),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )
