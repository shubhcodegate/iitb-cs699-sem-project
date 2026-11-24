import { useState } from 'react'
import { venues } from '../data/venues'

function ManualEventForm({ onSubmit, status }) {
  const [venueChoice, setVenueChoice] = useState('')
  const [customVenue, setCustomVenue] = useState('')

  async function handleSubmit(event) {
    const saved = await onSubmit(event)
    if (saved) {
      setVenueChoice('')
      setCustomVenue('')
    }
  }

  return (
    <section className="manual-event-section" aria-labelledby="manual-event-heading">
      <h2 id="manual-event-heading">Event details</h2>
      <form className="manual-event-form" onSubmit={handleSubmit}>
        <label htmlFor="manual-title">Title</label>
        <input id="manual-title" name="title" maxLength="200" required />
        <label htmlFor="manual-start-time">Date and time</label>
        <input id="manual-start-time" name="start_time" type="datetime-local" />
        <label htmlFor="manual-end-time">End date and time</label>
        <input id="manual-end-time" name="end_time" type="datetime-local" />
        <label htmlFor="manual-venue">Venue</label>
        <select
          id="manual-venue"
          name="venue_choice"
          value={venueChoice}
          onChange={(event) => setVenueChoice(event.target.value)}
        >
          <option value="">Select a venue</option>
          {Object.entries(venues)
            .sort(([, first], [, second]) => first.name.localeCompare(second.name))
            .map(([key, venue]) => (
              <option key={key} value={key}>
                {venue.name}
              </option>
            ))}
          <option value="__other__">Other (enter manually)</option>
        </select>
        {venueChoice === '__other__' && (
          <>
            <label htmlFor="manual-custom-venue">Enter venue</label>
            <input
              id="manual-custom-venue"
              name="custom_venue"
              maxLength="200"
              value={customVenue}
              onChange={(event) => setCustomVenue(event.target.value)}
              required
            />
          </>
        )}
        <label htmlFor="manual-organizer">Organizer</label>
        <input id="manual-organizer" name="organizer" maxLength="200" />
        <button type="submit">Save event</button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </form>
    </section>
  )
}

export default ManualEventForm
