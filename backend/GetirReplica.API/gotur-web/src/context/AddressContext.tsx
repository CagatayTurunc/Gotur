import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface SavedAddress {
  id: string
  label: string          // "Ev", "İş", "Diğer"
  fullAddress: string    // Nominatim'den gelen okunabilir adres
  lat: number
  lng: number
}

interface AddressContextType {
  selectedAddress: SavedAddress | null
  savedAddresses: SavedAddress[]
  setSelectedAddress: (addr: SavedAddress | null) => void
  addAddress: (addr: Omit<SavedAddress, 'id'>) => void
  removeAddress: (id: string) => void
  isPickerOpen: boolean
  openPicker: () => void
  closePicker: () => void
}

const AddressContext = createContext<AddressContextType | null>(null)

const STORAGE_KEY = 'gotur_addresses'
const SELECTED_KEY = 'gotur_selected_address'

export function AddressProvider({ children }: { children: ReactNode }) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [selectedAddress, setSelectedAddressState] = useState<SavedAddress | null>(() => {
    try {
      const raw = localStorage.getItem(SELECTED_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // localStorage'a yaz
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAddresses))
  }, [savedAddresses])

  useEffect(() => {
    if (selectedAddress) {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedAddress))
    } else {
      localStorage.removeItem(SELECTED_KEY)
    }
  }, [selectedAddress])

  const setSelectedAddress = (addr: SavedAddress | null) => {
    setSelectedAddressState(addr)
  }

  const addAddress = (addr: Omit<SavedAddress, 'id'>) => {
    const newAddr: SavedAddress = { ...addr, id: crypto.randomUUID() }
    setSavedAddresses(prev => [newAddr, ...prev])
    setSelectedAddress(newAddr)
    return newAddr
  }

  const removeAddress = (id: string) => {
    setSavedAddresses(prev => prev.filter(a => a.id !== id))
    if (selectedAddress?.id === id) setSelectedAddress(null)
  }

  const openPicker = () => setIsPickerOpen(true)
  const closePicker = () => setIsPickerOpen(false)

  return (
    <AddressContext.Provider value={{
      selectedAddress, savedAddresses,
      setSelectedAddress, addAddress, removeAddress,
      isPickerOpen, openPicker, closePicker,
    }}>
      {children}
    </AddressContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAddress() {
  const ctx = useContext(AddressContext)
  if (!ctx) throw new Error('useAddress must be used within AddressProvider')
  return ctx
}
