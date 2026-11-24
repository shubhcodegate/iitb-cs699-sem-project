import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

project_root = Path(__file__).resolve().parents[1]
load_dotenv(project_root / "private" / ".env")
# Only the Postgres-backed endpoints (/health/db, /api/users) need this;
# manual events use the local SQLite db, so don't crash the app without it.
database_url = os.environ.get("DATABASE_URL")


def postgres_connection():
    if not database_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")
    return psycopg.connect(database_url, sslmode="require", connect_timeout=5)

sys.path.insert(0, str(project_root / "src"))
import campus_pulse

campus_pulse.init(dict(os.environ))
campus_pulse.init_db(os.environ.get("DATA_DIR", project_root / "data"))

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

def save_user(google_sub: str, display_name: str): 
    with postgres_connection() as db: 
        row = db.execute(
            """
            INSERT INTO private.app_users (google_sub, display_name)
            VALUES (%s, %s)
            ON CONFLICT (google_sub) DO UPDATE
            SET display_name = EXCLUDED.display_name
            RETURNING google_sub, display_name
            """,
            (google_sub, display_name),
        ).fetchone()

    return {"google_sub": row[0], "display_name": row[1]}


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
