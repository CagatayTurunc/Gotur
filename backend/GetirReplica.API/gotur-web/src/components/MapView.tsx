import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet default icon düzeltmesi
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Cherry cola renkli kurye ikonu
const courierIcon = L.divIcon({
  html: `<div style="
    background: #9a0002;
    width: 36px;
    height: 36px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(154,0,2,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  "><span style="transform: rotate(45deg); font-size: 16px; display: block; text-align:center; line-height:30px;">🛵</span></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
})

// Teslimat noktası ikonu
const destinationIcon = L.divIcon({
  html: `<div style="
    background: #1a1a2e;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid #efe6dd;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 26px;
    text-align: center;
  ">📦</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

interface MarkerMoverProps {
  position: [number, number]
}

// Marker'ı smooth animate eder
function AnimatedCourierMarker({ position }: MarkerMoverProps) {
  const markerRef = useRef<L.Marker>(null)
  const prevPos = useRef<[number, number]>(position)

  useEffect(() => {
    if (!markerRef.current) return
    const marker = markerRef.current
    const [lat, lng] = position
    const [prevLat, prevLng] = prevPos.current

    // Basit interpolasyon
    const steps = 20
    let step = 0
    const interval = setInterval(() => {
      step++
      const t = step / steps
      marker.setLatLng([
        prevLat + (lat - prevLat) * t,
        prevLng + (lng - prevLng) * t,
      ])
      if (step >= steps) {
        clearInterval(interval)
        prevPos.current = position
      }
    }, 50)

    return () => clearInterval(interval)
  }, [position])

  return (
    <Marker ref={markerRef} position={position} icon={courierIcon}>
      <Popup>🛵 Kurye burada</Popup>
    </Marker>
  )
}

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

interface MapViewProps {
  courierLocation: { lat: number; lng: number } | null
  deliveryLocation?: { lat: number; lng: number }
  height?: string
}

export default function MapView({ courierLocation, deliveryLocation, height = '400px' }: MapViewProps) {
  const defaultCenter: [number, number] = courierLocation
    ? [courierLocation.lat, courierLocation.lng]
    : [41.0082, 28.9784] // İstanbul merkezi

  return (
    <div style={{ height, borderRadius: '1rem', overflow: 'hidden' }} className="border border-[#e0d6cc] shadow-sm">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {courierLocation && (
          <>
            <AnimatedCourierMarker position={[courierLocation.lat, courierLocation.lng]} />
            <MapCenter center={[courierLocation.lat, courierLocation.lng]} />
          </>
        )}

        {deliveryLocation && (
          <Marker position={[deliveryLocation.lat, deliveryLocation.lng]} icon={destinationIcon}>
            <Popup>📦 Teslimat noktası</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
