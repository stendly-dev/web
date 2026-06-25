'use client'

import {useState} from 'react'
import {ArrowDownLeft, ArrowLeft, ArrowUpRight, CheckCheck, Copy, Loader2} from 'lucide-react'
import {useInfiniteQuery} from '@tanstack/react-query'
import {api} from '@/lib/api'
import {useProfile} from '@/contexts/ProfileContext'
import {formatCents, txCounterpartyLabel} from '@/lib/utils'
import {queryKeys} from '@/lib/queryKeys'

interface HistoryScreenProps {
    onBack: () => void
}

type DirectionFilter = 'all'

const TAKE = 20

function formatDateTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
}

function statusBadgeStyle(status: string): { bg: string; color: string } {
    const s = status?.toLowerCase() || '';
    switch (s) {
        case 'completed':
            return {bg: 'rgba(0,200,140,0.12)', color: 'var(--accent-green)'}
        case 'pending':
            return {bg: 'rgba(108,92,231,0.12)', color: 'var(--accent-primary)'}
        case 'failed':
            return {bg: 'rgba(255,71,87,0.12)', color: 'var(--accent-red)'}
        case 'cancelled':
            return {bg: 'rgba(255,255,255,0.06)', color: 'var(--text-hint)'}
        default:
            return {bg: 'rgba(255,255,255,0.06)', color: 'var(--text-hint)'}
    }
}

