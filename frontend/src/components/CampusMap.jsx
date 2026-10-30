import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './CampusMap.css'

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
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    maxZoom={19}
  />

  {selectedVenue && (
    <CircleMarker
      center={[selectedVenue.latitude, selectedVenue.longitude]}
      radius={10}
      pathOptions={{
        color: '#4338ca',
        fillColor: '#6366f1',
        fillOpacity: 0.9,
      }}
    >
      <Popup>{selectedVenue.name}</Popup>
    </CircleMarker>
  )}

  <MapFocus venue={selectedVenue} />
</MapContainer>
    </section>
  )
}

export default CampusMap
