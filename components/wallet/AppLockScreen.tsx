'use client'

import React, {useState} from 'react'
import PinInput from './PinInput'
import {verifyPinAsync} from '@/lib/wallet'
import {AlertTriangle} from "lucide-react";

interface AppLockScreenProps {
    onUnlock: () => void
    onReset: () => void
}

export default function AppLockScreen({onUnlock, onReset}: AppLockScreenProps) {
    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [isKeyError, setIsKeyError] = useState(false)

    const handleSubmit = async (code: string) => {
        if (code.length !== 6) return
        setLoading(true)
        setError(null)
        setIsKeyError(false)
        try {
            await verifyPinAsync(code)
            onUnlock()
        } catch (err: any) {
            const msg = err.message || 'Invalid PIN'
            setError(msg)
            if (msg.toLowerCase().includes('wallet') || msg.toLowerCase().includes('key') || msg.toLowerCase().includes('mac') || msg.toLowerCase().includes('locked')) {
                setIsKeyError(true)
            }
            setPin(['', '', '', '', '', ''])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6"
             style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center justify-center mb-4">
                <AlertTriangle size={32} color="var(--text-primary)"/>
            </div>
            <h2 className="text-xl font-bold mb-8" style={{color: 'var(--text-primary)'}}>Enter PIN</h2>

            <PinInput value={pin} onChange={setPin} onComplete={handleSubmit} error={error} disabled={loading}/>

            {error && <p className="text-xs text-center mt-4" style={{color: 'var(--accent-red)'}}>{error}</p>}

            {isKeyError && (
                <button onClick={onReset} className="mt-6 text-sm font-medium transition-opacity active:opacity-70"
                        style={{color: 'var(--accent-red)'}}>
                    Go to Recovery (Reset Wallet)
                </button>
            )}
        </div>
    )
}