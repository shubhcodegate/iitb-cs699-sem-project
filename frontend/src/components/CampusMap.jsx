import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './CampusMap.css'

import { venueIcon } from './map/marker'

//? reference: https://react-leaflet.js.org/docs/start-setup/

const CAMPUS_CENTER = [19.1334, 72.9133] //? sourced from https://www.latlong.net/


function MapFocus({ venue }) {
  const map = useMap()

  useEffect(() => {
    if (!venue) return

    map.flyTo(
      [venue.latitude, venue.longitude],
      18,
      { duration: 1 },
    )
  }, [map, venue])

  return null
}


function CampusMap({ selectedVenue }) {
  return (
    <section className="campus-map-section" aria-labelledby="map-heading">
      <h2 id="map-heading">Explore campus</h2>
      <p className="map-description">
        Drag to explore IIT Bombay and use the + and − buttons to zoom.
        Event locations will appear here once venues are added.
      </p>
      <MapContainer
  className="campus-map"
  center={CAMPUS_CENTER}
  zoom={16}
  scrollWheelZoom={false}
>
  <TileLayer
  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  maxZoom={20}
/>

  {selectedVenue && (
      <Marker
        position={[selectedVenue.latitude, selectedVenue.longitude]}
        icon={venueIcon}
      >
        <Popup>{selectedVenue.name}</Popup>
      </Marker>
    )}

  <MapFocus venue={selectedVenue} />
</MapContainer>
    </section>
  )
}

export default CampusMap
