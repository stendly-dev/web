'use client'
import React, {createContext, useCallback, useEffect, useState} from 'react'
import {checkBackendHealth, onHealthChange, startHealthMonitoring, stopHealthMonitoring} from '@/lib/api'

interface HealthContextValue {
    isHealthy: boolean
    lastChecked: Date | null
    error: string | null
    retry: () => Promise<void>
}

const HealthContext = createContext<HealthContextValue | null>(null)

export function HealthProvider({children}: { children: React.ReactNode }) {
    const [isHealthy, setIsHealthy] = useState(true)
    const [lastChecked, setLastChecked] = useState<Date | null>(null)
    const [error, setError] = useState<string | null>(null)

    const checkHealth = useCallback(async () => {
        try {
            const healthy = await checkBackendHealth()
            setIsHealthy(healthy)
            setLastChecked(new Date())
            if (healthy) {
                setError(null)
            } else {
                setError('Cannot connect to Stendly servers. Please check your internet connection.')
            }
        } catch (err) {
            setIsHealthy(false)
            setLastChecked(new Date())
            setError('Network error. Unable to reach Stendly backend.')
        }
    }, [])

    useEffect(() => {
        startHealthMonitoring()

        const unsubscribe = onHealthChange((healthy) => {
            setIsHealthy(healthy)
            if (healthy) {
                setError(null)
            } else if (!error) {
                setError('Connection to Stendly servers lost.')
            }
        })

        return () => {
            unsubscribe()
            stopHealthMonitoring()
        }
    }, [error])

    const retry = useCallback(async () => {
        setError(null)
        await checkHealth()
    }, [checkHealth])

    return (
        <HealthContext.Provider value={{isHealthy, lastChecked, error, retry}}>
            {children}
        </HealthContext.Provider>
    )
}