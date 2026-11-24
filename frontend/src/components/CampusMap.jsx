
import 'leaflet/dist/leaflet.css'
import './CampusMap.css'
import { venueIcon } from './map/marker'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'

const CAMPUS_CENTER = [19.1334, 72.9133]

function MapFocus({ venue }) {
  const map = useMap()

  useEffect(() => {
    if (!venue) return

    map.flyTo(
      [venue.latitude, venue.longitude],
      18,
      { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1 },
    )
  }, [map, venue])

  return null
}

function CurrentLocation({ selectedVenue, onStatusChange }) {
  const map = useMap()
  const [position, setPosition] = useState(null)
  const firstPosition = useRef(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      onStatusChange('Location is unavailable in this browser.')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude])
        onStatusChange('')
      },
      (error) => {
        setPosition(null)
        onStatusChange(
          error.code === 1
            ? 'Allow location access in your browser to see your position.'
            : 'Your current location is unavailable.'
        )
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [onStatusChange])

  useEffect(() => {
    if (!position || !firstPosition.current) return

    firstPosition.current = false
    if (!selectedVenue) {
      map.setView(position, 16)
    }
  }, [map, position, selectedVenue])

  return (
    <>
      {position && (
        <CircleMarker
          center={position}
          radius={8}
          pathOptions={{ color: 'white', weight: 3, fillColor: '#1976d2', fillOpacity: 1 }}
        >
          <Popup>Your current location</Popup>
        </CircleMarker>
      )}
      <button
        type="button"
        className="my-location-button"
        disabled={!position}
        onClick={(event) => {
          event.stopPropagation()
          map.stop().setView(position, 17, { animate: false })
        }}
      >
        My location
      </button>
    </>
  )
}

function CampusMap({ selectedVenue }) {

  const [locationStatus, setLocationStatus] = useState('Locating you…')


  return (
    <section className="campus-map-section" aria-labelledby="map-heading">
      <h2 id="map-heading">Explore campus</h2>
      <p className="map-description">
        Drag to explore IIT Bombay and use the + and − buttons to zoom.
        Select a campus venue or use “Show on map” from the dashboard.
      </p>

      {locationStatus && <p role="status">{locationStatus}</p>}
      <MapContainer className="campus-map" center={CAMPUS_CENTER} zoom={16} scrollWheelZoom={false}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles courtesy of <a href="https://www.openstreetmap.cat" target="_blank">Breton OpenStreetMap Team</a>'
          maxZoom={19}
        />

        {selectedVenue && (
          <Marker position={[selectedVenue.latitude, selectedVenue.longitude]} icon={venueIcon}>
            <Popup>{selectedVenue.name}</Popup>
          </Marker>
        )}

        <MapFocus venue={selectedVenue} />
        <CurrentLocation
            selectedVenue={selectedVenue}
            onStatusChange={setLocationStatus}
          />
      </MapContainer>
    </section>
  )
}

export default CampusMap
