from . import db, fetch, manual_events

_private_data = {}


def init(private_data):
    global _private_data
    _private_data = dict(private_data)


def init_db(data_folder=None):
    db.init_db(data_folder)


def fetch_emails(folder="INBOX", since_uid=0, limit=None):
    return fetch.fetch_emails(
        _private_data,
        folder=folder,
        since_uid=since_uid,
        limit=limit,
    )


def list_manual_events():
    return manual_events.list_manual_events()


def add_manual_event(*, title, start_time=None, end_time=None, venue=None, organizer=None):
    return manual_events.add_manual_event(
        title=title,
        start_time=start_time,
        end_time=end_time,
        venue=venue,
        organizer=organizer,
    )


def delete_manual_event(event_id):
    return manual_events.delete_manual_event(event_id)
