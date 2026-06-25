'use client'

import React, {useEffect, useState} from 'react'
import {AlertTriangle, ArrowLeft, QrCode} from 'lucide-react'
import {Html5Qrcode} from 'html5-qrcode'
import {generateAndSaveWallet, importPrivateKeyBase58Async, importWalletBlob} from '@/lib/wallet'
import {api} from '@/lib/api'
import PinInput from './PinInput'
import {encodeBase58} from "@/lib/utils";
import WalletBackupView from "@/components/wallet/WalletBackupView";
import ThemeToggle from "./ThemeToggle";

interface DeviceSyncScreenProps {
    expectedAddress: string
    onSynced: () => void
    onReset: () => void
}

type SyncStep = 'choose' | 'scan' | 'pin' | 'reset_confirm' | 'reset_pin' | 'backup' | 'import_text' | 'import_pk_pin'

export default function DeviceSyncScreen({expectedAddress, onSynced, onReset}: DeviceSyncScreenProps) {
    const [step, setStep] = useState<SyncStep>('choose')
    const [scannedBlob, setScannedBlob] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [importText, setImportText] = useState('')

    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [privateKeyToBackup, setPrivateKeyToBackup] = useState<string | null>(null)

    useEffect(() => {
        if (step === 'scan') {
            const html5QrCode = new Html5Qrcode("sync-qr-reader")
            html5QrCode.start(
                {facingMode: "environment"},
                {fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0},
                (decodedText) => {
                    if (decodedText.startsWith('stendly-sync://')) {
                        html5QrCode.stop().then(() => {
                            try {
                                const base64Blob = decodedText.replace('stendly-sync://', '')
                                const jsonBlob = atob(base64Blob)
                                setScannedBlob(jsonBlob)
                                setStep('pin')
                                setPin(['', '', '', '', '', ''])
                            } catch {
                                setError('Invalid QR code format.')
                            }
                        }).catch(() => {
                        })
                    }
                },
                () => {
                }
            ).catch(() => setError('Camera access denied.'))

            return () => {
                if (html5QrCode.isScanning) html5QrCode.stop().catch(() => {
                })
            }
        }
    }, [step])

    useEffect(() => {
        if (step === 'reset_pin') {
            setPin(['', '', '', '', '', ''])
        }
    }, [step])

    const handleImportSubmit = async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6 || !scannedBlob) return

        setSubmitting(true)
        setError(null)

        try {
            const kp = await importWalletBlob(scannedBlob, code)
            if (kp.publicKey.toBase58() !== expectedAddress) {
                throw new Error("This QR code belongs to a different Stendly account.")
            }
            onSynced()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import wallet')
            setSubmitting(false)
        }
    }

    const handleResetSubmit = async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6) return

        setSubmitting(true)
        setError(null)

        try {
            const kp = await generateAndSaveWallet(code)

            setPrivateKeyToBackup(encodeBase58(kp.secretKey))
            setStep('backup')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset wallet')
            setSubmitting(false)
        }
    }

    const handleImportTextSubmit = () => {
        const trimmed = importText.trim()
        if (trimmed.startsWith('stendly-sync://')) {
            try {
                const base64Blob = trimmed.replace('stendly-sync://', '')
                const jsonBlob = atob(base64Blob)
                setScannedBlob(jsonBlob)
                setStep('pin')
                setPin(['', '', '', '', '', ''])
                setError(null)
            } catch {
                setError('Invalid backup string format.')
            }
        } else {
            if (!/^[1-9A-HJ-NP-Za-km-z]{87,90}$/.test(trimmed)) {
                setError('Invalid backup string or private key format.')
                return
            }
            setStep('import_pk_pin')
            setPin(['', '', '', '', '', ''])
            setError(null)
        }
    }

    const handleImportPkSubmit = async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6) return

        setSubmitting(true)
        setError(null)

        try {
            const kp = await importPrivateKeyBase58Async(importText.trim(), code)
            if (kp.publicKey.toBase58() !== expectedAddress) {
                throw new Error("This private key belongs to a different Stendly account.")
            }
            onSynced()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import private key')
            setSubmitting(false)
        }
    }

    return (
        <div className="relative flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <style dangerouslySetInnerHTML={{
                __html: `
				#sync-qr-reader video {
					object-fit: cover !important;
					width: 100% !important;
					height: 100% !important;
				}
			`
            }}/>
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-6 pb-4 z-10">
                <div className="w-10 flex justify-start">
                    {step !== 'choose' && (
                        <button onClick={() => {
                            setStep('choose');
                            setPin(['', '', '', '', '', '']);
                            setError(null)
                        }} className="flex items-center justify-center rounded-full"
                                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                            <ArrowLeft size={18} color="var(--text-primary)"/>
                        </button>
                    )}
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                      style={{color: 'var(--text-primary)'}}>
					{step === 'choose' ? 'Device Sync' : step === 'scan' ? 'Scan QR' : step === 'pin' ? 'Enter PIN' : 'Reset Wallet'}
				</span>
                {step === 'choose' && <ThemeToggle/>}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6">
                {step === 'choose' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <div className="flex items-center justify-center rounded-full bg-blue-500/10"
                             style={{width: '80px', height: '80px'}}>
                            <QrCode size={40} className="text-blue-500"/>
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>New Device
                                Detected</h2>
                            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>To access your funds, scan
                                the Sync QR code from your old device (Settings &gt; Export Wallet).</p>
                        </div>
                        <button onClick={() => setStep('scan')}
                                className="gradient-btn w-full rounded-2xl font-semibold text-base transition-all"
                                style={{height: '52px', color: 'var(--accent-primary-text)'}}>
                            Scan Sync QR
                        </button>
                        <button onClick={() => {
                            setStep('import_text');
                            setError(null);
                            setImportText('');
                        }}
                                className="w-full rounded-2xl font-semibold text-base transition-all mt-3"
                                style={{
                                    height: '52px',
                                    backgroundColor: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-subtle)'
                                }}>
                            I have private key
                        </button>
                        <button onClick={() => setStep('reset_confirm')}
                                className="w-full rounded-2xl font-semibold text-sm transition-all mt-3"
                                style={{
                                    height: '44px',
                                    backgroundColor: 'rgba(255,71,87,0.1)',
                                    border: '1px solid rgba(255,71,87,0.2)',
                                    color: 'var(--accent-red)'
                                }}>
                            I lost my old device (Reset Wallet)
                        </button>
                    </div>
                )}

                {step === 'scan' && (
                    <div className="flex flex-col items-center w-full h-full pt-10">
                        {error ? (
                            <p className="text-sm text-center px-6" style={{color: 'var(--accent-red)'}}>{error}</p>
                        ) : (
                            <div id="sync-qr-reader"
                                 className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black"/>
                        )}
                        <p className="text-sm text-center mt-8" style={{color: 'var(--text-secondary)'}}>Point camera at
                            the Export QR code on your other device.</p>
                    </div>
                )}

                {step === 'pin' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Enter the 6-digit
                            PIN you used on your old device to decrypt the wallet.</p>
                        <PinInput value={pin} onChange={setPin} onComplete={handleImportSubmit} error={error}
                                  disabled={submitting}/>
                        {error && <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{error}</p>}
                    </div>
                )}

                {step === 'reset_confirm' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <div className="flex items-center justify-center rounded-full bg-red-500/10"
                             style={{width: '80px', height: '80px'}}>
                            <AlertTriangle size={40} className="text-red-500"/>
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Warning</h2>
                            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>Resetting your wallet will
                                generate a new Solana address. <b>Any funds on your old address will be permanently
                                    lost</b> unless you have the old device.</p>
                        </div>
                        <button onClick={() => setStep('reset_pin')}
                                className="w-full rounded-2xl font-semibold text-base transition-all"
                                style={{height: '52px', backgroundColor: 'var(--accent-red)', color: '#fff'}}>
                            I understand, Reset Wallet
                        </button>
                    </div>
                )}

                {step === 'reset_pin' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Create a new 6-digit
                            PIN for your new wallet.</p>
                        <PinInput value={pin} onChange={setPin} onComplete={handleResetSubmit} error={error}
                                  disabled={submitting}/>
                        {error && <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{error}</p>}
                    </div>
                )}

                {step === 'backup' && privateKeyToBackup && (
                    <WalletBackupView privateKeyToBackup={privateKeyToBackup} onComplete={onReset}/>
                )}

                {step === 'import_text' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Paste the backup
                            string or raw private key you copied from your old device.</p>
                        <textarea
                            value={importText}
                            onChange={(e) => {
                                setImportText(e.target.value);
                                setError(null);
                            }}
                            placeholder="stendly-sync://... or Base58 Private Key"
                            className="w-full h-32 rounded-2xl p-4 text-sm font-mono outline-none resize-none"
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                                color: 'var(--text-primary)'
                            }}
                        />
                        {error && <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{error}</p>}
                        <button
                            onClick={() => handleImportTextSubmit()}
                            disabled={!importText.trim()}
                            className="gradient-btn w-full rounded-2xl font-semibold text-base transition-all"
                            style={{
                                height: '52px',
                                color: 'var(--accent-primary-text)',
                                opacity: !importText.trim() ? 0.4 : 1
                            }}
                        >
                            Continue
                        </button>
                    </div>
                )}

                {step === 'import_pk_pin' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Create a new 6-digit
                            PIN to secure this imported wallet.</p>
                        <PinInput value={pin} onChange={setPin} onComplete={handleImportPkSubmit} error={error}
                                  disabled={submitting}/>
                        {error && <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{error}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}
