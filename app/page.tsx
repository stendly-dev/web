'use client'
import React, {Suspense, useCallback, useEffect, useState} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import {ProfileProvider, useProfile} from '@/contexts/ProfileContext'
import {isAuthenticated} from '@/lib/auth'
import {api, ApiError, checkBackendHealth, clearTokens, setTokens} from '@/lib/api'
import {queryClient} from '@/lib/queryClient'
import {queryKeys} from '@/lib/queryKeys'
import {deleteLocalWallet, hasLocalWallet} from '@/lib/wallet'
import {
    clearBackupAcknowledged,
    isBackupAcknowledged,
    markBackupAcknowledged
} from '@/components/wallet/WalletBackupView'
import HomeScreen from '@/components/wallet/HomeScreen'
import SendScreen, {type SendPayload} from '@/components/wallet/SendScreen'
import PaymentConfirmScreen, {type PaymentResult} from '@/components/wallet/PaymentConfirmScreen'
import SuccessScreen from '@/components/wallet/SuccessScreen'
import ReceiveScreen from '@/components/wallet/ReceiveScreen'
import ScanScreen from '@/components/wallet/ScanScreen'
import ProfileScreen from '@/components/wallet/ProfileScreen'
import HistoryScreen from '@/components/wallet/HistoryScreen'
import DeviceSyncScreen from '@/components/wallet/DeviceSyncScreen'
import PinSetupScreen from '@/components/wallet/PinSetupScreen'
import MeScreen from '@/components/wallet/MeScreen'
import PreferencesScreen from '@/components/wallet/PreferencesScreen'
import DevicesScreen from '@/components/wallet/DevicesScreen'
import {AlertTriangle, Loader2, RefreshCw, User as UserIcon, Wallet, WifiOff} from 'lucide-react'
import {Toaster} from '@/components/ui/toaster'
import {useToast} from '@/hooks/use-toast'
import SecurityScreen from '@/components/wallet/SecurityScreen'
import WalletScreen from '@/components/wallet/WalletScreen'
import AppLockScreen from "@/components/wallet/AppLockScreen";
import {captureProductEvent} from '@/lib/analytics';

type Screen =
    'home'
    | 'send'
    | 'confirm'
    | 'success'
    | 'receive'
    | 'scan'
    | 'profile'
    | 'history'
    | 'me'
    | 'preferences'
    | 'devices'
    | 'security'
    | 'wallet_settings'

