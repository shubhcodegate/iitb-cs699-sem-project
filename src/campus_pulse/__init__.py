from . import fetch

_private_data = {}


def init(private_data):
    global _private_data
    _private_data = dict(private_data)


def fetch_emails(folder="INBOX", since_uid=0, limit=None):
    return fetch.fetch_emails(
        _private_data,
        folder=folder,
        since_uid=since_uid,
        limit=limit,
    )
