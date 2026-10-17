import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './CampusMap.css'

//? reference: https://react-leaflet.js.org/docs/start-setup/

const CAMPUS_CENTER = [19.1334, 72.9133] //? sourced from https://www.latlong.net/

function CampusMap() {
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
        aria-label="Interactive map of IIT Bombay"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </MapContainer>
    </section>
  )
}

export default CampusMap
