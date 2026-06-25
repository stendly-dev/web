'use client'
import React, {useEffect, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import Link from 'next/link'
import {api, checkBackendHealth} from '@/lib/api'
import {
    AlertCircle,
    Building2,
    Key,
    LayoutDashboard,
    Loader2,
    RefreshCw,
    Terminal as TerminalIcon,
    Webhook,
    WifiOff
} from 'lucide-react'
import {Toaster} from '@/components/ui/toaster'
import {toast} from '@/hooks/use-toast'
import {useTheme} from 'next-themes'
import {captureProductEvent, identifyAnalyticsUser} from '@/lib/analytics';
import {getStoredAccountId} from '@/lib/api';

function SidebarNavItem({href, icon, label, active}: {
    href: string,
    icon: React.ReactNode,
    label: string,
    active: boolean
}) {
    const activeClass = "text-[var(--text-primary)] font-semibold";
    const inactiveClass = "text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium";
    return (
        <Link href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap w-full text-left ${active ? activeClass : inactiveClass}`}>
            <span style={{color: active ? 'var(--accent-primary)' : 'inherit'}}>{icon}</span>
            <span className="truncate">{label}</span>
        </Link>
    )
}

export default function B2BLayout({children}: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const {theme, setTheme} = useTheme()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [backendError, setBackendError] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)
    const [kybForm, setKybForm] = useState({businessName: '', website: '', contactEmail: '', description: ''})
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (theme === 'system') {
            setTheme('dark')
        }
    }, [theme, setTheme])

    useEffect(() => {
        (async () => {
            await loadProfile()
        })()
    }, [])

    const loadProfile = async () => {
        const healthy = await checkBackendHealth()
        if (!healthy) {
            setBackendError('Cannot connect to Stendly API. Please check your internet connection.');
            setLoading(false);
            return
        }
        setBackendError(null);
        setLoading(true)
        try {
            const res = await api.b2b.me()
            setProfile(res)
            const accountId = getStoredAccountId();
            if (accountId) await identifyAnalyticsUser(accountId, res.id);
            captureProductEvent('merchant_dashboard_loaded', {
                verification_status: res.verificationStatus,
                merchant_profile_exists: true,
            });
            if (res.verificationStatus === 0) captureProductEvent('kyb_form_viewed');
        } catch (err: any) {
            if (err?.status === 401) {
                router.replace('/auth?returnTo=/b2b')
            } else if (err?.status === 404) {
                setProfile(null)
                captureProductEvent('kyb_form_viewed');
            } else {
                setBackendError('Failed to load merchant profile. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleRetry = async () => {
        setRetrying(true);
        setBackendError(null);
        await loadProfile();
        setRetrying(false)
    }

    const handleKybSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        setSubmitting(true)
        try {
            captureProductEvent('kyb_submit_started', {
                has_website: Boolean(kybForm.website.trim()),
                has_description: Boolean(kybForm.description.trim()),
            });
            await api.b2b.submitKyb(kybForm);
            captureProductEvent('merchant_signup_ui_completed');
            await loadProfile()
        } catch (err) {
            toast({title: 'Error', description: 'Failed to submit application', variant: 'destructive'})
        } finally {
            setSubmitting(false)
        }
    }

    if (loading && !backendError) return <div className="min-h-screen flex items-center justify-center"
                                              style={{backgroundColor: 'var(--bg-primary)'}}><Loader2
        className="animate-spin" style={{color: 'var(--accent-primary)'}} size={32}/></div>
    if (backendError) return <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans"
                                  style={{backgroundColor: 'var(--bg-primary)'}}>
        <div className="w-full max-w-md rounded-3xl p-8 flex flex-col items-center text-center"
             style={{backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,71,87,0.3)'}}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                 style={{backgroundColor: 'rgba(255,71,87,0.1)'}}><WifiOff size={32}
                                                                           style={{color: 'var(--accent-red)'}}/></div>
            <h2 className="text-xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Connection Error</h2><p
            className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>{backendError}</p>
            <button onClick={handleRetry} disabled={retrying}
                    className="px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                    style={{color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)'}}>{retrying ?
                <Loader2 className="animate-spin" size={18}/> : <><RefreshCw size={18}/> Retry Connection</>}</button>
        </div>
        <Toaster/></div>
    if (!profile || profile.verificationStatus === 0) return <div
        data-analytics-state="kyb-form" className="min-h-screen flex items-center justify-center p-6 font-sans"
        style={{backgroundColor: 'var(--bg-primary)'}}>
        <div className="w-full max-w-lg rounded-3xl p-8"
             style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                 style={{backgroundColor: 'rgba(108, 92, 231, 0.1)'}}><Building2
                style={{color: 'var(--accent-primary)'}}/></div>
            <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Activate your account</h2><p
            className="text-sm mb-8" style={{color: 'var(--text-secondary)'}}>To comply with regulations and enable API
            access, please provide your business details.</p>
            <form onSubmit={handleKybSubmit} className="space-y-5">
                <div><label className="block text-sm font-semibold mb-1.5" style={{color: 'var(--text-primary)'}}>Business
                    Name</label><input required type="text" value={kybForm.businessName}
                                       onChange={e => setKybForm({...kybForm, businessName: e.target.value})}
                                       className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                                       style={{
                                           backgroundColor: 'var(--bg-elevated)',
                                           border: '1px solid var(--border-subtle)',
                                           color: 'var(--text-primary)'
                                       }} placeholder="Acme Corp"/></div>
                <div><label className="block text-sm font-semibold mb-1.5"
                            style={{color: 'var(--text-primary)'}}>Website</label><input required type="url"
                                                                                         value={kybForm.website}
                                                                                         onChange={e => setKybForm({
                                                                                             ...kybForm,
                                                                                             website: e.target.value
                                                                                         })}
                                                                                         className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                                                                                         style={{
                                                                                             backgroundColor: 'var(--bg-elevated)',
                                                                                             border: '1px solid var(--border-subtle)',
                                                                                             color: 'var(--text-primary)'
                                                                                         }}
                                                                                         placeholder="https://acme.com"/>
                </div>
                <div><label className="block text-sm font-semibold mb-1.5" style={{color: 'var(--text-primary)'}}>Support
                    Email</label><input required type="email" value={kybForm.contactEmail}
                                        onChange={e => setKybForm({...kybForm, contactEmail: e.target.value})}
                                        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                                        style={{
                                            backgroundColor: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)'
                                        }} placeholder="support@acme.com"/></div>
                <div><label className="block text-sm font-semibold mb-1.5" style={{color: 'var(--text-primary)'}}>Business
                    Description</label><textarea required value={kybForm.description}
                                                 onChange={e => setKybForm({...kybForm, description: e.target.value})}
                                                 className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all h-24 resize-none"
                                                 style={{
                                                     backgroundColor: 'var(--bg-elevated)',
                                                     border: '1px solid var(--border-subtle)',
                                                     color: 'var(--text-primary)'
                                                 }} placeholder="What does your business do?"/></div>
                <button type="submit" disabled={submitting}
                        className="w-full font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                        style={{
                            color: 'var(--accent-primary-text)',
                            backgroundColor: 'var(--accent-primary)'
                        }}>{submitting ?
                    <Loader2 className="animate-spin mx-auto" size={20}/> : 'Submit Application'}</button>
            </form>
        </div>
        <Toaster/></div>
    if (profile.verificationStatus === 1) return <div
        className="min-h-screen flex items-center justify-center p-6 font-sans"
        style={{backgroundColor: 'var(--bg-primary)'}}>
        <div className="w-full max-w-md rounded-3xl p-8 text-center"
             style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                 style={{backgroundColor: 'rgba(255, 171, 0, 0.1)'}}><AlertCircle style={{color: '#ffab00'}} size={32}/>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>Application Under Review</h2>
            <p className="text-sm mb-6" style={{color: 'var(--text-secondary)'}}>Your business details are currently
                being verified by our team. This usually takes 1-2 business days. We will notify you via email once
                approved.</p>
        </div>
    </div>

    const navItems = [
        {href: '/b2b', icon: <LayoutDashboard size={18}/>, label: 'Dashboard'},
        {href: '/b2b/api-keys', icon: <Key size={18}/>, label: 'API Keys'},
        {href: '/b2b/webhooks', icon: <Webhook size={18}/>, label: 'Webhooks'},
        {href: '/b2b/terminals', icon: <TerminalIcon size={18}/>, label: 'Terminals'}
    ]

    return (
        <div className="flex h-screen overflow-hidden font-sans"
             style={{backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'}}>
            <aside className="w-64 shrink-0 border-r hidden lg:flex flex-col"
                   style={{borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)'}}>
                <div className="flex-1 p-4 overflow-y-auto">
                    <nav className="flex flex-col gap-1">
                        {navItems.map((item) => <SidebarNavItem key={item.href} href={item.href} icon={item.icon}
                                                                label={item.label} active={pathname === item.href}/>)}
                    </nav>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto p-6 lg:p-10 min-w-0">
                <div className="mx-auto w-full max-w-4xl">
                    {children}
                </div>
            </main>
            <Toaster/>
        </div>
    )
}
