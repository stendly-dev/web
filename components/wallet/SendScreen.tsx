'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowLeft, CheckCircle2, Loader2, User} from 'lucide-react'
import {api, ApiError, type ResolvedRecipient, type ResolveMethod} from '@/lib/api'
import {formatCents, parseAmountToCents} from '@/lib/utils'
import {useProfile} from '@/contexts/ProfileContext'
import {captureProductEvent, moneyProperties} from '@/lib/analytics';

export interface SendPayload {
    recipient: ResolvedRecipient
    resolveMethod: ResolveMethod
    resolveValue: string
    amountCents: number
    note: string | null
    paymentIntentId?: string
}

interface SendScreenProps {
    onBack: () => void
    onContinue: (payload: SendPayload) => void
    balanceCents: number
    initialRecipient?: string | null
}

const QUICK_AMOUNTS = [5, 10, 50, 100]
const MIN_CENTS = 10

function detectResolveMethod(value: string): { method: ResolveMethod; normalized: string } {
    const trimmed = value.trim()
    const cleanUsername = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return {method: 1, normalized: trimmed}
    return {method: 0, normalized: cleanUsername.toLowerCase()}
}

export default function SendScreen({onBack, onContinue, balanceCents, initialRecipient}: SendScreenProps) {
    const {profile} = useProfile()
    const [recipientInput, setRecipientInput] = useState('')
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [resolveState, setResolveState] = useState<'idle' | 'resolving' | 'resolved' | 'error'>('idle')
    const [resolvedRecipient, setResolvedRecipient] = useState<ResolvedRecipient | null>(null)
    const [resolveError, setResolveError] = useState<string | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastInsufficientBalanceEventRef = useRef<string | null>(null)

    useEffect(() => {
        captureProductEvent('send_started', {has_balance: balanceCents > 0});
    }, [balanceCents]);

    const resolveRecipient = useCallback(async (value: string) => {
        const trimmed = value.trim()
        if (!trimmed || trimmed.length < 2) return
        const {method, normalized} = detectResolveMethod(trimmed)
        setResolveState('resolving')
        try {
            const result = await api.transactions.resolve(method, normalized)
            if (profile?.id && result.accountId === profile.id) {
                setResolveError("You cannot send funds to yourself")
                setResolveState('error')
                return
            }
            setResolvedRecipient(result)
            setResolveState('resolved')
            captureProductEvent('send_recipient_entered', {recipient_type: result.isStendlyUser ? 'stendly_user' : 'solana_address'});
        } catch (err) {
            setResolveError(err instanceof ApiError ? err.message : 'User not found')
            setResolveState('error')
        }
    }, [profile?.id])

    useEffect(() => {
        if (initialRecipient) {
            setRecipientInput(initialRecipient)
            resolveRecipient(initialRecipient)
        }
    }, [initialRecipient, resolveRecipient])

    const handleRecipientChange = (raw: string) => {
        const sanitized = raw.replace(/[^a-zA-Z0-9_@]/g, '');
        setRecipientInput(sanitized)
        setResolveState('idle')
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => resolveRecipient(sanitized), 600)
    }

    const amountCents = parseAmountToCents(amount)
    const isZeroBalance = balanceCents === 0
    const exceedsBalance = amountCents > 0 && amountCents > balanceCents
    const belowMin = amountCents > 0 && amountCents < MIN_CENTS
    const canContinue = resolveState === 'resolved' && amountCents > 0 && !exceedsBalance && !belowMin && !isZeroBalance

    useEffect(() => {
        if (isZeroBalance) {
            if (lastInsufficientBalanceEventRef.current === 'zero') return
            lastInsufficientBalanceEventRef.current = 'zero'
            captureProductEvent('insufficient_balance', {
                reason: 'zero_balance',
                balance_cents: balanceCents,
                attempted_amount_cents: amountCents > 0 ? amountCents : null,
            })
            return
        }

        if (!exceedsBalance) return
        const eventKey = `exceeds:${amountCents}:${balanceCents}`
        if (lastInsufficientBalanceEventRef.current === eventKey) return
        lastInsufficientBalanceEventRef.current = eventKey
        captureProductEvent('insufficient_balance', moneyProperties(amountCents, {
            reason: 'amount_exceeds_balance',
            balance_cents: balanceCents,
            attempted_amount_cents: amountCents,
        }))
    }, [amountCents, balanceCents, exceedsBalance, isZeroBalance])

    const handleContinue = () => {
        if (!canContinue) return
        const {method, normalized} = detectResolveMethod(recipientInput)
        captureProductEvent('send_amount_entered', moneyProperties(amountCents, {
            has_balance: balanceCents > 0,
            balance_sufficient: balanceCents >= amountCents,
            recipient_type: resolvedRecipient!.isStendlyUser ? 'stendly_user' : 'external_wallet',
            payment_type: 'p2p_transfer',
        }));
        onContinue({
            recipient: resolvedRecipient!,
            resolveMethod: method,
            resolveValue: normalized,
            amountCents,
            note: note.trim() || null
        })
    }

    const recipientLabel = resolvedRecipient?.displayName === "Anonymous"
        ? "Anonymous"
        : (resolvedRecipient?.displayName || (resolvedRecipient?.username ? `@${resolvedRecipient.username}` : null))

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center px-4 relative" style={{height: '60px'}}>
                <button onClick={onBack} className="relative z-10 flex items-center justify-center rounded-full"
                        style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                    <ArrowLeft size={18} color="var(--text-primary)"/>
                </button>
                <span
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                    style={{color: 'var(--text-primary)'}}>Send</span>
            </div>

            <div className="flex flex-col flex-1 px-4 gap-5 overflow-y-auto">
                <div className="flex items-center gap-3 rounded-2xl px-4 card-shadow shrink-0" style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${resolveState === 'error' ? 'var(--accent-red)' : resolveState === 'resolved' ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                    height: '56px'
                }}>
                    {resolveState === 'resolving' ? <Loader2 size={18} className="animate-spin"
                                                             color="var(--text-hint)"/> : resolveState === 'resolved' ?
                        <CheckCircle2 size={18} color="var(--accent-green)"/> :
                        <User size={18} color="var(--text-hint)"/>}
                    <input type="text" value={recipientInput} onChange={(e) => handleRecipientChange(e.target.value)}
                           placeholder="Username or address"
                           className="flex-1 text-sm bg-transparent border-none outline-none"
                           style={{color: 'var(--text-primary)'}}/>
                </div>

                {resolveState === 'error' && resolveError && (
                    <p className="text-xs px-2 mt-1" style={{color: 'var(--accent-red)'}}>{resolveError}</p>
                )}

                {resolveState === 'resolved' && recipientLabel && (
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2 shrink-0"
                         style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent-green)'}}>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate"
                               style={{color: 'var(--text-primary)'}}>{recipientLabel}</p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center gap-2 mt-4 w-full shrink-0">
                    <div className="flex items-center justify-center w-full">
                        <span className="text-4xl font-medium" style={{color: 'var(--text-secondary)'}}>$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="0.00"
                            className="bg-transparent border-none outline-none font-bold text-5xl text-center"
                            style={{
                                color: exceedsBalance || belowMin || isZeroBalance ? 'var(--accent-red)' : 'var(--text-primary)',
                                width: amount ? `${amount.length + 0.5}ch` : '4ch',
                                minWidth: '2ch',
                                maxWidth: '80%'
                            }}
                        />
                    </div>
                    <span className="text-xs text-center w-full"
                          style={{color: exceedsBalance || belowMin || isZeroBalance ? 'var(--accent-red)' : 'var(--text-hint)'}}>
            {isZeroBalance ? 'Balance is $0.00. Please receive funds first.' : exceedsBalance ? 'Exceeds balance' : belowMin ? 'Minimum is $0.10' : `Balance: ${formatCents(balanceCents)}`}
          </span>
                </div>

                <div className="flex gap-2 justify-center mt-2 shrink-0">
                    {QUICK_AMOUNTS.map((val) => (
                        <button key={val} onClick={() => setAmount(val.toString())}
                                className="rounded-full text-sm font-medium" style={{
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            height: '36px',
                            padding: '0 16px'
                        }}>${val}</button>
                    ))}
                </div>

                <div className="mt-2 shrink-0">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 140))}
                        placeholder="Note (optional)"
                        className="w-full text-sm rounded-2xl px-4 py-3 outline-none"
                        style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>

            <div className="px-4" style={{paddingTop: '16px', paddingBottom: '34px'}}>
                <button onClick={handleContinue} disabled={!canContinue}
                        className="gradient-btn w-full font-semibold text-base rounded-2xl transition-all"
                        style={{height: '56px', color: 'var(--accent-primary-text)', opacity: canContinue ? 1 : 0.4}}>
                    Continue
                </button>
            </div>
        </div>
    )
}
