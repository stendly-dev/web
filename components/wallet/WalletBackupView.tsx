'use client'

import React, {useState} from 'react'
import {AlertTriangle} from 'lucide-react'
import {captureProductEvent} from '@/lib/analytics';

const BACKUP_ACK_KEY = 'stendly_backup_acknowledged'

export function isBackupAcknowledged(): boolean {
    return localStorage.getItem(BACKUP_ACK_KEY) === 'true'
}

export function markBackupAcknowledged(): void {
    localStorage.setItem(BACKUP_ACK_KEY, 'true')
}

export function clearBackupAcknowledged(): void {
    localStorage.removeItem(BACKUP_ACK_KEY)
}

interface WalletBackupViewProps {
    privateKeyToBackup: string
    onComplete: () => void
}

export default function WalletBackupView({privateKeyToBackup, onComplete}: WalletBackupViewProps) {
    const [hasCopiedOrShown, setHasCopiedOrShown] = useState(false)
    const [showPk, setShowPk] = useState(false)

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10">
                <AlertTriangle size={32} className="text-red-500"/>
            </div>
            <h2 className="text-xl font-bold text-center" style={{color: 'var(--text-primary)'}}>Backup Your Wallet</h2>
            <div className="p-4 rounded-xl"
                 style={{backgroundColor: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)'}}>
                <p className="text-sm text-center font-medium" style={{color: 'var(--accent-red)'}}>
                    If you forget your PIN and lose this key, Stendly cannot recover your wallet. Not even
                    through support.
                </p>
            </div>
            <div className="w-full p-4 rounded-xl flex flex-col gap-3"
                 style={{backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)'}}>
                <p className="text-xs font-semibold uppercase tracking-wider"
                   style={{color: 'var(--text-hint)'}}>Private Key</p>
                <p className="text-sm font-mono break-all" style={{color: 'var(--text-primary)'}}>
                    {showPk ? privateKeyToBackup : `${privateKeyToBackup.slice(0, 4)}${'•'.repeat(privateKeyToBackup.length - 8)}${privateKeyToBackup.slice(-4)}`}
                </p>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => {
                        setShowPk(!showPk);
                        setHasCopiedOrShown(true);
                    }} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                            style={{backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)'}}>
                        {showPk ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => {
                        navigator.clipboard.writeText(privateKeyToBackup);
                        setHasCopiedOrShown(true);
                        captureProductEvent('private_key_backup_copied');
                    }} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-primary-text)'
                    }}>
                        Copy
                    </button>
                </div>
            </div>
            <button
                onClick={() => {
                    markBackupAcknowledged()
                    onComplete()
                }}
                disabled={!hasCopiedOrShown}
                className="gradient-btn w-full rounded-2xl font-semibold text-base transition-all"
                style={{height: '52px', color: 'var(--accent-primary-text)', opacity: !hasCopiedOrShown ? 0.4 : 1}}
            >
                I saved it
            </button>
        </div>
    )
}
