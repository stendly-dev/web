'use client';

import {ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, QrCode} from 'lucide-react'
import {useProfile} from '@/contexts/ProfileContext'
import {api} from '@/lib/api'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/lib/queryKeys'
import {formatCents, txCounterpartyLabel} from '@/lib/utils'
import {isDesktopWeb} from '@/lib/platform'

interface HomeScreenProps {
    onSend: () => void
    onReceive: () => void
    onScan: () => void
    onScanResult: (text: string) => void
    onHistory: () => void
}

function formatTxTime(iso: string): string {
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    if (Math.floor(diffHr / 24) === 1) return 'yesterday';
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
}

export default function HomeScreen({onSend, onReceive, onScan, onHistory}: HomeScreenProps) {
    const {profile: contextProfile, txsLoading} = useProfile();

    const {data: accountData} = useQuery({
        queryKey: queryKeys.profile,
        queryFn: () => api.users.me(),
        staleTime: 15000,
        refetchInterval: 15000,
        enabled: !!contextProfile?.id,
    });

    const profile = accountData ? {
        ...contextProfile,
        id: accountData.id,
        username: accountData.userProfile?.username ?? null,
        displayName: accountData.userProfile?.displayName ?? null,
        status: accountData.status as any,
        balanceCents: contextProfile?.balanceCents ?? 0,
        solanaAddress: accountData.solanaAddress,
        primaryAuthMethod: accountData.primaryAuthMethod,
        role: accountData.userProfile?.role ?? 'user'
    } : contextProfile;

    const {data: recentTxsData} = useQuery({
        queryKey: queryKeys.transactions(profile?.id ?? '', undefined),
        queryFn: () => api.transactions.history(profile!.id, {take: 5}),
        staleTime: 15000,
        refetchInterval: 15000,
        enabled: !!profile?.id,
    });

    const recentTxs = recentTxsData?.transactions ?? [];

    const handleScanClick = () => {
        onScan()
    };

    const balanceLabel = profile ? formatCents(profile.balanceCents) : '$0';

    return <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
        <div className="flex flex-col items-center px-4 pt-8 pb-8">
            <span className="text-xs font-medium uppercase tracking-widest mb-2"
                  style={{color: 'var(--text-secondary)'}}>Total Balance</span>
            <span className="font-bold leading-none" style={{
                fontSize: '48px',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
            }}>{balanceLabel}</span>
        </div>

        <div className="flex gap-3 px-4 mb-8">
            {[
                {icon: <QrCode size={22}/>, label: 'Scan', action: handleScanClick},
                {icon: <ArrowUp size={22}/>, label: 'Send', action: onSend},
                {icon: <ArrowDown size={22}/>, label: 'Receive', action: onReceive},
            ].map(({icon, label, action}) => <button key={label} onClick={action}
                                                     disabled={isDesktopWeb() && label == 'Scan'}
                                                     className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl transition-opacity active:opacity-70"
                                                     style={{
                                                         backgroundColor: isDesktopWeb() && label == 'Scan' ? '' : 'var(--bg-card)',
                                                         border: '1px solid var(--border-subtle)',
                                                         minHeight: '80px'
                                                     }}>
                <span style={{color: 'var(--text-primary)'}}>{icon}</span>
                <span className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>{label}</span>
            </button>)}
        </div>

        <div className="flex-1 px-4 overflow-y-auto pb-4">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium"
                      style={{color: 'var(--text-secondary)'}}>Recent Transactions</span>
                <button onClick={onHistory} className="text-sm font-medium"
                        style={{color: 'var(--accent-primary)'}}>All
                </button>
            </div>
            <div className="rounded-2xl overflow-hidden card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                {txsLoading && recentTxs.length === 0 ?
                    <div className="p-4 text-center text-sm"
                         style={{color: 'var(--text-hint)'}}>Loading...</div> : recentTxs.length === 0 ?
                        <div className="p-4 text-center text-sm" style={{color: 'var(--text-hint)'}}>No transactions
                            yet</div> : recentTxs.map((tx, index) => <div key={tx.id}>
                            <div className="flex items-center gap-3 px-4" style={{height: '64px'}}>
                                <div className="flex items-center justify-center rounded-full shrink-0"
                                     style={{width: '40px', height: '40px', backgroundColor: 'var(--bg-elevated)'}}>
                                    {tx.direction === 'received' ?
                                        <ArrowDownLeft size={18} color="var(--accent-green)"/> :
                                        <ArrowUpRight size={18} color="var(--accent-red)"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate"
                                       style={{color: 'var(--text-primary)'}}>{txCounterpartyLabel(tx, profile ?? undefined)}</p>
                                    <p className="text-xs"
                                       style={{color: 'var(--text-hint)'}}>{formatTxTime(tx.createdAt)}</p>
                                </div>
                                <span className="text-sm font-semibold shrink-0"
                                      style={{color: tx.direction === 'received' ? 'var(--accent-green)' : 'var(--accent-red)'}}>
            {formatCents(tx.amountCents, true)}
          </span>
                            </div>
                            {index < recentTxs.length - 1 && <div className="mx-4" style={{
                                height: '1px',
                                backgroundColor: 'var(--border-subtle)'
                            }}/>}
                        </div>)}
            </div>
        </div>
    </div>
}