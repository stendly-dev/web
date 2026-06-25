'use client'

import React, {useState} from 'react'
import {ArrowLeft, CheckCheck, Copy, QrCode, X} from 'lucide-react'
import {getWalletBlobAsync} from '@/lib/wallet'
import {QRCodeSVG} from 'qrcode.react'

interface DevicesScreenProps {
    onBack: () => void
}

export default function DevicesScreen({onBack}: DevicesScreenProps) {
    const [showExport, setShowExport] = useState(false)
    const [exportUrl, setExportUrl] = useState('')

    const [copied, setCopied] = useState(false)

    const handleExport = async () => {
        const blob = await getWalletBlobAsync()
        if (blob) {
            setExportUrl(`stendly-sync://${btoa(blob)}`)
            setShowExport(true)
        }
    }

    const handleCopy = async () => {
        if (!exportUrl) return
        try {
            await navigator.clipboard.writeText(exportUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // ignore
        }
    }

    const maskedUrl = exportUrl ? `${exportUrl.slice(0, 25)}...${exportUrl.slice(-10)}` : ''

    if (showExport) {
        return (
            <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="flex items-center justify-between px-4 pt-6 pb-4 relative z-10">
                    <div className="w-10 flex justify-start">
                        <button onClick={() => setShowExport(false)}
                                className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                            <X size={18} color="var(--text-primary)"/>
                        </button>
                    </div>
                    <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                          style={{color: 'var(--text-primary)'}}>Sync Device</span>
                    <div className="w-10 flex justify-end"></div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <div className="bg-white p-4 rounded-2xl mb-6">
                        <QRCodeSVG value={exportUrl} size={220} level="L"/>
                    </div>
                    <h2 className="text-xl font-bold mb-2 text-center" style={{color: 'var(--text-primary)'}}>Sync New
                        Device</h2>
                    <p className="text-sm text-center mb-6" style={{color: 'var(--text-secondary)'}}>Open Stendly on
                        your new device and scan this QR code to import your wallet securely.</p>

                    <div className="w-full flex items-center gap-2 p-3 rounded-xl"
                         style={{backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)'}}>
                        <span className="text-xs font-mono truncate flex-1"
                              style={{color: 'var(--text-primary)'}}>{maskedUrl}</span>
                        <button onClick={handleCopy}
                                className="flex items-center justify-center rounded-lg shrink-0 transition-opacity active:opacity-70"
                                style={{width: '32px', height: '32px', backgroundColor: 'var(--bg-card)'}}>
                            {copied ? <CheckCheck size={16} color="var(--accent-green)"/> :
                                <Copy size={16} color="var(--text-secondary)"/>}
                        </button>
                    </div>
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
                      style={{color: 'var(--text-primary)'}}>Devices</span>
                <div className="w-10 flex justify-end"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 mt-4">
                <button onClick={handleExport}
                        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl card-shadow transition-opacity active:opacity-70 mb-6"
                        style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center gap-3">
                        <QrCode size={20} color="var(--text-primary)"/>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-medium"
                                  style={{color: 'var(--text-primary)'}}>Sync New Device</span>
                            <span className="text-xs mt-0.5" style={{color: 'var(--text-secondary)'}}>Show QR code to export wallet</span>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    )
}
