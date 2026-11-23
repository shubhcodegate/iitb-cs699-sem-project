import json
import os
import sqlite3
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from campus_pulse.fetch import connect, fetch_new_emails

AUDIENCES = ["Public", "Institute-wide", "Department-specific", "Club-specific", "Personal"]

SYSTEM_PROMPT = f"""Extract title, venue, start_time, end_time, organizer and category
from the email below. Category must be exactly one of: {", ".join(AUDIENCES)}. If a field is not available, use null.

Return start_time and end_time in ISO 8601 format (YYYY-MM-DD HH:MM). If only a date is available, include the date without inventing a time.
If the email contains a date and time together, extract both correctly. Return only valid JSON with these keys:
title, venue, start_time, end_time, organizer, category.If the email does not announce an event, return null."""

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
EVENTS_DB = DATA_DIR / "events.db"


def parse_json(text):
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        data = json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        return None

    if not isinstance(data, dict):
        return None

    keys = ["title", "venue", "start_time", "end_time", "organizer", "category"]
    data = {key: data.get(key) for key in keys}
    if data["category"] not in AUDIENCES:
        data["category"] = None

    return data


def extract_event(mail_data):
    text = (
        f"Subject: {mail_data['subject']}\n"
        f"From: {mail_data['sender']}\n"
        f"Date: {mail_data['date']}\n\n"
        f"{mail_data['body'][:5000]}"
    )

    model = ChatGroq(model="openai/gpt-oss-20b", temperature=0)
    reply = model.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=text),
    ])
    return parse_json(reply.content)


def create_database(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id    INTEGER PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name  TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            message_id  TEXT NOT NULL,
            imap_uid    INTEGER,
            imap_folder TEXT DEFAULT 'INBOX',
            title       TEXT NOT NULL,
            start_time  TEXT,
            end_time    TEXT,
            venue       TEXT,
            organizer   TEXT,
            category    TEXT,
            links       TEXT,
            recipients  TEXT,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, message_id)
        );
    """)
    conn.commit()


def save_events(conn, user_id, emails):
    inserted = 0

    query = """
        INSERT OR IGNORE INTO events (
            user_id, message_id, imap_uid, imap_folder,
            title, start_time, end_time, venue, organizer,
            category, links, recipients
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    for mail_data in emails:
        event = extract_event(mail_data)
        if not event or not event["title"]:
            print(f"Could not extract event: {mail_data['subject']}")
            continue

        values = (
            user_id,
            mail_data["message_id"],
            mail_data["imap_uid"],
            mail_data["imap_folder"],
            event["title"],
            event["start_time"],
            event["end_time"],
            event["venue"],
            event["organizer"],
            event["category"],
            json.dumps(mail_data["links"]),
            json.dumps(mail_data["recipients"]),
        )
        cursor = conn.execute(query, values)

        if cursor.rowcount:
            inserted += 1
            print(f"Added: {event['title']}")
        else:
            print(f"Skipped duplicate: {event['title']}")

    conn.commit()
    return inserted


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(EVENTS_DB)
    conn.execute("PRAGMA foreign_keys = ON")
    create_database(conn)

    mail = connect()
    try:
        uidvalidity, emails = fetch_new_emails(mail, folder="INBOX", since_uid=0)
    finally:
        mail.logout()

    emails = emails[-100:]       # Latest 100 emails
    print(f"Fetched {len(emails)} emails")
    print(f"UIDVALIDITY: {uidvalidity}")

    email_address = os.environ["IITB_EMAIL"]
    conn.execute("INSERT OR IGNORE INTO users (email) VALUES (?)", (email_address,))
    user_id = conn.execute(
        "SELECT id FROM users WHERE email = ?", (email_address,)
    ).fetchone()[0]
    inserted = save_events(conn, user_id, emails)

    print(f"\n{inserted} new events added to the database.")
    conn.close()


if __name__ == "__main__":
    main()
