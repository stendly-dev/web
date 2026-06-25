'use client';

import {useEffect, useState} from 'react'
import {ArrowLeft, Loader2} from 'lucide-react'
import {useProfile} from '@/contexts/ProfileContext'
import {Switch} from '@/components/ui/switch'

interface ProfileScreenProps {
    onBack: () => void
}

export default function ProfileScreen({onBack}: ProfileScreenProps) {
    const {profile, updateProfile, checkUsernameAvailable} = useProfile();
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showDisplayName, setShowDisplayName] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setDisplayName(profile.displayName && profile.displayName !== "Anonymous" ? profile.displayName : '');
            setShowDisplayName(profile.displayName !== "Anonymous")
        }
    }, [profile]);

    useEffect(() => {
        if (!username || username === profile?.username) {
            setUsernameStatus('idle');
            return;
        }

        if (username.length < 3) {
            setUsernameStatus('idle');
            return;
        }

        const timer = setTimeout(async () => {
            setUsernameStatus('checking');
            try {
                const isAvailable = await checkUsernameAvailable(username);
                setUsernameStatus(isAvailable ? 'available' : 'taken');
            } catch (e) {
                setUsernameStatus('idle');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [username, profile?.username, checkUsernameAvailable]);

    const handleSave = async () => {
        if (usernameStatus === 'taken') return;
        setSaving(true);
        setError(null);
        try {
            await updateProfile({
                username: username.trim() || null,
                displayName: showDisplayName ? displayName.trim() || null : "Anonymous",
            });
            onBack()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save profile')
        } finally {
            setSaving(false)
        }
    };

    return <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
        <div className="flex items-center px-4 relative" style={{height: '60px'}}>
            <button onClick={onBack} className="relative z-10 flex items-center justify-center rounded-full"
                    style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                <ArrowLeft size={18} color="var(--text-primary)"/>
            </button>
            <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                style={{color: 'var(--text-primary)'}}>Edit Profile</span>
        </div>

        <div className="flex flex-col flex-1 px-4 gap-6 overflow-y-auto mt-4">
            <div className="rounded-2xl overflow-hidden card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <label className="flex flex-col px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{color: 'var(--text-secondary)'}}>Username</span>
                        {usernameStatus === 'checking' && <Loader2 size={12} className="animate-spin text-gray-400"/>}
                        {usernameStatus === 'available' && <span className="text-xs text-green-500">Available</span>}
                        {usernameStatus === 'taken' && <span className="text-xs text-red-500">Taken</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-sm font-medium" style={{color: 'var(--text-hint)'}}>@</span>
                        <input type="text" value={username}
                               onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32))}
                               placeholder="username"
                               className="bg-transparent border-none outline-none text-sm font-medium w-full"
                               style={{color: 'var(--text-primary)'}}/>
                    </div>
                </label>
            </div>

            <div className="flex items-center justify-between px-4 py-4 rounded-2xl card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="flex flex-col">
					<span className="text-sm font-medium"
                          style={{color: 'var(--text-primary)'}}>Show Display Name</span>
                    <span className="text-xs mt-1" style={{color: 'var(--text-secondary)'}}>Visible to others during transfers</span>
                </div>
                <Switch checked={showDisplayName} onCheckedChange={setShowDisplayName}/>
            </div>

            {showDisplayName && <div className="rounded-2xl overflow-hidden card-shadow"
                                     style={{
                                         backgroundColor: 'var(--bg-card)',
                                         border: '1px solid var(--border-subtle)'
                                     }}>
                <label className="flex flex-col px-4 py-3">
                    <span className="text-xs font-medium mb-1.5"
                          style={{color: 'var(--text-secondary)'}}>Display Name</span>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                           placeholder="Your name"
                           className="bg-transparent border-none outline-none text-sm font-medium w-full"
                           style={{color: 'var(--text-primary)'}}/>
                </label>
            </div>}

            {error && <p className="text-xs text-center" style={{color: 'var(--accent-red)'}}>{error}</p>}
        </div>

        <div className="px-4 flex flex-col gap-2" style={{paddingTop: '16px', paddingBottom: '34px'}}>
            <button onClick={handleSave} disabled={saving || usernameStatus === 'taken'}
                    className="gradient-btn w-full font-semibold text-base rounded-2xl transition-all flex items-center justify-center gap-2"
                    style={{
                        height: '56px',
                        color: 'var(--accent-primary-text)',
                        opacity: (saving || usernameStatus === 'taken') ? 0.5 : 1
                    }}>
                {saving ? <Loader2 size={18} className="animate-spin"/> : 'Save Changes'}
            </button>
        </div>
    </div>
}
