import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './marker.css'


//refernce: https://leafletjs.com/reference.html#icon

export const venueIcon = L.divIcon({
  className: 'venue-marker',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="32" height="44" viewBox="0 0 32 44">
      <path
        d="M16 1C7.7 1 1 7.7 1 16c0 11 15 27 15 27s15-16 15-27C31 7.7 24.3 1 16 1Z"
        fill="#FF2800"
        stroke="#FFFFFF"
        stroke-width="2"
      />
      <circle cx="16" cy="16" r="5" fill="#FFFFFF" />
    </svg>
  `,
  iconSize: [32, 44],
  iconAnchor: [16, 43],
  popupAnchor: [0, -40],
})