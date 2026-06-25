'use client'

import React from 'react'
import {ChevronRight, LogOut, Settings, Shield, Smartphone} from 'lucide-react'
import {useProfile} from '@/contexts/ProfileContext'
import {api} from '@/lib/api'
import {deleteLocalWallet} from '@/lib/wallet'
import {clearBackupAcknowledged} from '@/components/wallet/WalletBackupView'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface MeScreenProps {
    onProfile: () => void
    onPreferences: () => void
    onDevices: () => void
    onSecurity: () => void
}

export default function MeScreen({onProfile, onPreferences, onDevices, onSecurity}: MeScreenProps) {
    const {profile} = useProfile()

    const handleLogout = async () => {
        await deleteLocalWallet();
        clearBackupAcknowledged();
        await api.auth.logout();
        window.location.reload();
    };

    const initial = profile?.displayName && profile.displayName !== "Anonymous"
        ? profile.displayName.charAt(0).toUpperCase()
        : (profile?.username?.charAt(0).toUpperCase() ?? 'S')

    const displayName = profile?.displayName && profile.displayName !== "Anonymous"
        ? profile.displayName
        : (profile?.username ? `@${profile.username}` : 'Stendly')

    return (
        <div className="flex flex-col w-full h-full overflow-y-auto" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="px-4 pt-8 pb-6">
                <button onClick={onProfile}
                        className="w-full flex items-center gap-4 bg-transparent outline-none text-left">
                    <div className="rounded-full flex items-center justify-center text-2xl font-bold shrink-0" style={{
                        width: '72px',
                        height: '72px',
                        background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
                        color: 'var(--text-primary)'
                    }}>
                        {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold truncate"
                            style={{color: 'var(--text-primary)'}}>{displayName}</h2>
                        <p className="text-sm truncate mt-1"
                           style={{color: 'var(--text-secondary)'}}>@{profile?.username}</p>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full"
                         style={{backgroundColor: 'var(--bg-elevated)'}}>
                        <ChevronRight size={18} color="var(--text-secondary)"/>
                    </div>
                </button>
            </div>

            <div className="px-4 flex flex-col gap-4 pb-8">
                <div className="rounded-2xl overflow-hidden card-shadow flex flex-col"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <button onClick={onPreferences}
                            className="flex items-center justify-between px-4 py-4 transition-colors active:bg-white/5 text-left">
                        <div className="flex items-center gap-3">
                            <Settings size={20} color="var(--text-primary)"/>
                            <span className="text-sm font-medium"
                                  style={{color: 'var(--text-primary)'}}>Preferences</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-hint)"/>
                    </button>

                    <div className="h-px w-full" style={{backgroundColor: 'var(--border-subtle)'}}/>

                    <button onClick={onDevices}
                            className="flex items-center justify-between px-4 py-4 transition-colors active:bg-white/5 text-left">
                        <div className="flex items-center gap-3">
                            <Smartphone size={20} color="var(--text-primary)"/>
                            <span className="text-sm font-medium" style={{color: 'var(--text-primary)'}}>Devices</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-hint)"/>
                    </button>

                    <div className="h-px w-full" style={{backgroundColor: 'var(--border-subtle)'}}/>

                    <button onClick={onSecurity}
                            className="flex items-center justify-between px-4 py-4 transition-colors active:bg-white/5 text-left">
                        <div className="flex items-center gap-3">
                            <Shield size={20} color="var(--text-primary)"/>
                            <span className="text-sm font-medium" style={{color: 'var(--text-primary)'}}>Security</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-hint)"/>
                    </button>
                </div>

                <div className="mt-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-opacity active:opacity-70"
                                style={{
                                    backgroundColor: 'rgba(255,71,87,0.1)',
                                    border: '1px solid rgba(255,71,87,0.2)',
                                    color: 'var(--accent-red)'
                                }}>
                                <LogOut size={18}/>
                                <span className="text-sm font-semibold">Log Out</span>
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90%] max-w-100 rounded-3xl" style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                        }}>
                            <AlertDialogHeader>
                                <AlertDialogTitle style={{color: 'var(--text-primary)'}}>Are you absolutely
                                    sure?</AlertDialogTitle>
                                <AlertDialogDescription style={{color: 'var(--text-secondary)'}}>
                                    Logging out will remove your wallet keys from this device. You will need your Sync
                                    QR code or PIN to restore access.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                <AlertDialogCancel className="rounded-xl h-12 m-0 transition-colors" style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)'
                                }}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleLogout}
                                                   className="rounded-xl h-12 m-0 transition-colors" style={{
                                    backgroundColor: 'var(--accent-red)',
                                    color: '#fff',
                                    border: 'none'
                                }}>Yes, log out</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    )
}