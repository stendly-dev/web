'use client'
import {Suspense, useCallback, useEffect, useState} from 'react'
import {useSearchParams} from 'next/navigation'
import {QRCodeSVG} from 'qrcode.react'
import {AlertCircle, CheckCircle2, Loader2, WifiOff, XCircle} from 'lucide-react'
import {api, isBackendHealthy, onHealthChange} from '@/lib/api'
import {formatCents} from '@/lib/utils'
import {isMobilePlatform} from '@/lib/platform'
import ThemeToggle from '@/components/wallet/ThemeToggle'
import {captureProductEvent, moneyProperties} from '@/lib/analytics';

function CheckoutContent() {
    const searchParams = useSearchParams()
    const invoiceId = searchParams.get('invoice')
    const [invoice, setInvoice] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [isExpiredLocally, setIsExpiredLocally] = useState(false)

    const isTerminal = useCallback((status: string | undefined) => {
        return status === 'paid' || status === 'expired' || status === 'cancelled'
    }, [])

    useEffect(() => {
        if (invoiceId && isMobilePlatform()) {
            window.location.replace(`/?invoice=${invoiceId}`)
        }
    }, [invoiceId])

    useEffect(() => {
        return onHealthChange((healthy) => {
            if (!healthy && !backendError) {
                setBackendError('Lost connection to Stendly servers.')
            } else if (healthy && backendError) {
                setBackendError(null)
            }
        })
    }, [backendError])

    useEffect(() => {
        if (!invoiceId) {
            setError("Invalid payment link. Invoice ID is missing.")
            return
        }

        let stopped = false

        const fetchInvoice = async () => {
            if (!isBackendHealthy()) {
                setError("Cannot connect to Stendly servers. Please check your connection.")
                return
            }
            try {
                const data = await api.invoices.get(invoiceId)
                if (stopped) return
                setInvoice(data)
                setError(null)
                if (isTerminal(data.status)) {
                    stopped = true
                }
            } catch (err) {
                if (stopped) return
                if (!isBackendHealthy()) {
                    setError("Backend service unavailable. Please try again later.")
                } else {
                    setError("Invoice not found or has expired.")
                }
            }
        }

        fetchInvoice()

        const interval = setInterval(() => {
            if (!stopped && !isTerminal(invoice?.status) && isBackendHealthy()) {
                fetchInvoice()
            }
        }, 3000)

        return () => {
            stopped = true
            clearInterval(interval)
        }
    }, [invoiceId, invoice?.status, isTerminal])

    useEffect(() => {
        if (!invoice?.expiresAt || invoice.status !== 'pending') return
        const checkExpiry = () => {
            if (Date.now() > new Date(invoice.expiresAt).getTime()) {
                setIsExpiredLocally(true)
            }
        }
        checkExpiry()
        const interval = setInterval(checkExpiry, 1000)
        return () => clearInterval(interval)
    }, [invoice?.expiresAt, invoice?.status])

    useEffect(() => {
        if (invoice?.status === 'paid') {
            captureProductEvent('checkout_payment_observed', moneyProperties(invoice.expectedAmountCents, {
                product: 'merchant_payment',
                payment_status: invoice.status,
                event_source: 'checkout',
            }));
        }
    }, [invoice?.expectedAmountCents, invoice?.status]);

    const effectiveStatus = isExpiredLocally ? 'expired' : invoice?.status;

    if (error) {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-(--bg-primary) p-6 font-sans">
                <div className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggle/>
                </div>
                <div className="w-full max-w-100 flex flex-col items-center text-center">
                    <AlertCircle size={48} style={{color: 'var(--accent-red)'}} className="mb-6"/>
                    <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Payment Error</h2>
                    <p className="text-base mb-8" style={{color: 'var(--text-secondary)'}}>{error}</p>
                    {backendError ? (
                        <button onClick={() => window.location.reload()}
                                className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                                style={{backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)'}}>Retry
                            Connection</button>
                    ) : (
                        <a href="/"
                           className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                           style={{backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)'}}>Return to
                            Wallet</a>
                    )}
                </div>
            </div>
        )
    }

    if (backendError) {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-(--bg-primary) p-6 font-sans">
                <div className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggle/>
                </div>
                <div className="w-full max-w-100 flex flex-col items-center text-center">
                    <WifiOff size={48} style={{color: 'var(--accent-red)'}} className="mb-6"/>
                    <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2>
                    <p className="text-base mb-8" style={{color: 'var(--text-secondary)'}}>{backendError}</p>
                    <button onClick={() => window.location.reload()}
                            className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                            style={{backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)'}}>Retry
                    </button>
                </div>
            </div>
        )
    }

    if (!invoice) {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-(--bg-primary) p-6 font-sans">
                <Loader2 size={32} className="animate-spin" style={{color: 'var(--accent-primary)'}}/>
            </div>
        )
    }

    if (effectiveStatus === 'paid') {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-(--bg-primary) p-6 font-sans animate-in fade-in duration-500">
                <div className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggle/>
                </div>
                <div className="w-full max-w-100 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
                         style={{backgroundColor: 'rgba(0,200,140,0.1)'}}>
                        <CheckCircle2 size={48} style={{color: 'var(--accent-green)'}}/>
                    </div>
                    <h1 className="text-3xl font-bold mb-10" style={{color: 'var(--text-primary)'}}>Payment
                        Successful</h1>
                    <button
                        onClick={() => window.close()}
                        className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                        style={{backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)'}}
                    >
                        Close Window
                    </button>
                </div>
            </div>
        )
    }

    if (effectiveStatus === 'expired' || effectiveStatus === 'cancelled') {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-(--bg-primary) p-6 font-sans animate-in fade-in duration-500">
                <div className="absolute top-0 right-0 p-4 z-10">
                    <ThemeToggle/>
                </div>
                <div className="w-full max-w-100 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
                         style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                        <XCircle size={48} style={{color: 'var(--accent-red)'}}/>
                    </div>
                    <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>
                        Invoice {effectiveStatus === 'expired' ? 'Expired' : 'Cancelled'}
                    </h1>
                    <p className="text-base mb-10" style={{color: 'var(--text-secondary)'}}>
                        This invoice is no longer valid. Please request a new one.
                    </p>
                    <a href="/"
                       className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                       style={{backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)'}}>Return to
                        Wallet</a>
                </div>
            </div>
        )
    }

    const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
    const appBaseUrl = currentHost.includes('devnet')
        ? 'https://app-devnet.stendly.com'
        : 'https://app.stendly.com'
    const appPaymentUrl = `${appBaseUrl}/?invoice=${invoice.id}`

    const formattedTime = invoice?.expiresAt ? new Date(invoice.expiresAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    }) : '';

    return (
        <div className="relative min-h-screen w-full flex flex-col bg-(--bg-primary) font-sans">
            <div className="absolute top-0 right-0 p-4 z-10">
                <ThemeToggle/>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 mx-auto w-full max-w-100">

                <div className="flex flex-col items-center text-center w-full mb-10">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4"
                          style={{color: 'var(--text-hint)'}}>
                        Payment to
                    </span>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <h1 className="text-2xl font-semibold" style={{color: 'var(--text-primary)'}}>
                            {invoice.merchantName}
                        </h1>
                        <CheckCircle2 size={20} style={{color: 'var(--accent-green)'}}/>
                    </div>
                    <div className="text-[4rem] leading-none font-extrabold tracking-tighter"
                         style={{color: 'var(--text-primary)'}}>
                        {formatCents(invoice.expectedAmountCents)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-4xl mb-8 shadow-sm"
                     style={{border: '1px solid rgba(0,0,0,0.05)'}}>
                    <QRCodeSVG value={appPaymentUrl} size={220} level="H"/>
                </div>

                <p className="text-sm text-center mb-8 leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Scan this code with your <b style={{color: 'var(--text-primary)'}}>Stendly App</b><br/> or click the
                    button below.
                </p>

                <a
                    href={appPaymentUrl}
                    className="w-full font-bold rounded-2xl py-4 text-center transition-all active:scale-[0.98]"
                    style={{backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)'}}
                >
                    Pay with Stendly
                </a>

            </div>

            <div className="w-full p-6 flex flex-col items-center gap-2 mt-auto">
                <p className="text-xs font-medium" style={{color: 'var(--text-hint)'}}>
                    Invoice valid until {formattedTime}
                </p>
                <span className="text-xs font-semibold"
                      style={{color: 'var(--text-secondary)'}}>Powered by Stendly</span>
            </div>
        </div>
    )
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center p-4 font-sans"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 size={32} className="animate-spin" style={{color: 'var(--accent-primary)'}}/>
            </div>
        }>
            <CheckoutContent/>
        </Suspense>
    )
}
