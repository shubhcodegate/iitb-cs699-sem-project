import { useCallback, useEffect, useRef, useState } from 'react'
import CampusMap from './components/CampusMap'
import { venues } from './data/venues'
import './App.css'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { jwtDecode } from "jwt-decode"
//icon reference : just unicode icons - no 3rd party library.


const sessionKey = 'campusPulse.session'

function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey))
    if (session?.profile && jwtDecode(session.credential).exp * 1000 > Date.now()) {
      return session
    }
  } catch {
    // A malformed saved session requires a fresh sign-in.
  }
  return null
}

function googleCalendarUrl(event) {
  const start = new Date(event.calendar_start)
  const end = event.calendar_end
    ? new Date(event.calendar_end)
    : new Date(start.getTime() + 60 * 60 * 1000)

  function calendarTimestamp(date) {
    return date.toISOString()
      .replaceAll('-', '')
      .replaceAll(':', '')
      .replace(/\.\d{3}Z$/, 'Z')
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${calendarTimestamp(start)}/${calendarTimestamp(end)}`,
    stz: 'Asia/Kolkata',
    etz: 'Asia/Kolkata',
  })

  if (event.venue) params.set('location', event.venue)
  if (event.organizer) params.set('details', `Organized by ${event.organizer}`)

  return `https://calendar.google.com/calendar/r/eventedit?${params}`
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const contentRef = useRef(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedVenue, setSelectedVenue] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [session, setSession] = useState(restoreSession)
  const credentials = session?.credential
  const user = session?.profile
  const [savingMailbox, setSavingMailbox] = useState(false)
  const [mailboxError, setMailboxError] = useState('')
  const mailboxDialogRef = useRef(null)

  const [events, setEvents] = useState([])
  const [eventsStatus, setEventsStatus] = useState('idle')
  const [progress, setProgress] = useState(null)
  const eventsRequest = useRef(null)

  const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort()


  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredEvents = events.filter((event) => {
    const matchesCategory = !selectedCategory || event.category === selectedCategory
    const searchableText = [event.title, event.organizer, event.venue]
      .filter(Boolean).join(' ').toLowerCase()
    return matchesCategory && searchTerms.every((term) => searchableText.includes(term))
  })

  function changeView(view) {
    setActiveView(view)
    contentRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleLogout = useCallback(() => {
    eventsRequest.current?.abort()
    mailboxDialogRef.current?.querySelector('form')?.reset()
    mailboxDialogRef.current?.close()
    setMailboxError('')
    setEvents([])
    setEventsStatus('idle')
    setSelectedCategory('')
    setSearchQuery('')
    googleLogout()
    sessionStorage.removeItem(sessionKey)
    setSession(null)
  }, [])

  const loadUpcomingEvents = useCallback(async (credential) => {
    eventsRequest.current?.abort()
    const controller = new AbortController()
    eventsRequest.current = controller
    setEvents([])
    setProgress(null)
    setEventsStatus('loading')

    try {
      const response = await fetch('/api/events/upcoming', {
        headers: { Authorization: `Bearer ${credential}` },
        signal: controller.signal,
      })

      if (response.status === 401) {
        if (!controller.signal.aborted) handleLogout()
        return
      }
      if (!response.ok) throw new Error('Could not load events')

      if (!response.body) throw new Error('Missing response stream')

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (controller.signal.aborted) return
          if (done) throw new Error('Stream ended before events were ready')

          buffer += value
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (!line.trim()) continue
            const update = JSON.parse(line)

            switch (update.status) {
              case 'fetching':
                break

              case 'progress':
                setProgress({ processed: update.processed, total: update.total })
                break

              case 'mailbox_required':
                setEventsStatus('idle')
                mailboxDialogRef.current?.showModal()
                return

              case 'ready':
                setEvents(update.events)
                setEventsStatus('ready')
                return

              case 'error':
                throw new Error('Email extraction failed')
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch {
      if (!controller.signal.aborted) setEventsStatus('error')
    }
  }, [handleLogout])

  useEffect(() => {
    sessionStorage.removeItem('campusPulse.profile')
    if (!credentials) {
      sessionStorage.removeItem(sessionKey)
      return
    }
    // Defer the request so StrictMode cleanup can cancel a duplicate initial load.
    const timer = setTimeout(() => loadUpcomingEvents(credentials), 0)
    return () => {
      clearTimeout(timer)
      eventsRequest.current?.abort()
    }
  }, [credentials, loadUpcomingEvents])

  async function handleSuccess(credentialResponse) {
    // console.log(credentialResponse)
    // console.log(jwtDecode(credentialResponse.credential))
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

      const signedIn = { credential: credentialResponse.credential, profile }
      sessionStorage.setItem(sessionKey, JSON.stringify(signedIn))
      setSession(signedIn)
    } catch (error) {
      console.error('Could not save profile:', error.message)
      return
    }

  }

  async function submitMailbox(event) {
    event.preventDefault()
    if (savingMailbox) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setSavingMailbox(true)
    setMailboxError('')
    try {
      const response = await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_credential: credentials,
          iitb_email: fields.get('iitb_email'),
          access_token: fields.get('access_token'),
        }),
      })
      if (response.status === 401) {
        handleLogout()
        return
      }
      if (!response.ok) throw new Error('Save failed')
      form.reset()
      mailboxDialogRef.current.close()
      void loadUpcomingEvents(credentials)
    } catch {
      setMailboxError('Could not save your mailbox details. Please try again.')
    } finally {
      setSavingMailbox(false)
    }
  }

  return (
    <div className="app-shell">
      <dialog ref={mailboxDialogRef} className="mailbox-dialog" aria-labelledby="mailbox-title"
        onCancel={(event) => event.preventDefault()}>
        <h2 id="mailbox-title">Connect your IITB email</h2>
        <p>Enter your institute email and IITB access token to set up your mailbox.</p>
        <form onSubmit={submitMailbox}>
          <label>Institute email
            <input type="email" name="iitb_email" autoComplete="email" required />
          </label>
          <label>IITB access token
            <input type="password" name="access_token" autoComplete="off" required />
          </label>
          {mailboxError && <p role="alert">{mailboxError}</p>}
          <button type="submit" disabled={savingMailbox}>{savingMailbox ? 'Saving…' : 'Submit'}</button>
        </form>
      </dialog>
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
        {user && credentials ? (
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
      ) : !user || !credentials ? (
        <p>Sign in with Google to load your upcoming events.</p>
      ) : eventsStatus === 'loading' ? (
       <div className="event-loading">
          <label htmlFor="event-progress">
            {progress ? 'Checking emails for upcoming events' : 'Reading your IITB inbox…'}
          </label>

          {progress?.total > 0 ? (
            <>
              <progress
                id="event-progress"
                value={progress.processed}
                max={progress.total}
                aria-valuetext={`${progress.processed} of ${progress.total} emails checked`}
              />
              <span>Checked {progress.processed} of {progress.total} emails</span>
            </>
          ) : (
            <progress id="event-progress" />
          )}
        </div>
      ) : eventsStatus === 'error' ? (
        <div>
          <p role="alert">Couldn’t load your events.</p>
          <button type="button" onClick={() => loadUpcomingEvents(credentials)}>Try again</button>
        </div>
      ) : eventsStatus === 'idle' ? (
        <p>Connect your IITB mailbox to load events.</p>
      ) : events.length === 0 ? (
        <p>No upcoming events found in your recent mail.</p>
      ) : (
      <>
      <div className="dashboard-summary" aria-label="Event overview">
        <div><span>Events to explore</span><strong>{events.length}</strong><small>From your recent IITB mail</small></div>
        <div><span>Across your interests</span><strong>{categories.length}</strong><small>Event categories</small></div>
        <div className="summary-map"><span>Know where to go</span><p>Get familiar with campus.</p><button type="button" onClick={() => changeView('map')}>Open campus map <span aria-hidden="true">↗</span></button></div>
      </div>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading">Upcoming events</h2>
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
            <article className="event-card" key={JSON.stringify([event.title, event.start_time, event.venue, event.organizer])}>
              {event.category && <span className="event-category">{event.category}</span>}
              <h3>{event.title}</h3>

              <dl className="event-meta">
                <div>
                  <dt>Starts</dt>
                  <dd>{event.start_time}</dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>{event.venue || 'Unspecified'}</dd>
                </div>
                <div>
                  <dt>Organizer</dt>
                  <dd>{event.organizer || 'Unspecified'}</dd>
                </div>
              </dl>
              {event.calendar_start && (
                <a
                  className="calendar-link"
                  href={googleCalendarUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Add to Google Calendar
                </a>
              )}
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
