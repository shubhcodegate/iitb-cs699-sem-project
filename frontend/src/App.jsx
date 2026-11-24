import { useActionState, useEffect, useRef, useState } from 'react'
import CampusMap from './components/CampusMap'
import ManualEventForm from './components/ManualEventForm'
import ManualEventList from './components/ManualEventList'
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

const viewText = {
  dashboard: { label: 'Dashboard', title: 'Your campus, at a glance', description: 'Discover events and make a little more of your campus day.' },
  map: { label: 'Map', title: 'Find your way around', description: 'Explore campus venues and locate your next event.' },
  'add-event': { label: 'Add event', title: 'Add a campus event', description: 'Enter the event details and save them to the event database.' },
}

function viewFromHash() {
  const view = window.location.hash.slice(1)
  return view in viewText ? view : 'dashboard'
}

function App() {
  const [activeView, setActiveView] = useState(viewFromHash)
  const contentRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  // const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState('')
  const [manualEvents, setManualEvents] = useState([])
  const [manualEventStatus, setManualEventStatus] = useState('')
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

  useEffect(() => {
    const syncView = () => setActiveView(viewFromHash())
    window.addEventListener('hashchange', syncView)
    fetch('/api/manual-events')
      .then((response) => (response.ok ? response.json() : []))
      .then(setManualEvents)
      .catch(() => {})
    return () => window.removeEventListener('hashchange', syncView)
  }, [])

  function changeView(view) {
    window.location.hash = view
    setActiveView(view)
    contentRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  async function submitManualEvent(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    values.venue = values.venue_choice === '__other__' ? values.custom_venue.trim() : values.venue_choice
    delete values.venue_choice
    delete values.custom_venue
    setManualEventStatus('Saving event...')

    try {
      const response = await fetch('/api/manual-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Could not save event. Check that the backend is running.')
      const savedEvent = await response.json()
      setManualEvents((currentEvents) => [savedEvent, ...currentEvents])
      form.reset()
      setManualEventStatus('Event saved.')
      return true
    } catch (error) {
      setManualEventStatus(error.message)
      return false
    }
  }

  async function deleteManualEvent(manualEvent) {
    if (!window.confirm(`Delete "${manualEvent.title}"?`)) return

    try {
      const response = await fetch(`/api/manual-events/${manualEvent.id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`)
      setManualEvents((currentEvents) => currentEvents.filter((event) => event.id !== manualEvent.id))
    } catch {
      window.alert('Could not delete event. Check that the backend is running.')
    }
  }

  function showVenue(venue) {
    setSelectedVenue(venue)
    changeView('map')
  }

  async function handleSuccess(credentialResponse) {
    console.log(credentialResponse)
    console.log(jwtDecode(credentialResponse.credential))
    const { sub, name, given_name, email, picture } = jwtDecode(credentialResponse.credential)
    const profile = { sub, name, given_name, email, picture }

    try {
      const response = await fetch('/api/users', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_sub: profile.sub, 
          display_name: profile.name,
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error('Could not save profile:', error.message)
      return
    }

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
          <button type="button" aria-current={activeView === 'add-event' ? 'page' : undefined} onClick={() => changeView('add-event')}><span aria-hidden="true">+</span> Add event</button>
        </nav>
        <div className="sidebar-note">A little closer to campus.<span>Discover events, find your way,<br />and get involved.</span></div>
      </aside>
      <main className="campus-page" ref={contentRef} tabIndex={-1}>
      <div className="workspace-bar"><span>Campus / {viewText[activeView].label}</span>
        {user ? (
          <div className="account-control">
            <button type="button" className="account-trigger" popoverTarget="account-actions" aria-label="Account options">
              <span>Hi, {user.given_name || user.name}</span>
              {user.picture && <img src={user.picture} alt="" width="36" height="36" />}
              <span aria-hidden="true">▾</span>
            </button>
            <div id="account-actions" popover="auto" className="account-actions">
              <button type="button" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        ) : (
          <GoogleLogin onSuccess={handleSuccess} onError={() => console.log('authentication error')} />
        )}
      </div>
      <header className="page-header">
        <h1>{viewText[activeView].title}</h1>
        <p>{viewText[activeView].description}</p>
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
      ) : activeView === 'add-event' ? (
        <ManualEventForm onSubmit={submitManualEvent} status={manualEventStatus} />
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
        <ManualEventList events={manualEvents} venues={venues} onDelete={deleteManualEvent} />
      </section>
      </>
      )}
    </main>
    </div>
  )
}

export default App