export default function HistoryScreen({onBack}: HistoryScreenProps) {
    const {profile} = useProfile()
    const [direction, setDirection] = useState<DirectionFilter>('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error,
    } = useInfiniteQuery({
        queryKey: queryKeys.transactionsInfinite(profile?.id ?? '', direction),
        queryFn: async ({pageParam}) => {
            if (!profile?.id) return {transactions: [], total: 0, skip: 0, take: TAKE, hasMore: false}
            return api.transactions.history(profile.id, {
                skip: pageParam,
                take: TAKE,
                direction: direction === 'all' ? undefined : direction,
            })
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!allPages || !Array.isArray(allPages)) return undefined;
            const loaded = allPages.reduce((sum, p) => {
                if (!p || !Array.isArray(p.transactions)) return sum;
                return sum + p.transactions.length;
            }, 0)
            return lastPage?.hasMore ? loaded : undefined
        },
        initialPageParam: 0,
        enabled: !!profile?.id,
    })

    const txs = data?.pages?.flatMap(p => {
        if (!p || !Array.isArray(p.transactions)) return [];
        return p.transactions.filter(tx => tx != null);
    }) ?? []

    const total = data?.pages?.[0]?.total ?? 0

    const handleDirectionChange = (dir: DirectionFilter) => {
        setDirection(dir)
        setExpandedId(null)
    }

    const handleLoadMore = () => {
        if (!isFetchingNextPage && hasNextPage) fetchNextPage()
    }

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
        } catch {
            setCopiedId(null)
        }
    }

    const dirFilters: { id: DirectionFilter; label: string }[] = [
        {id: 'all', label: 'All'}
    ]

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center justify-between px-4 pt-6 pb-4 relative z-10">
                <div className="w-10 flex justify-start">
                    <button onClick={onBack}
                            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                            style={{
                                width: '36px',
                                height: '36px',
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)'
                            }}>
                        <ArrowLeft size={18} color="var(--text-primary)" strokeWidth={1.8}/>
                    </button>
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                      style={{color: 'var(--text-primary)'}}>History</span>
                <div className="w-10 flex justify-end"></div>
            </div>

            <div className="flex items-center gap-2 px-4 mb-4">
                {dirFilters.map((f) => (
                    <button
                        key={f.id}
                        onClick={() => handleDirectionChange(f.id)}
                        className="rounded-full text-sm font-medium transition-all active:opacity-70"
                        style={{
                            height: '32px',
                            paddingLeft: '14px',
                            paddingRight: '14px',
                            backgroundColor:
                                direction === f.id ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                            color:
                                direction === f.id ? 'var(--accent-primary-text)' : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                        }}
                        aria-pressed={direction === f.id}
                    >
                        {f.label}
                    </button>
                ))}
                {total > 0 && !isLoading && (
                    <span
                        className="text-xs ml-auto"
                        style={{color: 'var(--text-hint)'}}
                    >
            {total} total
          </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4">
                {isLoading ? (
                    <div
                        className="rounded-2xl overflow-hidden card-shadow"
                        style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}
                    >
                        {Array.from({length: 6}).map((_, i) => (
                            <div key={i}>
                                <div className="flex items-center gap-3 px-4" style={{height: '68px'}}>
                                    <div
                                        className="skeleton rounded-full shrink-0"
                                        style={{width: '40px', height: '40px'}}
                                        aria-hidden="true"
                                    />
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="skeleton rounded" style={{width: '110px', height: '13px'}}
                                             aria-hidden="true"/>
                                        <div className="skeleton rounded" style={{width: '70px', height: '11px'}}
                                             aria-hidden="true"/>
                                    </div>
                                    <div className="skeleton rounded" style={{width: '56px', height: '13px'}}
                                         aria-hidden="true"/>
                                </div>
                                {i < 5 && (
                                    <div className="mx-4"
                                         style={{height: '1px', backgroundColor: 'var(--border-subtle)'}}/>
                                )}
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 pt-12">
                        <p className="text-sm" style={{color: 'var(--accent-red)'}}>
                            {error instanceof Error ? error.message : 'Failed to load history'}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-sm font-medium transition-opacity active:opacity-70"
                            style={{color: 'var(--accent-primary)'}}
                        >
                            Retry
                        </button>
                    </div>
                ) : txs.length === 0 ? (
                    <div className="flex items-center justify-center pt-16">
                        <p className="text-sm" style={{color: 'var(--text-hint)'}}>
                            No transactions found
                        </p>
                    </div>
                ) : (
                    <div
                        className="rounded-2xl overflow-hidden card-shadow"
                        style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}
                    >
                        {txs.map((tx, index) => {
                            const isExpanded = expandedId === tx.id
                            const label = txCounterpartyLabel(tx, profile ?? undefined)
                            const statusStyle = statusBadgeStyle(tx.status)
                            const amountColor =
                                tx.direction === 'received' ? 'var(--accent-green)' : 'var(--accent-red)'

                            return (
                                <div key={tx.id}>
                                    <button
                                        className="w-full text-left"
                                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="flex items-center gap-3 px-4" style={{height: '68px'}}>
                                            <div
                                                className="flex items-center justify-center rounded-full shrink-0"
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    backgroundColor: 'var(--bg-elevated)',
                                                }}
                                                aria-hidden="true"
                                            >
                                                {tx.direction === 'received' ? (
                                                    <ArrowDownLeft size={18} color="var(--accent-green)"
                                                                   strokeWidth={2}/>
                                                ) : (
                                                    <ArrowUpRight size={18} color="var(--accent-red)" strokeWidth={2}/>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className="text-sm font-medium truncate"
                                                    style={{color: 'var(--text-primary)'}}
                                                >
                                                    {label}
                                                </p>
                                                <p className="text-xs" style={{color: 'var(--text-hint)'}}>
                                                    {formatDateTime(tx.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                            className="text-sm font-semibold"
                            style={{color: amountColor}}
                        >
                          {formatCents(tx.amountCents)}
                        </span>
                                                <span
                                                    className="text-xs font-medium px-2 rounded-full"
                                                    style={{
                                                        backgroundColor: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        lineHeight: '18px',
                                                    }}
                                                >
                          {tx.status}
                        </span>
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div
                                            className="px-4 pb-4 flex flex-col gap-3"
                                            style={{borderTop: '1px solid var(--border-subtle)'}}
                                        >
                                            <div className="flex flex-col gap-2 pt-3">
                                                {[
                                                    {label: 'Transaction ID', value: tx.id, copyable: true},
                                                    {
                                                        label: 'Type',
                                                        value: (tx.type ?? 'unknown').replace(/_/g, ' '),
                                                        copyable: false,
                                                    },
                                                    {
                                                        label: 'Fee',
                                                        value: (tx.feeCents ?? 0) > 0 ? formatCents(tx.feeCents ?? 0) : '$0.00',
                                                        copyable: false,
                                                    },
                                                    ...(tx.note ? [{
                                                        label: 'Note',
                                                        value: tx.note,
                                                        copyable: false,
                                                    }] : []),
                                                    ...(tx.completedAt
                                                        ? [{
                                                            label: 'Confirmed',
                                                            value: formatDateTime(tx.completedAt),
                                                            copyable: false,
                                                        }]
                                                        : []),
                                                ].map((row) => (
                                                    <div key={row.label}
                                                         className="flex items-center justify-between gap-2">
                            <span className="text-xs shrink-0" style={{color: 'var(--text-hint)'}}>
                              {row.label}
                            </span>
                                                        <div className="flex items-center gap-2 min-w-0">
                              <span
                                  className="text-xs font-medium truncate font-mono"
                                  style={{color: 'var(--text-secondary)'}}
                              >
                                {row.value}
                              </span>
                                                            {row.copyable && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCopy(row.value, `${tx.id}-${row.label}`)
                                                                    }}
                                                                    className="shrink-0 flex items-center justify-center rounded transition-opacity active:opacity-70"
                                                                    style={{width: '22px', height: '22px'}}
                                                                    aria-label={`Copy ${row.label}`}
                                                                >
                                                                    {copiedId === `${tx.id}-${row.label}` ? (
                                                                        <CheckCheck size={13}
                                                                                    color="var(--accent-green)"
                                                                                    strokeWidth={2}/>
                                                                    ) : (
                                                                        <Copy size={13} color="var(--text-hint)"
                                                                              strokeWidth={1.8}/>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {index < txs.length - 1 && !isExpanded && (
                                        <div
                                            className="mx-4"
                                            style={{height: '1px', backgroundColor: 'var(--border-subtle)'}}
                                            role="separator"
                                        />
                                    )}
                                </div>
                            )
                        })}

                        {hasNextPage && (
                            <div
                                className="flex items-center justify-center"
                                style={{
                                    borderTop: '1px solid var(--border-subtle)',
                                    height: '52px',
                                }}
                            >
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isFetchingNextPage}
                                    className="flex items-center gap-2 text-sm font-medium transition-opacity active:opacity-70"
                                    style={{color: 'var(--accent-primary)', opacity: isFetchingNextPage ? 0.6 : 1}}
                                >
                                    {isFetchingNextPage ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin"/>
                                            Loading...
                                        </>
                                    ) : (
                                        'Load more'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{paddingBottom: '34px'}}/>
        </div>
    )
}