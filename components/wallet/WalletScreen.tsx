'use client'

import React, {useState} from 'react'
import {ArrowLeft, CheckCheck, Copy, Key} from 'lucide-react'
import {exportPrivateKeyBase58Async} from '@/lib/wallet'
import PinInput from './PinInput'

interface WalletScreenProps {
    onBack: () => void
}

export default function WalletScreen({onBack}: WalletScreenProps) {
    const [showPin, setShowPin] = useState(false)
    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [pinError, setPinError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [privateKey, setPrivateKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleExportClick = () => {
        setShowPin(true)
        setPin(['', '', '', '', '', ''])
        setPinError(null)
        setPrivateKey(null)
    }

    const handlePinSubmit = async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6) return

        setSubmitting(true)
        setPinError(null)

        try {
            const pk = await exportPrivateKeyBase58Async(code)
            setPrivateKey(pk)
            setShowPin(false)
        } catch (err) {
            setPinError(err instanceof Error ? err.message : 'Failed to export private key')
        } finally {
            setSubmitting(false)
        }
    }

    const handleCopy = async () => {
        if (!privateKey) return
        try {
            await navigator.clipboard.writeText(privateKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // ignore
        }
    }

    if (showPin) {
        return (
            <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="flex items-center px-4 relative" style={{height: '60px'}}>
                    <button onClick={() => setShowPin(false)}
                            className="relative z-10 flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                            style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                        <ArrowLeft size={18} color="var(--text-primary)"/>
                    </button>
                    <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                        style={{color: 'var(--text-primary)'}}>Enter PIN</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <p className="text-sm text-center mb-6" style={{color: 'var(--text-secondary)'}}>Enter your 6-digit
                        PIN to export your private key.</p>
                    <PinInput value={pin} onChange={setPin} onComplete={handlePinSubmit} error={pinError}/>
                    {pinError &&
                        <p className="text-xs text-center mt-4" style={{color: 'var(--accent-red)'}}>{pinError}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center justify-between px-4 pt-6 pb-4 relative z-10">
                <div className="w-10 flex justify-start">
                    <button onClick={onBack}
                            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                            style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                        <ArrowLeft size={18} color="var(--text-primary)"/>
                    </button>
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                      style={{color: 'var(--text-primary)'}}>Wallet</span>
                <div className="w-10 flex justify-end"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 mt-4">
                <div className="rounded-2xl overflow-hidden card-shadow flex flex-col"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <button onClick={handleExportClick}
                            className="flex items-center justify-between px-4 py-4 transition-colors active:bg-white/5 text-left">
                        <div className="flex items-center gap-3">
                            <Key size={20} color="var(--accent-red)"/>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium" style={{color: 'var(--accent-red)'}}>Export Private Key</span>
                                <span className="text-xs mt-0.5" style={{color: 'var(--text-secondary)'}}>Raw Base58 format</span>
                            </div>
                        </div>
                    </button>
                </div>

                {privateKey && (
                    <div className="mt-6 p-4 rounded-2xl"
                         style={{backgroundColor: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)'}}>
                        <p className="text-sm font-semibold mb-2" style={{color: 'var(--accent-red)'}}>Warning: Never
                            share this key!</p>
                        <p className="text-xs mb-4" style={{color: 'var(--text-secondary)'}}>Anyone with this key has
                            full control over your funds.</p>
                        <div className="flex items-center gap-2 p-3 rounded-xl"
                             style={{backgroundColor: 'var(--bg-elevated)'}}>
                            <span className="text-xs font-mono break-all flex-1"
                                  style={{color: 'var(--text-primary)'}}>{privateKey}</span>
                            <button onClick={handleCopy}
                                    className="flex items-center justify-center rounded-lg shrink-0 transition-opacity active:opacity-70"
                                    style={{width: '32px', height: '32px', backgroundColor: 'var(--bg-card)'}}>
                                {copied ? <CheckCheck size={16} color="var(--accent-green)"/> :
                                    <Copy size={16} color="var(--text-secondary)"/>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}