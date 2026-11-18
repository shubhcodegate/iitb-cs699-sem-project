import { useActionState, useRef, useState } from 'react'
import CampusMap from './components/CampusMap'
import { events } from './data/events'
import { venues } from './data/venues'
import './App.css'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { jwtDecode } from "jwt-decode"
//icon reference : just unicode icons - no 3rd party library.


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
  const [activeView, setActiveView] = useState('dashboard')
  const contentRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  // const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState('')
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('campusPulse.profile'))
    } catch {
      return null
    }
  })
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredEvents = events.filter((event) => {
    const matchesCategory = !selectedCategory || event.category === selectedCategory
    const searchableText = [event.title, event.description, event.organizer, event.venue]
      .filter(Boolean).join(' ').toLowerCase()
    return matchesCategory && searchTerms.every((term) => searchableText.includes(term))
  })

  function changeView(view) {
    setActiveView(view)
    contentRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function showVenue(venue) {
    setSelectedVenue(venue)
    changeView('map')
  }

  function handleSuccess(credentialResponse) {
    console.log(credentialResponse)
    console.log(jwtDecode(credentialResponse.credential))
    const { sub, name, given_name, email, picture } = jwtDecode(credentialResponse.credential)
    const profile = { sub, name, given_name, email, picture }

    setCredentials(credentialResponse.credential)
    sessionStorage.setItem('campusPulse.profile', JSON.stringify(profile))
    setUser(profile)
  }

  function handleLogout() {
    googleLogout()
    sessionStorage.removeItem('campusPulse.profile')
    setUser(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#dashboard" onClick={() => changeView('dashboard')}>
          <span className="brand-mark" aria-hidden="true">CP</span>
          <span>Campus Pulse<small>IIT BOMBAY</small></span>
        </a>
        <p className="nav-label">EXPLORE</p>
        <nav className="view-navigation" aria-label="Main navigation">
          <button type="button" aria-current={activeView === 'dashboard' ? 'page' : undefined} onClick={() => changeView('dashboard')}><span aria-hidden="true">▦</span> Dashboard</button>
          <button type="button" aria-current={activeView === 'map' ? 'page' : undefined} onClick={() => changeView('map')}><span aria-hidden="true">⌖</span> Campus map</button>
        </nav>
        <div className="sidebar-note">A little closer to campus.<span>Discover events, find your way,<br />and get involved.</span></div>
      </aside>
      <main className="campus-page" ref={contentRef} tabIndex={-1}>
      <div className="workspace-bar"><span>Campus / {activeView === 'dashboard' ? 'Dashboard' : 'Map'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
  {user ? (
    <>
      <span
        style={{
          fontSize: '16px',
          fontWeight: 600,
          lineHeight: 1.4,
          color: '#263e56',
        }}
      >
        Hi, {user.given_name}
      </span>

      <img
        src={user.picture}
        alt={`${user.given_name}'s profile`}
        width={45}
        height={45}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <button
        type="button"
        onClick={handleLogout}
      >
        Sign out
      </button>
    </>
  ) : (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.log('authentication error')}
    />
  )}
</div>
      </div>
      <header className="page-header">
        <h1>{activeView === 'dashboard' ? 'Your campus, at a glance' : 'Find your way around'}</h1>
        <p>{activeView === 'dashboard' ? 'Discover events and make a little more of your campus day.' : 'Explore campus venues and locate your next event.'}</p>
      </header>

      {activeView === 'map' ? (
        <div className="map-layout">
          <CampusMap selectedVenue={selectedVenue} />
          <aside className="venue-panel" aria-labelledby="venues-heading">
            <h2 id="venues-heading">Campus venues</h2>
            <p>Select a venue to locate it on the map.</p>
            <div className="venue-list">{Object.entries(venues).map(([id, venue]) => (
              <button type="button" key={id} aria-pressed={selectedVenue === venue} onClick={() => setSelectedVenue(venue)}>
                <span>{venue.name}</span><span aria-hidden="true">↗</span>
              </button>
            ))}</div>
            {selectedVenue && <p className="selected-venue" role="status">Viewing {selectedVenue.name}</p>}
          </aside>
        </div>
      ) : (
      <>
      <div className="dashboard-summary" aria-label="Event overview">
        <div><span>Events to explore</span><strong>{events.length}</strong><small>In the sample programme</small></div>
        <div><span>Across your interests</span><strong>{categories.length}</strong><small>Event categories</small></div>
        <div className="summary-map"><span>Know where to go</span><p>Get familiar with campus.</p><button type="button" onClick={() => changeView('map')}>Open campus map <span aria-hidden="true">↗</span></button></div>
      </div>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Upcoming events</h2>
        <p className="sample-notice">
          Sample events for demonstration. All times are in IST.
        </p>

        <div className="event-filters">
          <div className="event-search">
            <label htmlFor="event-search">Search events</label>
            <input
              id="event-search"
              type="search"
              placeholder="Search titles, organizers, or venues"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {/* <label htmlFor="category-filter">Category</label> */}
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
          {(searchQuery || selectedCategory) && (
            <button className="clear-filters-button" type="button" onClick={() => {
              setSearchQuery('')
              setSelectedCategory('')
            }}>Clear filters</button>
          )}
          <p role="status">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>

        {filteredEvents.length === 0 && (
          <p className="search-empty-state">No events found. Try a different search or category, or clear your filters.</p>
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
                onClick={() => showVenue(venues[event.venueId])}
              >
                Show on map
              </button>
            </article>
          ))}
        </div>
      </section>
      </>
      )}
    </main>
    </div>
  )
}

export default App
