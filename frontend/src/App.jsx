import { useState } from 'react'
import CampusMap from './components/CampusMap'
import { events } from './data/events'
import { venues } from './data/venues'
import './App.css'

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T00:00:00`))
}

const categories = [...new Set(events.map((event) => event.category))].sort()

function App() {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedVenue, setSelectedVenue] = useState(null)

  const filteredEvents = events.filter(
    (event) => selectedCategory === '' || event.category === selectedCategory,
  )

  return (
    <main className="campus-page">
      <header className="page-header">
        <h1>Campus Pulse</h1>
        <p>Discover what’s happening around campus.</p>
      </header>

      <CampusMap selectedVenue={selectedVenue} />

      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Upcoming events</h2>
        <p className="sample-notice">
          Sample events for demonstration. All times are in IST.
        </p>

        <div className="event-filters">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <p role="status">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>

        {filteredEvents.length === 0 && (
          <p>No events found. Try another category.</p>
        )}

        <div className="event-grid">
          {filteredEvents.map((event) => (
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
              <button
                className="show-on-map-button"
                type="button"
                disabled={!venues[event.venueId]}
                onClick={() => setSelectedVenue(venues[event.venueId])}
              >
                Show on map
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
