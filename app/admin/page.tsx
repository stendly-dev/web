'use client'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {api, checkBackendHealth, clearTokens} from '@/lib/api'
import {Check, Loader2, RefreshCw, ShieldAlert, WifiOff, X} from 'lucide-react'
import {useToast} from '@/hooks/use-toast'
import {Toaster} from '@/components/ui/toaster'

type AdminAuthState = 'checking' | 'prompt_secret' | 'authenticated' | 'unauthorized' | 'backend_error'

function safeExternalUrl(value: string): string | null {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
        return null
    }
}

export default function AdminPage() {
    const router = useRouter()
    const [authState, setAuthState] = useState<AdminAuthState>('checking')
    const [pending, setPending] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const {toast} = useToast()
    const [secretKey, setSecretKey] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)

    useEffect(() => {
        (async () => {
            await checkAuth()
        })()
    }, [])

    const checkAuth = async () => {
        const healthy = await checkBackendHealth()
        if (!healthy) {
            setBackendError('Cannot connect to Stendly API. Please check your internet connection.')
            setAuthState('backend_error')
            return
        }

        try {
            const profile = await api.users.me()
            if (profile.userProfile?.role === 'Admin') {
                setAuthState('prompt_secret')
            } else {
                setAuthState('unauthorized')
            }
        } catch (err: any) {
            if (err?.status === 401 || err?.status === 403) {
                router.replace('/auth?returnTo=/admin')
            } else {
                setBackendError('Failed to load profile. Please try again.')
                setAuthState('backend_error')
            }
        }
    }

    const handleRetry = async () => {
        setRetrying(true)
        setBackendError(null)
        const healthy = await checkBackendHealth()
        if (healthy) {
            await checkAuth()
        } else {
            setBackendError('Still unable to connect. Please try again later.')
        }
        setRetrying(false)
    }

    const handleSecretSubmit = async () => {
        if (!secretKey.trim()) return
        setSubmitting(true)
        try {
            await api.admin.verifySecret(secretKey)
            setAuthState('authenticated')
            loadPending()
        } catch (err) {
            toast({title: 'Error', description: 'Invalid secret password', variant: 'destructive'})
        } finally {
            setSubmitting(false)
        }
    }

    const loadPending = async () => {
        setLoading(true)
        try {
            const data = await api.admin.getPending()
            setPending(data)
        } catch (err) {
            toast({title: 'Error', description: 'Failed to load pending applications', variant: 'destructive'})
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id: string) => {
        if (!confirm("Approve this business? This action is irreversible.")) return
        try {
            await api.admin.approve(id)
            toast({title: 'Approved', description: 'Business application approved successfully.'})
            await loadPending()
        } catch (error) {
            toast({title: 'Error', description: 'Could not approve the application.', variant: 'destructive'})
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm("Reject this business? This action is irreversible.")) return
        try {
            await api.admin.reject(id)
            toast({title: 'Rejected', description: 'Business application rejected.'})
            await loadPending()
        } catch (error) {
            toast({title: 'Error', description: 'Could not reject the application.', variant: 'destructive'})
        }
    }

    if (authState === 'checking' && !backendError) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 className="animate-spin" style={{color: 'var(--accent-primary)'}} size={32}/>
            </div>
        )
    }

    if (authState === 'backend_error' || backendError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-full max-w-md rounded-3xl p-8 flex flex-col items-center text-center card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,71,87,0.3)'}}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                         style={{backgroundColor: 'rgba(255,71,87,0.1)'}}>
                        <WifiOff size={32} style={{color: 'var(--accent-red)'}}/>
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2>
                    <p className="text-sm mb-6"
                       style={{color: 'var(--text-secondary)'}}>{backendError || 'Cannot connect to Stendly API.'}</p>
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
                <Toaster/>
            </div>
        )
    }

    if (authState === 'unauthorized') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                     style={{backgroundColor: 'rgba(255, 71, 87, 0.1)'}}>
                    <ShieldAlert style={{color: 'var(--accent-red)'}} size={32}/>
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Access Denied</h2>
                <p className="text-sm mb-8 text-center" style={{color: 'var(--text-secondary)'}}>You must be logged in
                    as an administrator to view this page.</p>
                <Toaster/>
            </div>
        )
    }

    if (authState === 'prompt_secret') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 font-sans"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="w-full max-w-sm">
                    <input
                        type="password"
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSecretSubmit()}
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all mb-4 text-center tracking-widest"
                        style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                        }}
                        autoFocus
                    />
                    <button onClick={handleSecretSubmit} disabled={submitting || !secretKey}
                            className="gradient-btn w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                            style={{color: 'var(--accent-primary-text)'}}>
                        {submitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Unlock'}
                    </button>
                </div>
                <Toaster/>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-10 font-sans"
             style={{backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'}}>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold" style={{color: 'var(--text-primary)'}}>Admin: KYB Moderation</h1>
                <button onClick={() => {
                    clearTokens();
                    window.location.reload();
                }} className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        style={{backgroundColor: 'rgba(255, 71, 87, 0.1)', color: 'var(--accent-red)'}}>
                    Log Out
                </button>
            </div>
            <div className="rounded-2xl overflow-hidden card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{
                            backgroundColor: 'var(--bg-elevated)',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                        <tr>
                            <th className="px-6 py-4 font-semibold" style={{color: 'var(--text-secondary)'}}>Business
                                Name
                            </th>
                            <th className="px-6 py-4 font-semibold" style={{color: 'var(--text-secondary)'}}>Website
                            </th>
                            <th className="px-6 py-4 font-semibold" style={{color: 'var(--text-secondary)'}}>Email</th>
                            <th className="px-6 py-4 font-semibold"
                                style={{color: 'var(--text-secondary)'}}>Description
                            </th>
                            <th className="px-6 py-4 font-semibold text-right"
                                style={{color: 'var(--text-secondary)'}}>Actions
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center">
                                    <Loader2 className="animate-spin mx-auto" style={{color: 'var(--accent-primary)'}}
                                             size={24}/>
                                </td>
                            </tr>
                        ) : pending.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center"
                                    style={{color: 'var(--text-secondary)'}}>
                                    No pending applications.
                                </td>
                            </tr>
                        ) : (
                            pending.map((m, index) => (
                                <tr key={m.id}
                                    style={{borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)'}}>
                                    <td className="px-6 py-4 font-medium"
                                        style={{color: 'var(--text-primary)'}}>{m.name}</td>
                                    <td className="px-6 py-4">
                                        <a href={safeExternalUrl(m.website) ?? undefined} target="_blank" rel="noopener noreferrer"
                                           className="hover:underline" style={{color: 'var(--accent-primary)'}}>
                                            {m.website}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4"
                                        style={{color: 'var(--text-secondary)'}}>{m.contactEmail}</td>
                                    <td className="px-6 py-4 max-w-xs truncate" title={m.description}
                                        style={{color: 'var(--text-secondary)'}}>
                                        {m.description}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleApprove(m.id)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                                            style={{
                                                backgroundColor: 'rgba(0, 200, 140, 0.1)',
                                                color: 'var(--accent-green)'
                                            }}
                                            aria-label={`Approve ${m.name}`}
                                        >
                                            <Check size={16}/>
                                        </button>
                                        <button
                                            onClick={() => handleReject(m.id)}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                                            style={{
                                                backgroundColor: 'rgba(255, 71, 87, 0.1)',
                                                color: 'var(--accent-red)'
                                            }}
                                            aria-label={`Reject ${m.name}`}
                                        >
                                            <X size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
            <Toaster/>
        </div>
    )
}