function AuthGate({children}: { children: React.ReactNode }) {
    const router = useRouter()
    const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'backend_error'>('checking')
    const [backendErrorMessage, setBackendErrorMessage] = useState<string>('')
    const [retrying, setRetrying] = useState(false)

    useEffect(() => {
        const checkAndAuth = async () => {
            if (isAuthenticated()) {
                try {
                    const me = await api.users.me()
                    if (!me.userProfile) {
                        clearTokens()
                        router.replace('/auth')
                        return
                    }
                } catch {
                    clearTokens()
                    router.replace('/auth')
                    return
                }
                setAuthState('authenticated')
                return
            }

            api.auth.refresh().then(async (res) => {
                setTokens(res.accessToken, undefined, res.accountId)
                try {
                    const me = await api.users.me()
                    if (!me.userProfile) {
                        clearTokens()
                        router.replace('/auth')
                        return
                    }
                } catch {
                    clearTokens()
                    router.replace('/auth')
                    return
                }
                setAuthState('authenticated')
            }).catch((err) => {
                if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 400)) {
                    router.replace('/auth')
                } else {
                    setBackendErrorMessage('Failed to authenticate. Please try again.')
                    setAuthState('backend_error')
                }
            })
        }
        checkAndAuth()
    }, [router])

    const handleRetry = async () => {
        setRetrying(true)
        setBackendErrorMessage('')
        const healthy = await checkBackendHealth()
        if (healthy) {
            if (isAuthenticated()) {
                try {
                    const me = await api.users.me()
                    if (!me.userProfile) {
                        clearTokens()
                        router.replace('/auth')
                        return
                    }
                } catch {
                    clearTokens()
                    router.replace('/auth')
                    return
                }
                setAuthState('authenticated')
            } else {
                api.auth.refresh().then(async (res) => {
                    setTokens(res.accessToken, undefined, res.accountId)
                    try {
                        const me = await api.users.me()
                        if (!me.userProfile) {
                            clearTokens()
                            router.replace('/auth')
                            return
                        }
                    } catch {
                        clearTokens()
                        router.replace('/auth')
                        return
                    }
                    setAuthState('authenticated')
                }).catch((err) => {
                    if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 400)) {
                        router.replace('/auth')
                    } else {
                        setBackendErrorMessage('Failed to authenticate. Please try again.')
                        setAuthState('backend_error')
                    }
                })
            }
        } else {
            setBackendErrorMessage('Still unable to connect. Please try again.')
        }
        setRetrying(false)
    }

    if (authState === 'checking') {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 size={32} className="animate-spin" color="var(--accent-primary)"/>
            </div>
        )
    }

    if (authState === 'backend_error') {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full px-6 text-center"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                     style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                    <WifiOff size={32} color="var(--accent-red)"/>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2>
                <p className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>{backendErrorMessage}</p>
                <button onClick={handleRetry} disabled={retrying}
                        className="gradient-btn font-bold rounded-xl px-6 py-3 transition-colors flex items-center gap-2 disabled:opacity-50"
                        style={{color: 'var(--accent-primary-text)'}}>
                    {retrying ? <Loader2 size={18} className="animate-spin"/> : <><RefreshCw size={18}/> Retry
                        Connection</>}
                </button>
            </div>
        )
    }

    return <>{children}</>
}

