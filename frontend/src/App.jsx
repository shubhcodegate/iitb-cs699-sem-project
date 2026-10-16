import { events } from './data/events'
import './App.css'

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T00:00:00`))
}

function App() {
  return (
    <main className="campus-page">
      <header className="page-header">
        <h1>Campus Pulse</h1>
        <p>Discover what’s happening around campus.</p>
      </header>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Upcoming events ({events.length})</h2>
        <p className="sample-notice">
          Sample events for demonstration. All times are in IST.
        </p>

        <div className="event-grid">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <span className="event-category">{event.category}</span>

              <h3>{event.title}</h3>
              <p className="event-description">{event.description}</p>

              <dl className="event-meta">
                <div>
                  <dt>Date</dt>
                  <dd>
                    <time dateTime={event.date}>
                      {formatDate(event.date)}
                    </time>
                  </dd>
                </div>

                <div>
                  <dt>Time</dt>
                  <dd>{event.startTime}–{event.endTime}</dd>
                </div>

                <div>
                  <dt>Venue</dt>
                  <dd>{event.venue}</dd>
                </div>

                <div>
                  <dt>Organizer</dt>
                  <dd>{event.organizer}</dd>
                </div>

                <div>
                  <dt>Audience</dt>
                  <dd>{event.audience}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App