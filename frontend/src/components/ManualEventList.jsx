function ManualEventList({ events, venues, onDelete }) {
  if (events.length === 0) return null

  return (
    <section className="manual-event-list" aria-labelledby="manual-events-heading">
      <h2 id="manual-events-heading">Manually added events</h2>
      <div className="event-grid">
        {events.map((event) => (
          <article className="event-card" key={event.id}>
            <span className="event-category">Manual</span>
            <h3>{event.title}</h3>
            <dl className="event-meta">
              {event.start_time && (
                <div>
                  <dt>Date</dt>
                  <dd>{event.start_time.replace('T', ' ')}</dd>
                </div>
              )}
              {event.end_time && (
                <div>
                  <dt>Ends</dt>
                  <dd>{event.end_time.replace('T', ' ')}</dd>
                </div>
              )}
              {event.venue && (
                <div>
                  <dt>Venue</dt>
                  <dd>{venues[event.venue]?.name || event.venue}</dd>
                </div>
              )}
              {event.organizer && (
                <div>
                  <dt>Organizer</dt>
                  <dd>{event.organizer}</dd>
                </div>
              )}
            </dl>
            <button
              className="delete-event-button"
              type="button"
              onClick={() => onDelete(event)}
              aria-label={`Delete ${event.title}`}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ManualEventList