function AppShell() {
    const searchParams = useSearchParams()
    const {profile, loading: profileLoading, error: profileError, refetch, refetchTransactions} = useProfile()
    const {toast} = useToast()
    const [screen, setScreen] = useState<Screen>('home')
    const [sendPayload, setSendPayload] = useState<SendPayload | null>(null)
    const [lastResult, setLastResult] = useState<PaymentResult | null>(null)
    const [scannedValue, setScannedValue] = useState<string | null>(null)
    const [globalLoading, setGlobalLoading] = useState(false)
    const [walletExists, setWalletExists] = useState<boolean | null>(null)
    const [backupAck, setBackupAck] = useState<boolean>(isBackupAcknowledged())
    const [isAppLocked, setIsAppLocked] = useState(false)
    const [hasInitialLockChecked, setHasInitialLockChecked] = useState(false)
    const [lastActivity, setLastActivity] = useState(Date.now())
    const [hasProcessedInvoice, setHasProcessedInvoice] = useState(false)

    useEffect(() => {
        if (walletExists === true && !hasInitialLockChecked) {
            setIsAppLocked(true)
            setHasInitialLockChecked(true)
        }
    }, [walletExists, hasInitialLockChecked])

    useEffect(() => {
        const updateActivity = () => setLastActivity(Date.now())
        window.addEventListener('mousemove', updateActivity)
        window.addEventListener('keydown', updateActivity)
        window.addEventListener('touchstart', updateActivity)
        return () => {
            window.removeEventListener('mousemove', updateActivity)
            window.removeEventListener('keydown', updateActivity)
            window.removeEventListener('touchstart', updateActivity)
        }
    }, [])

    useEffect(() => {
        const checkInactivity = () => {
            const lockTimeStr = localStorage.getItem('stendly_lock_timer') || '300000'
            const lockTime = parseInt(lockTimeStr, 10)
            if (lockTime > 0 && Date.now() - lastActivity > lockTime && walletExists === true) {
                setIsAppLocked(true)
            }
        }
        const interval = setInterval(checkInactivity, 10000)
        return () => clearInterval(interval)
    }, [lastActivity, walletExists])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const lockTimeStr = localStorage.getItem('stendly_lock_timer') || '300000'
                const lockTime = parseInt(lockTimeStr, 10)
                if (lockTime > 0 && Date.now() - lastActivity > lockTime && walletExists === true) {
                    setIsAppLocked(true)
                }
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [lastActivity, walletExists])

    const handleResetWallet = async () => {
        localStorage.removeItem('stendly_lock_timer')
        clearBackupAcknowledged()
        await deleteLocalWallet()
        window.location.reload()
    }

    const navigate = useCallback((target: Screen) => {
        if (target === 'scan') {
            captureProductEvent('qr_scan_opened');
            captureProductEvent('qr_scanner_opened');
        }
        setScreen(target);
    }, [])

    const handleScanResult = useCallback(async (text: string) => {
        let value = text
        let isInvoice = false
        let invoiceId = ''
        let isTerminal = false
        let terminalId = ''

        try {
            const urlStr = text.startsWith('solana:') ? text.slice(7) : text;
            const url = new URL(urlStr);

            if (url.pathname.includes('/api/actions/invoice/')) {
                isInvoice = true;
                invoiceId = url.pathname.split('/').pop() || '';
            } else if (url.pathname.includes('/api/actions/terminal/')) {
                isTerminal = true;
                terminalId = url.pathname.split('/').pop() || '';
            } else if ((url.hostname === 'app.stendly.com' || url.hostname === 'app-devnet.stendly.com') && url.searchParams.has('invoice')) {
                isInvoice = true;
                invoiceId = url.searchParams.get('invoice')!;
            } else {
                value = url.searchParams.get('user') || url.searchParams.get('address') || text;
            }
        } catch {
            const looksLikeRawRecipient = /^@?[a-zA-Z0-9_]{2,32}$/.test(text.trim()) ||
                /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text.trim())
            if (!looksLikeRawRecipient) {
                captureProductEvent('qr_parse_failed', {
                    error_code: 'UNSUPPORTED_QR_PAYLOAD',
                    payload_length: text.length,
                })
            }
        }

        if (isTerminal && terminalId) {
            setGlobalLoading(true)
            try {
                const invoice = await api.invoices.getByTerminal(terminalId)
                isInvoice = true
                invoiceId = invoice.id
            } catch (err) {
                captureProductEvent('qr_parse_failed', {
                    error_code: err instanceof ApiError ? `HTTP_${err.status}` : 'TERMINAL_LOOKUP_FAILED',
                    qr_type: 'terminal',
                })
                toast({title: 'Terminal', description: 'No active order at this terminal', variant: 'destructive'})
                setGlobalLoading(false)
                return
            }
        }

        if (isInvoice && invoiceId) {
            setGlobalLoading(true)
            try {
                const invoice = await api.invoices.get(invoiceId)
                if (invoice.status !== 'pending') {
                    toast({
                        title: 'Invoice Error',
                        description: `This invoice is already ${invoice.status}`,
                        variant: 'destructive'
                    })
                    return
                }
                setSendPayload({
                    recipient: {
                        accountId: '',
                        displayName: invoice.merchantName,
                        username: null,
                        avatarUrl: null,
                        isStendlyUser: true,
                        solanaAddress: invoice.destinationAddress
                    },
                    resolveMethod: 1,
                    resolveValue: invoice.destinationAddress,
                    amountCents: invoice.expectedAmountCents,
                    note: `Payment to ${invoice.merchantName}`,
                    paymentIntentId: invoice.id
                })
                navigate('confirm')
                captureProductEvent('qr_parsed', {
                    qr_type: 'invoice',
                    amount_cents: invoice.expectedAmountCents,
                })
            } catch (err) {
                captureProductEvent('qr_parse_failed', {
                    error_code: err instanceof ApiError ? `HTTP_${err.status}` : 'INVOICE_LOOKUP_FAILED',
                    qr_type: 'invoice',
                })
                toast({title: 'Error', description: 'Failed to load invoice details', variant: 'destructive'})
            } finally {
                setGlobalLoading(false)
            }
            return
        }

        setScannedValue(value)
        captureProductEvent('qr_parsed', {
            qr_type: value === text ? 'raw_recipient' : 'url_recipient',
        })
        navigate('send')
    }, [navigate, toast])

    useEffect(() => {
        const user = searchParams.get('user')
        const address = searchParams.get('address')
        const invoice = searchParams.get('invoice')
        if (user) {
            setScannedValue(user)
            setScreen('send')
            window.history.replaceState({}, '', '/')
        } else if (address) {
            setScannedValue(address)
            setScreen('send')
            window.history.replaceState({}, '', '/')
        } else if (invoice && walletExists === true && !isAppLocked && !hasProcessedInvoice) {
            setHasProcessedInvoice(true)
            const fullUrl = `${window.location.origin}/?invoice=${invoice}`
            handleScanResult(fullUrl)
            window.history.replaceState({}, '', '/')
        }
    }, [searchParams, walletExists, isAppLocked, hasProcessedInvoice])

    useEffect(() => {
        if (profile?.solanaAddress) {
            hasLocalWallet(profile.solanaAddress).then(setWalletExists)
        } else if (profile && !profile.solanaAddress) {
            setWalletExists(false)
        }
    }, [profile?.solanaAddress])

    const handlePaymentSuccess = useCallback((result: PaymentResult) => {
        setLastResult(result)
        queryClient.invalidateQueries({queryKey: queryKeys.profile})
        refetchTransactions()
        navigate('success')
    }, [navigate, refetchTransactions])

    const handleHome = useCallback(() => {
        setSendPayload(null)
        setLastResult(null)
        setScannedValue(null)
        navigate('home')
    }, [navigate])

    if (profileError) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full px-6 text-center"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                     style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                    <AlertTriangle size={32} color="var(--accent-red)"/>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2>
                <p className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>{profileError}</p>
                <button onClick={() => window.location.reload()}
                        className="gradient-btn font-bold rounded-xl px-6 py-3 transition-colors"
                        style={{color: 'var(--accent-primary-text)'}}>
                    Retry Connection
                </button>
            </div>
        )
    }

    if (profileLoading || !profile || globalLoading || walletExists === null) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 size={32} className="animate-spin" color="var(--accent-primary)"/>
            </div>
        )
    }

    if (!profile.solanaAddress) {
        return <PinSetupScreen onComplete={refetch}/>
    }

    if (!walletExists) {
        return <DeviceSyncScreen expectedAddress={profile.solanaAddress} onSynced={() => setWalletExists(true)}
                                 onReset={refetch}/>
    }

    if (!backupAck) {
        return (
            <div className="flex flex-col w-full h-full items-center justify-center px-6"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                     style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                    <AlertTriangle size={32} color="var(--accent-red)"/>
                </div>
                <h2 className="text-xl font-bold mb-2 text-center"
                    style={{color: 'var(--text-primary)'}}>Backup Your Wallet</h2>
                <p className="text-sm text-center mb-8 max-w-xs"
                   style={{color: 'var(--text-secondary)'}}>
                    Your wallet was created but you haven't confirmed saving your private key.
                    If you lose your PIN without saving the key, your funds will be unrecoverable.
                </p>
                <p className="text-xs text-center mb-6 px-4 py-3 rounded-xl max-w-xs"
                   style={{
                       color: 'var(--accent-red)',
                       backgroundColor: 'rgba(255,71,87,0.1)',
                       border: '1px solid rgba(255,71,87,0.2)'
                   }}>
                    If you already saved your key, you can safely continue.
                    If you didn't, go to Settings &gt; Security &gt; Wallet to export it now.
                </p>
                <button
                    onClick={() => {
                        captureProductEvent('private_key_backup_skipped', {
                            backup_state: 'acknowledged_without_current_key',
                        })
                        markBackupAcknowledged()
                        setBackupAck(true)
                    }}
                    className="gradient-btn w-full max-w-xs rounded-2xl font-semibold text-base transition-all"
                    style={{height: '52px', color: 'var(--accent-primary-text)'}}>
                    I understand, continue
                </button>
            </div>
        )
    }

    if (isAppLocked) {
        return <AppLockScreen onUnlock={() => {
            captureProductEvent('returning_user_wallet_opened', {unlock_method: 'pin'})
            setIsAppLocked(false);
            setLastActivity(Date.now());
        }} onReset={handleResetWallet}/>
    }

    const isRootScreen = screen === 'home' || screen === 'me'

    return (
        <>
            <div className="flex-1 overflow-hidden flex flex-col relative">
                {screen === 'home' && (
                    <HomeScreen
                        onSend={() => {
                            setScannedValue(null);
                            navigate('send')
                        }}
                        onReceive={() => navigate('receive')}
                        onScan={() => navigate('scan')}
                        onScanResult={handleScanResult}
                        onHistory={() => navigate('history')}
                    />
                )}
                {screen === 'me' && (
                    <MeScreen
                        onProfile={() => navigate('profile')}
                        onPreferences={() => navigate('preferences')}
                        onDevices={() => navigate('devices')}
                        onSecurity={() => navigate('security')}
                    />
                )}
                {screen === 'preferences' && <PreferencesScreen onBack={() => navigate('me')}/>}
                {screen === 'devices' && <DevicesScreen onBack={() => navigate('me')}/>}
                {screen === 'security' && <SecurityScreen onBack={() => navigate('me')}
                                                          onWalletSettings={() => navigate('wallet_settings')}/>}
                {screen === 'wallet_settings' && <WalletScreen onBack={() => navigate('security')}/>}
                {screen === 'send' && (
                    <SendScreen
                        onBack={() => navigate('home')}
                        onContinue={(payload) => {
                            setSendPayload(payload);
                            navigate('confirm')
                        }}
                        balanceCents={profile.balanceCents}
                        initialRecipient={scannedValue}
                    />
                )}
                {screen === 'confirm' && sendPayload && (
                    <PaymentConfirmScreen
                        onBack={() => navigate('send')}
                        onSuccess={handlePaymentSuccess}
                        sendPayload={sendPayload}
                    />
                )}
                {screen === 'success' && <SuccessScreen onHome={handleHome} result={lastResult}/>}
                {screen === 'receive' && <ReceiveScreen onBack={() => navigate('home')}/>}
                {screen === 'scan' && <ScanScreen onBack={() => navigate('home')} onScanResult={handleScanResult}/>}
                {screen === 'profile' && <ProfileScreen onBack={() => navigate('me')}/>}
                {screen === 'history' && <HistoryScreen onBack={() => navigate('home')}/>}
            </div>
            {isRootScreen && (
                <div className="shrink-0 border-t" style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}>
                    <div className="flex items-center justify-around h-16 px-6">
                        <button
                            onClick={() => navigate('home')}
                            className="flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors"
                            style={{color: screen === 'home' ? 'var(--accent-primary)' : 'var(--text-secondary)'}}
                        >
                            <Wallet size={24} strokeWidth={screen === 'home' ? 2.5 : 2}/>
                            <span className="text-[10px] font-medium">Wallet</span>
                        </button>
                        <button
                            onClick={() => navigate('me')}
                            className="flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors"
                            style={{color: screen === 'me' ? 'var(--accent-primary)' : 'var(--text-secondary)'}}
                        >
                            <UserIcon size={24} strokeWidth={screen === 'me' ? 2.5 : 2}/>
                            <span className="text-[10px] font-medium">Me</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

export default function StendlyApp() {
    return (
        <div className="flex justify-center min-h-screen w-full bg-(--bg-primary)">
            <div
                className="relative overflow-hidden w-full max-w-120 h-svh bg-(--bg-primary) flex flex-col mx-auto sm:border-x shadow-2xl"
                style={{borderColor: 'var(--border-subtle)'}}
            >
                <div className="flex-1 overflow-hidden flex flex-col">
                    <AuthGate>
                        <ProfileProvider>
                            <Suspense
                                fallback={<div className="flex flex-col items-center justify-center w-full h-full">
                                    <Loader2 size={32} className="animate-spin" color="var(--accent-primary)"/></div>}>
                                <AppShell/>
                            </Suspense>
                        </ProfileProvider>
                    </AuthGate>
                </div>
                <Toaster/>
            </div>
        </div>
    )
}
