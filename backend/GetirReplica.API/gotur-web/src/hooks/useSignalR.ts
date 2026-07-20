import { useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import type { LocationUpdatedEvent, OrderStatusChangedEvent } from '../types'

interface UseSignalROptions {
  orderId: string
  enabled?: boolean
}

interface SignalRState {
  courierLocation: { lat: number; lng: number } | null
  orderStatus: string | null
  isConnected: boolean
  locationTimeout: boolean
}

export function useSignalR({ orderId, enabled = true }: UseSignalROptions): SignalRState {
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const [state, setState] = useState<SignalRState>({
    courierLocation: null,
    orderStatus: null,
    isConnected: false,
    locationTimeout: false,
  })

  useEffect(() => {
    if (!enabled || !orderId) return

    const token = localStorage.getItem('token') ?? ''

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/tracking', {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connection.on('LocationUpdated', (data: LocationUpdatedEvent) => {
      setState((prev) => ({
        ...prev,
        courierLocation: { lat: data.latitude, lng: data.longitude },
        locationTimeout: false,
      }))
    })

    connection.on('OrderStatusChanged', (data: OrderStatusChangedEvent) => {
      setState((prev) => ({ ...prev, orderStatus: data.status }))
    })

    connection.on('CourierAssigned', () => {
      setState((prev) => ({ ...prev, orderStatus: 'Assigned' }))
    })

    connection.on('LocationTimeout', () => {
      setState((prev) => ({ ...prev, locationTimeout: true }))
    })

    connection
      .start()
      .then(() => {
        setState((prev) => ({ ...prev, isConnected: true }))
        connection.invoke('JoinOrderGroup', orderId)
      })
      .catch((err) => console.error('SignalR bağlantı hatası:', err))

    connectionRef.current = connection

    return () => {
      connection.invoke('LeaveOrderGroup', orderId).catch(() => {})
      connection.stop()
    }
  }, [orderId, enabled])

  return state
}
