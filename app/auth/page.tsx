'use client'
import {Suspense, useEffect, useState} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import WebAuthScreen from '@/components/wallet/WebAuthScreen'
import {isAuthenticated} from '@/lib/auth'
import {api, ApiError, checkBackendHealth} from '@/lib/api'
import {Loader2, RefreshCw, WifiOff} from 'lucide-react'

function sanitizeReturnTo(url: string | null): string {
    if (!url) return '/';
    try {
        const decoded = decodeURIComponent(url).trim();
        if (/^(javascript|data|vbscript):/i.test(decoded)) return '/';

        const parsed = new URL(decoded, 'https://dummy.com');
        if (parsed.origin !== 'https://dummy.com') return '/';
        if (decoded.startsWith('//') || decoded.startsWith('\\\\') || decoded.startsWith('/\\')) return '/';
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return '/';
    }
}

function AuthContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = sanitizeReturnTo(searchParams.get('returnTo'))
    const [checking, setChecking] = useState(true)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)

    useEffect(() => {
        const checkAndAuth = async () => {
            if (isAuthenticated()) {
                router.replace(returnTo)
                return
            }

            api.auth.refresh().then(() => {
                router.replace(returnTo)
            }).catch((err) => {
                if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 400)) {
                    setChecking(false)
                } else {
                    setBackendError('Failed to authenticate. Please try again.')
                    setChecking(false)
                }
            })
        }

        checkAndAuth()
    }, [router, returnTo])

    const handleRetry = async () => {
        setRetrying(true)
        setBackendError(null)
        const healthy = await checkBackendHealth()
        if (healthy) {
            if (isAuthenticated()) {
                router.replace(returnTo)
            } else {
                api.auth.refresh().then(() => {
                    router.replace(returnTo)
                }).catch(() => {
                    setChecking(false)
                })
            }
        } else {
            setBackendError('Still unable to connect. Please try again later.')
        }
        setRetrying(false)
    }

    if (checking && !backendError) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 className="animate-spin" style={{color: 'var(--accent-primary)'}} size={32}/>
            </div>
        )
    }

    if (backendError) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center p-6 font-sans bg-(--bg-primary)">
                <div className="w-full max-w-md rounded-3xl p-8 flex flex-col items-center text-center card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,71,87,0.3)'}}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                         style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                        <WifiOff size={32} style={{color: 'var(--accent-red)'}}/>
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2>
                    <p className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>{backendError}</p>
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="gradient-btn px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                        style={{color: 'var(--accent-primary-text)'}}
                    >
                        {retrying ? <Loader2 className="animate-spin" size={18}/> : <><RefreshCw size={18}/> Retry
                            Connection</>}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex justify-center min-h-screen w-full bg-(--bg-primary)">
            <div
                className="relative overflow-hidden w-full max-w-120 h-svh bg-(--bg-primary) flex flex-col mx-auto sm:border-x shadow-2xl"
                style={{borderColor: 'var(--border-subtle)'}}
            >
                <WebAuthScreen onAuthed={() => router.replace(returnTo)}/>
            </div>
        </div>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={null}>
            <AuthContent/>
        </Suspense>
    )
}