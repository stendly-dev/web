'use client'

import React, {useCallback, useEffect, useState} from 'react'
import {ArrowLeft, CheckCircle2, Loader2} from 'lucide-react'
import {api, ApiError, setTokens} from '@/lib/api'
import {generateAndSaveWallet} from '@/lib/wallet'
import PinInput from './PinInput'
import {encodeBase58} from "@/lib/utils";
import WalletBackupView from "@/components/wallet/WalletBackupView";
import OtpInput from "@/components/wallet/OtpInput";
import ThemeToggle from "./ThemeToggle";
import {captureProductError, captureProductEvent, identifyAnalyticsUser} from '@/lib/analytics';

type AuthStep = 'identifier' | 'otp' | 'profile' | 'pin' | 'backup' | 'success'
type AuthMethod = 'email' | null

interface WebAuthScreenProps {
    onAuthed: () => void
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase())
}

export default function WebAuthScreen({onAuthed}: WebAuthScreenProps) {
    const [step, setStep] = useState<AuthStep>('identifier')
    const [_, setMethod] = useState<AuthMethod>(null)

    const [identifier, setIdentifier] = useState('')
    const [identifierError, setIdentifierError] = useState<string | null>(null)

    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [otpError, setOtpError] = useState<string | null>(null)
    const [__, setOtpCooldown] = useState(0)

    const [username, setUsername] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [profileError, setProfileError] = useState<string | null>(null)

    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [pinError, setPinError] = useState<string | null>(null)

    const [privateKeyToBackup, setPrivateKeyToBackup] = useState<string | null>(null)

    const [submitting, setSubmitting] = useState(false)
    const [globalError, setGlobalError] = useState<string | null>(null)
    const [otpSkipped, setOtpSkipped] = useState(false)

    const isIdentifierValid = isValidEmail(identifier)

    useEffect(() => {
        captureProductEvent('auth_started');
    }, []);

    const startCooldown = useCallback((seconds: number) => {
        setOtpCooldown(seconds)
        const interval = setInterval(() => {
            setOtpCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (step === 'otp') {
            return startCooldown(60)
        }
    }, [step, startCooldown])

    const handleIdentifierSubmit = useCallback(async () => {
        const trimmed = identifier.trim()
        if (!isIdentifierValid) return

        const normalizedIdentifier = trimmed.toLowerCase();

        setMethod('email')
        setIdentifierError(null)
        setSubmitting(true)
        setGlobalError(null)

        try {
            captureProductEvent('email_submitted');
            const channel = 1
            const result = await api.auth.start(channel, normalizedIdentifier)

            if (result.accessToken) {
                setTokens(result.accessToken, result.refreshToken, result.accountId)
                await identifyAnalyticsUser(result.accountId);
                setOtpSkipped(true)
                if (result.requiresProfileSetup) {
                    setStep('profile')
                } else {
                    setStep('success')
                    setTimeout(onAuthed, 800)
                }
            } else {
                captureProductEvent('otp_requested');
                setOtpSkipped(false)
                setStep('otp')
            }
        } catch (err) {
            captureProductError(err, 'frontend_error', {operation: 'auth_start'});
            setGlobalError(err instanceof ApiError ? err.message : 'Failed to send code.')
        } finally {
            setSubmitting(false)
        }
    }, [identifier, isIdentifierValid, onAuthed])

    const handleOtpSubmit = useCallback(async (overrideCode?: string) => {
        const code = overrideCode || otp.join('')
        if (code.length !== 6) return

        setOtpError(null)
        setSubmitting(true)
        setGlobalError(null)

        try {
            const result = await api.auth.verify(identifier.trim(), code)
            setTokens(result.accessToken, result.refreshToken, result.accountId)
            await identifyAnalyticsUser(result.accountId);
            captureProductEvent('otp_verified');

            if (result.requiresProfileSetup) {
                setStep('profile')
            } else {
                setStep('success')
                setTimeout(onAuthed, 800)
            }
        } catch (err) {
            captureProductError(err, 'frontend_error', {operation: 'otp_verify', error_code: err instanceof ApiError ? `HTTP_${err.status}` : 'UNKNOWN'});
            setOtpError(err instanceof ApiError ? err.message : 'Invalid code')
        } finally {
            setSubmitting(false)
        }
    }, [identifier, onAuthed, otp])

    const handleProfileSubmit = useCallback(async () => {
        const trimmedUser = username.trim()
        if (!trimmedUser || trimmedUser.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
            setProfileError('Username: 3-32 chars, letters/numbers/underscore')
            return
        }

        setProfileError(null)
        setSubmitting(true)

        try {
            const available = await api.users.checkUsername(trimmedUser)
            if (!available.available) {
                setProfileError('Username is taken')
                setSubmitting(false)
                return
            }

            await api.users.updateProfile({
                username: trimmedUser,
                displayName: displayName.trim() || "Anonymous"
            })

            captureProductEvent('pin_create_started');
            setStep('pin')
        } catch (err) {
            setProfileError(err instanceof ApiError ? err.message : 'Failed to save profile')
        } finally {
            setSubmitting(false)
        }
    }, [username, displayName])

    const handlePinSubmit = useCallback(async (overrideCode?: string) => {
        const code = overrideCode || pin.join('')
        if (code.length !== 6) return

        setPinError(null)
        setSubmitting(true)

        try {
            const kp = await generateAndSaveWallet(code)
            captureProductEvent('pin_created');
            captureProductEvent('wallet_created');
            setPrivateKeyToBackup(encodeBase58(kp.secretKey))
            captureProductEvent('private_key_backup_shown');
            setStep('backup')
        } catch (err) {
            captureProductError(err, 'worker_error', {operation: 'wallet_create'});
            setPinError(err instanceof Error ? err.message : 'Failed to create wallet')
        } finally {
            setSubmitting(false)
        }
    }, [pin])

    return (
        <div className="relative flex flex-col w-full h-full" style={{backgroundColor: 'transparent'}}>
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-6 pb-4 z-10">
                <div className="w-10 flex justify-start">
                    {step === 'otp' && (
                        <button onClick={() => setStep('identifier')}
                                className="flex items-center justify-center rounded-full"
                                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                            <ArrowLeft size={18} color="var(--text-primary)"/>
                        </button>
                    )}
                    {step === 'profile' && (
                        <button onClick={() => setStep(otpSkipped ? 'identifier' : 'otp')}
                                className="flex items-center justify-center rounded-full"
                                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                            <ArrowLeft size={18} color="var(--text-primary)"/>
                        </button>
                    )}
                    {step === 'pin' && (
                        <button onClick={() => setStep('profile')}
                                className="flex items-center justify-center rounded-full"
                                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                            <ArrowLeft size={18} color="var(--text-primary)"/>
                        </button>
                    )}
                </div>
                {(step === 'identifier' || step === 'otp' || step === 'profile') && <ThemeToggle/>}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6">
                {step === 'identifier' && (
                    <div className="flex flex-col items-center gap-8 w-full">
                        <div className="w-full space-y-6">
                            <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Enter your
                                email</p>
                            <input
                                type="email"
                                value={identifier}
                                onChange={(e) => {
                                    setIdentifier(e.target.value);
                                    setIdentifierError(null);
                                    setGlobalError(null)
                                }}
                                placeholder="Email"
                                className="w-full text-center text-lg font-medium rounded-2xl px-4 py-3 outline-none"
                                style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: `1px solid ${identifierError ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                                    color: 'var(--text-primary)'
                                }}
                                autoFocus
                                autoComplete="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && isIdentifierValid) handleIdentifierSubmit()
                                }}
                            />
                            {globalError && <p className="text-xs text-center mt-2"
                                               style={{color: 'var(--accent-red)'}}>{globalError}</p>}
                            <button
                                onClick={() => handleIdentifierSubmit()}
                                disabled={submitting || !isIdentifierValid}
                                className="gradient-btn w-full rounded-2xl font-bold text-lg transition-all"
                                style={{
                                    height: '60px',
                                    color: 'var(--accent-primary-text)',
                                    opacity: submitting || !isIdentifierValid ? 0.4 : 1
                                }}
                            >
                                {submitting ? <Loader2 size={20} className="animate-spin mx-auto"/> : 'Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>We sent a 6-digit
                            code to<br/><b style={{color: 'var(--text-primary)'}}>{identifier}</b></p>
                        <OtpInput value={otp} onChange={setOtp} onComplete={handleOtpSubmit} error={otpError}
                                  type="text"/>
                        {otpError &&
                            <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{otpError}</p>}
                        <button
                            onClick={() => handleOtpSubmit()}
                            disabled={submitting || otp.join('').length !== 6}
                            className="gradient-btn w-full rounded-2xl font-semibold text-base transition-all"
                            style={{
                                height: '52px',
                                color: 'var(--accent-primary-text)',
                                opacity: submitting || otp.join('').length !== 6 ? 0.4 : 1
                            }}
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Verify'}
                        </button>
                    </div>
                )}

                {step === 'profile' && (
                    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Set up your Stendly
                            profile</p>

                        <div className="w-full flex items-center gap-2 rounded-2xl px-4" style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            height: '52px'
                        }}>
                            <span className="text-sm font-medium" style={{color: 'var(--text-hint)'}}>@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => {
                                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32));
                                    setProfileError(null)
                                }}
                                placeholder="username (required)"
                                className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
                                style={{color: 'var(--text-primary)'}}
                                autoComplete="off"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                        </div>

                        <div className="w-full flex items-center gap-2 rounded-2xl px-4" style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            height: '52px'
                        }}>
                            <input
                                type="text" value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Display Name (optional)"
                                className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
                                style={{color: 'var(--text-primary)'}}
                            />
                        </div>

                        {profileError &&
                            <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{profileError}</p>}

                        <button
                            onClick={() => handleProfileSubmit()}
                            disabled={submitting || !username.trim()}
                            className="gradient-btn w-full rounded-2xl font-semibold text-base transition-all mt-2"
                            style={{
                                height: '52px',
                                color: 'var(--accent-primary-text)',
                                opacity: submitting || !username.trim() ? 0.4 : 1
                            }}
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Continue'}
                        </button>
                    </div>
                )}

                {step === 'pin' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
                        <p className="text-sm text-center" style={{color: 'var(--text-secondary)'}}>Create a 6-digit PIN
                            to secure your wallet.<br/>You will need it to send funds.</p>
                        <PinInput value={pin} onChange={setPin} onComplete={handlePinSubmit} error={pinError}/>
                        {pinError &&
                            <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{pinError}</p>}
                    </div>
                )}

                {step === 'backup' && privateKeyToBackup && (
                    <WalletBackupView
                        privateKeyToBackup={privateKeyToBackup}
                        onComplete={() => {
                            setStep('success');
                            setTimeout(onAuthed, 800);
                        }}
                    />
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <CheckCircle2 size={72} color="var(--accent-green)" strokeWidth={1.5}/>
                        <p className="text-lg font-semibold" style={{color: 'var(--text-primary)'}}>Welcome to
                            Stendly!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
