from . import db, manual_events


def init_db(data_folder=None):
    db.init_db(data_folder)


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
