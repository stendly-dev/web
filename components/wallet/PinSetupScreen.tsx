'use client'

import React, {useState} from 'react'
import {generateAndSaveWallet} from '@/lib/wallet'
import PinInput from './PinInput'
import {encodeBase58} from "@/lib/utils";
import WalletBackupView from "@/components/wallet/WalletBackupView";
import {captureProductError, captureProductEvent} from '@/lib/analytics';

interface PinSetupScreenProps {
    onComplete: () => void
}

export default function PinSetupScreen({onComplete}: PinSetupScreenProps) {
    const [step, setStep] = useState<'pin' | 'backup'>('pin')
    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [privateKeyToBackup, setPrivateKeyToBackup] = useState<string | null>(null)

    React.useEffect(() => {
        captureProductEvent('pin_create_started');
    }, []);

    const handleSubmit = async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6) return

        setSubmitting(true)
        setError(null)

        try {
            const kp = await generateAndSaveWallet(code)
            captureProductEvent('pin_created');
            captureProductEvent('wallet_created');
            setPrivateKeyToBackup(encodeBase58(kp.secretKey))
            captureProductEvent('private_key_backup_shown');
            setStep('backup')
        } catch (err) {
            captureProductError(err, 'worker_error', {operation: 'wallet_create'});
            setError(err instanceof Error ? err.message : 'Failed to create wallet')
            setSubmitting(false)
        }
    }

    if (step === 'backup' && privateKeyToBackup) {
        return (
            <div className="relative flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="absolute top-0 left-0 right-0 flex items-center justify-center px-4 pt-6 pb-4 z-10">
                    <span className="text-lg font-semibold pointer-events-none"
                          style={{color: 'var(--text-primary)'}}>Backup Wallet</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <WalletBackupView privateKeyToBackup={privateKeyToBackup} onComplete={onComplete}/>
                </div>
            </div>
        )
    }

    return (
        <div className="relative flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="absolute top-0 left-0 right-0 flex items-center justify-center px-4 pt-6 pb-4 z-10">
                <span className="text-lg font-semibold pointer-events-none"
                      style={{color: 'var(--text-primary)'}}>Create Wallet</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                <p className="text-sm text-center mb-6" style={{color: 'var(--text-secondary)'}}>Create a 6-digit PIN to
                    secure your wallet.<br/>You will need it to send funds.</p>
                <PinInput value={pin} onChange={setPin} onComplete={handleSubmit} error={error}/>
            </div>
        </div>
    )
}
