from . import db

COLUMNS = "id, title, start_time, end_time, venue, organizer"


def _clean(value):
    """Strip text fields; treat empty strings as missing."""
    value = (value or "").strip()
    return value or None


def list_manual_events():
    with db.connection() as connection:
        rows = connection.execute(
            f"SELECT {COLUMNS} FROM manual_events ORDER BY id DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def add_manual_event(*, title, start_time=None, end_time=None, venue=None, organizer=None):
    """Save a manual event and return it. Raises ValueError if title is blank."""
    title = _clean(title)
    if title is None:
        raise ValueError("Event title is required")

    values = (title, _clean(start_time), _clean(end_time), _clean(venue), _clean(organizer))
    with db.connection() as connection:
        row = connection.execute(
            f"""
            INSERT INTO manual_events (title, start_time, end_time, venue, organizer)
            VALUES (?, ?, ?, ?, ?)
            RETURNING {COLUMNS}
            """,
            values,
        ).fetchone()
    return dict(row)


def delete_manual_event(event_id):
    """Delete a manual event. Returns False if no event has that id."""
    with db.connection() as connection:
        cursor = connection.execute(
            "DELETE FROM manual_events WHERE id = ?", (event_id,)
        )
    return cursor.rowcount > 0
