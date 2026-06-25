'use client'

import {useState} from 'react'
import {Check, CheckCheck, Copy} from 'lucide-react'
import type {PaymentResult} from './PaymentConfirmScreen'
import {formatCents} from '@/lib/utils'

interface SuccessScreenProps {
    onHome: () => void
    result: PaymentResult | null
}

export default function SuccessScreen({onHome, result}: SuccessScreenProps) {
    const [copied, setCopied] = useState(false)

    const txId = result?.transactionPublicId ?? null
    const amountLabel = result ? formatCents(result.amountSentCents) : ''
    const toLabel = result?.recipientLabel ?? 'Recipient'
    const feeCents = result?.feeCents ?? 0
    const newBalanceCents = result?.newBalanceCents ?? null

    const handleCopy = async () => {
        if (!txId) return
        try {
            await navigator.clipboard.writeText(txId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            setCopied(false)
        }
    }

    const detailRows = [
        ...(feeCents > 0 ? [{label: 'Fee', value: formatCents(feeCents)}] : []),
        ...(newBalanceCents !== null
            ? [{label: 'New balance', value: formatCents(newBalanceCents)}]
            : []),
    ]

    return (
        <div
            className="flex flex-col w-full h-full items-center"
            style={{backgroundColor: 'var(--bg-primary)'}}
        >
            <div className="flex-1 flex flex-col items-center justify-center px-4 w-full">
                <div
                    className="flex items-center justify-center rounded-full"
                    style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, #6C5CE7 0%, #00B894 100%)',
                        boxShadow: '0 0 40px rgba(0,184,148,0.3)',
                        padding: '2px',
                    }}
                    role="img"
                    aria-label="Payment successful"
                >
                    <div
                        className="flex items-center justify-center rounded-full w-full h-full"
                        style={{backgroundColor: 'var(--bg-primary)'}}
                    >
                        <Check size={32} color="var(--text-primary)" strokeWidth={2.5}/>
                    </div>
                </div>

                <h1
                    className="font-bold text-center"
                    style={{fontSize: '24px', color: 'var(--text-primary)', marginTop: '24px'}}
                >
                    Payment Sent!
                </h1>

                <p
                    className="text-center"
                    style={{fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px'}}
                >
                    {amountLabel} to {toLabel}
                </p>

                {(txId || detailRows.length > 0) && (
                    <div
                        className="w-full rounded-2xl overflow-hidden card-shadow"
                        style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            marginTop: '32px',
                        }}
                    >
                        {txId && (
                            <>
                                <div
                                    className="flex flex-col px-4"
                                    style={{paddingTop: '16px', paddingBottom: '16px'}}
                                >
                  <span
                      className="text-xs font-medium uppercase tracking-wider mb-2"
                      style={{color: 'var(--text-hint)'}}
                  >
                    Transaction ID
                  </span>
                                    <div className="flex items-center justify-between gap-2">
                    <span
                        className="text-sm font-medium font-mono"
                        style={{color: 'var(--text-primary)'}}
                    >
                      {txId}
                    </span>
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center justify-center rounded-lg transition-opacity active:opacity-70 shrink-0"
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                backgroundColor: 'var(--bg-elevated)',
                                            }}
                                            aria-label={copied ? 'Copied' : 'Copy transaction ID'}
                                        >
                                            {copied ? (
                                                <CheckCheck size={15} color="var(--accent-green)" strokeWidth={2}/>
                                            ) : (
                                                <Copy size={15} color="var(--text-secondary)" strokeWidth={1.8}/>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {result?.note && (
                            <>
                                <div
                                    className="flex flex-col px-4"
                                    style={{paddingTop: '16px', paddingBottom: '16px'}}
                                >
                  <span
                      className="text-xs font-medium uppercase tracking-wider mb-2"
                      style={{color: 'var(--text-hint)'}}
                  >
                    Note
                  </span>
                                    <div className="flex items-center justify-between gap-2">
                    <span
                        className="text-sm font-medium font-mono"
                        style={{color: 'var(--text-primary)'}}
                    >
                      {result.note}
                    </span>
                                    </div>
                                </div>
                                {detailRows.length > 0 && (
                                    <div
                                        className="mx-4"
                                        style={{height: '1px', backgroundColor: 'var(--border-subtle)'}}
                                        role="separator"
                                    />
                                )}
                            </>
                        )}

                        {detailRows.map((row, index) => (
                            <div key={row.label}>
                                <div className="flex items-center justify-between px-4" style={{height: '52px'}}>
                  <span className="text-sm" style={{color: 'var(--text-secondary)'}}>
                    {row.label}
                  </span>
                                    <span
                                        className="text-sm font-medium"
                                        style={{color: 'var(--text-primary)'}}
                                    >
                    {row.value}
                  </span>
                                </div>
                                {index < detailRows.length - 1 && (
                                    <div
                                        className="mx-4"
                                        style={{height: '1px', backgroundColor: 'var(--border-subtle)'}}
                                        role="separator"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full px-6" style={{paddingBottom: '40px'}}>
                <button
                    onClick={onHome}
                    className="gradient-btn w-full font-semibold text-base rounded-2xl transition-all active:scale-[0.98]"
                    style={{
                        height: '56px',
                        color: 'var(--accent-primary-text)',
                    }}
                >
                    Back to Home
                </button>
            </div>
        </div>
    )
}
