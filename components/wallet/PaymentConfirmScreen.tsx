'use client'

import React, {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowLeft, CheckCircle, HelpCircle, Loader2} from 'lucide-react'
import {api, ApiError, type FeeBreakdown} from '@/lib/api'
import {formatCents} from '@/lib/utils'
import {signTransactionBase64} from '@/lib/wallet'
import type {SendPayload} from './SendScreen'
import PinInput from './PinInput'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {captureProductError, captureProductEvent, moneyProperties} from '@/lib/analytics';

export interface PaymentResult {
    transactionPublicId: string
    newBalanceCents: number
    amountSentCents: number
    feeCents: number
    status: 'completed' | 'pending' | 'failed'
    recipientLabel: string
    note: string | null
}

interface PaymentConfirmScreenProps {
    onBack: () => void
    onSuccess: (result: PaymentResult) => void
    sendPayload: SendPayload
}

function newIdempotencyKey(): string {
    return crypto.randomUUID()
}

function isInsufficientFeeBalanceError(err: unknown): boolean {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    if (!message.includes('insufficient') && !message.includes('not enough')) return false
    return message.includes('fee') || message.includes('gas') || message.includes('network') || message.includes('sol')
}

export default function PaymentConfirmScreen({onBack, onSuccess, sendPayload}: PaymentConfirmScreenProps) {
    const [preparing, setPreparing] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null)

    const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey())
    const fetchedKeyRef = useRef<string | null>(null)

    const [showPinPrompt, setShowPinPrompt] = useState(false)
    const [pin, setPin] = useState(['', '', '', '', '', ''])
    const [pinError, setPinError] = useState<string | null>(null)

    const paidRef = useRef(false)

    useEffect(() => {
        return () => {
            if (sendPayload.paymentIntentId && !paidRef.current) {
                api.transactions.unlock(sendPayload.paymentIntentId).catch(() => {
                })
            }
        }
    }, [sendPayload.paymentIntentId])

    const recipientLabel = sendPayload.recipient.displayName === "Anonymous"
        ? "Anonymous"
        : (sendPayload.recipient.displayName || (sendPayload.recipient.username ? `@${sendPayload.recipient.username}` : 'Unknown Address'))

    const recipientInitial = recipientLabel.replace('@', '').charAt(0).toUpperCase()
    const verified = sendPayload.recipient.isStendlyUser

    const loadFees = useCallback(async (keyToUse: string, preserveError = false) => {
        setPreparing(true)
        if (!preserveError) setError(null)
        try {
            captureProductEvent('fee_quote_requested', moneyProperties(sendPayload.amountCents, {
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
                priority_level: 2,
            }));
            const recipientIdOrAddress = sendPayload.recipient.isStendlyUser
                ? sendPayload.recipient.accountId
                : sendPayload.recipient.solanaAddress;

            const res = await api.transactions.prepare({
                recipientAccountId: sendPayload.paymentIntentId ? undefined : recipientIdOrAddress,
                paymentIntentId: sendPayload.paymentIntentId,
                amountCents: sendPayload.amountCents,
                priorityLevel: 2,
                idempotencyKey: keyToUse
            })
            setFeeBreakdown(res)
            captureProductEvent('fee_quote_succeeded', moneyProperties(sendPayload.amountCents, {
                fee_type: res.components?.[0]?.name || 'service_fee',
                network_fee_cents: res.networkFeeCents,
                stendly_fee_cents: res.stendlyFeeCents,
                depeg_fee_cents: res.depegFeeCents,
                total_fee_cents: res.totalFeeCents,
                total_user_pays_cents: res.totalUserPaysCents,
                fee_component_count: res.components.length,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
            }));
        } catch (err) {
            const errorCode = err instanceof ApiError ? `HTTP_${err.status}` : 'UNKNOWN';
            const failureProperties = moneyProperties(sendPayload.amountCents, {
                error_code: errorCode,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
            })
            captureProductEvent('fee_quote_failed', failureProperties);
            captureProductEvent('send_fee_quote_failed', failureProperties);
            if (isInsufficientFeeBalanceError(err)) {
                captureProductEvent('insufficient_fee_balance', failureProperties);
            }
            captureProductError(err, 'transaction_error', {
                operation: 'fee_quote',
                error_code: errorCode,
                ...moneyProperties(sendPayload.amountCents),
            });
            setError(err instanceof ApiError ? err.message : 'Failed to calculate fees')
        } finally {
            setPreparing(false)
        }
    }, [sendPayload])

    useEffect(() => {
        if (fetchedKeyRef.current === idempotencyKey) return
        fetchedKeyRef.current = idempotencyKey
        loadFees(idempotencyKey)
    }, [loadFees, idempotencyKey])

    const handlePayClick = () => {
        if (submitting || preparing || !feeBreakdown) return
        setShowPinPrompt(true)
        captureProductEvent('transaction_confirm_opened', moneyProperties(sendPayload.amountCents, {
            total_fee_cents: feeBreakdown.totalFeeCents,
            total_user_pays_cents: feeBreakdown.totalUserPaysCents,
            recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
            payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
        }));
        setPin(['', '', '', '', '', ''])
        setPinError(null)
    }

    const executePayment = async (enteredPin: string) => {
        setShowPinPrompt(false)
        setSubmitting(true)
        setError(null)

        try {
            const buildRes = await api.transactions.build({
                idempotencyKey
            })

            const destinationAddress = sendPayload.recipient.solanaAddress || sendPayload.resolveValue;

            const signedBase64 = await signTransactionBase64(
                buildRes.base64UnsignedTransaction,
                enteredPin,
                destinationAddress,
                sendPayload.amountCents,
                feeBreakdown!.usdcMintAddress,
                feeBreakdown!.totalFeeCents
            )
            const paymentProperties = moneyProperties(sendPayload.amountCents, {
                total_fee_cents: feeBreakdown!.totalFeeCents,
                total_user_pays_cents: feeBreakdown!.totalUserPaysCents,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
            });
            captureProductEvent('transaction_signed', paymentProperties);

            captureProductEvent('transaction_broadcast_started', paymentProperties);
            const submitRes = await api.transactions.submit({
                idempotencyKey,
                base64PartiallySignedTransaction: signedBase64
            })

            paidRef.current = true
            captureProductEvent('transaction_broadcast_succeeded', moneyProperties(submitRes.amountSentCents, {
                requested_amount_cents: sendPayload.amountCents,
                total_fee_cents: submitRes.totalFeeCents,
                status: submitRes.status,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
            }));
            captureProductEvent('transaction_succeeded', moneyProperties(submitRes.amountSentCents, {
                requested_amount_cents: sendPayload.amountCents,
                total_fee_cents: submitRes.totalFeeCents,
                status: submitRes.status,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
            }));
            onSuccess({
                transactionPublicId: submitRes.transactionId,
                newBalanceCents: submitRes.newBalanceCents,
                amountSentCents: submitRes.amountSentCents,
                feeCents: submitRes.totalFeeCents,
                status: submitRes.status,
                recipientLabel,
                note: sendPayload.note ?? null,
            })
        } catch (err) {
            const errorCode = err instanceof ApiError ? `HTTP_${err.status}` : 'SIGN_OR_BROADCAST_ERROR';
            const failureProperties = moneyProperties(sendPayload.amountCents, {
                total_fee_cents: feeBreakdown?.totalFeeCents,
                total_user_pays_cents: feeBreakdown?.totalUserPaysCents,
                recipient_type: sendPayload.recipient.isStendlyUser ? 'stendly_user' : 'external_wallet',
                payment_type: sendPayload.paymentIntentId ? 'merchant_payment' : 'p2p_transfer',
                error_code: errorCode,
            });
            captureProductEvent('transaction_broadcast_failed', failureProperties);
            captureProductEvent('transaction_failed', failureProperties);
            captureProductError(err, 'transaction_error', {
                operation: 'sign_or_broadcast',
                error_code: err instanceof ApiError ? `HTTP_${err.status}` : 'SIGN_OR_BROADCAST_ERROR',
                ...failureProperties,
            });
            setError(err instanceof ApiError ? err.message : (err as Error).message)
            const newKey = newIdempotencyKey()
            fetchedKeyRef.current = newKey
            setIdempotencyKey(newKey)
            await loadFees(newKey, true)
        } finally {
            setSubmitting(false)
        }
    }

    const handleBackClick = async () => {
        if (sendPayload.paymentIntentId) {
            paidRef.current = true
            try {
                await api.transactions.unlock(sendPayload.paymentIntentId);
            } catch (err) {
                // ignore
            }
        }
        onBack();
    }

    const totalCents = feeBreakdown ? feeBreakdown.totalUserPaysCents : sendPayload.amountCents

    const feeRows = feeBreakdown ? [
        ...feeBreakdown.components.map(c => ({
            label: c.name,
            value: formatCents(c.amountCents),
            description: c.description,
            isTotal: false
        })),
        {label: 'Total', value: formatCents(feeBreakdown.totalUserPaysCents), description: undefined, isTotal: true}
    ] : [
        {label: 'Network fee', value: '...', description: undefined, isTotal: false},
        {label: 'Stendly fee', value: '...', description: undefined, isTotal: false},
        {label: 'Total', value: '...', description: undefined, isTotal: true}
    ]

    if (showPinPrompt) {
        return (
            <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
                <div className="flex items-center px-4 relative" style={{height: '60px'}}>
                    <button onClick={() => setShowPinPrompt(false)}
                            className="relative z-10 flex items-center justify-center rounded-full"
                            style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                        <ArrowLeft size={18} color="var(--text-primary)"/>
                    </button>
                    <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                        style={{color: 'var(--text-primary)'}}>Enter PIN</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <p className="text-sm text-center mb-6" style={{color: 'var(--text-secondary)'}}>Enter your 6-digit
                        PIN to sign the transaction.</p>
                    <PinInput value={pin} onChange={setPin} onComplete={executePayment} error={pinError}/>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center px-4 relative" style={{height: '60px'}}>
                <button onClick={handleBackClick} disabled={submitting}
                        className="relative z-10 flex items-center justify-center rounded-full"
                        style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                    <ArrowLeft size={18} color="var(--text-primary)"/>
                </button>
                <span
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                    style={{color: 'var(--text-primary)'}}>Confirm Payment</span>
            </div>

            <div className="flex flex-col flex-1 px-4 gap-5 overflow-y-auto">
                <div className="flex items-center gap-4 rounded-2xl p-4 card-shadow"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center justify-center rounded-full shrink-0 text-base font-semibold"
                         style={{
                             width: '48px',
                             height: '48px',
                             backgroundColor: 'var(--bg-elevated)',
                             color: 'var(--accent-primary)'
                         }}>
                        {recipientInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold"
                           style={{color: 'var(--text-primary)'}}>{recipientLabel}</p>
                    </div>
                    {verified && <CheckCircle size={18} color="var(--accent-green)" strokeWidth={2}/>}
                </div>

                <div className="flex flex-col items-center gap-1 py-2">
          <span className="font-bold leading-none"
                style={{fontSize: '40px', color: 'var(--text-primary)', letterSpacing: '-0.02em'}}>
            {formatCents(totalCents)}
          </span>
                </div>

                <TooltipProvider delayDuration={0}>
                    <div className="rounded-2xl overflow-hidden card-shadow"
                         style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                        {preparing ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 size={24} className="animate-spin" color="var(--accent-primary)"/>
                            </div>
                        ) : (
                            feeRows.map((row, index) => (
                                <div key={row.label}>
                                    <div className="flex items-center justify-between px-4 py-3"
                                         style={{minHeight: '52px'}}>
                                        <div className="flex items-center gap-2 pr-4">
											<span className="text-sm" style={{
                                                color: row.isTotal ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                fontWeight: row.isTotal ? 600 : 400
                                            }}>{row.label}</span>
                                            {row.description && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button type="button"
                                                                className="outline-none focus:outline-none flex items-center justify-center">
                                                            <HelpCircle size={14} color="var(--text-hint)"/>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" align="center"
                                                                    className="max-w-50 text-center">
                                                        <p>{row.description}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                        <span className="text-sm shrink-0" style={{
                                            color: 'var(--text-primary)',
                                            fontWeight: row.isTotal ? 600 : 400
                                        }}>{row.value}</span>
                                    </div>
                                    {index < feeRows.length - 1 && <div className="mx-4" style={{
                                        height: '1px',
                                        backgroundColor: 'var(--border-subtle)'
                                    }}/>}
                                </div>
                            ))
                        )}
                    </div>
                </TooltipProvider>
                {error && <p className="text-xs text-center px-1 py-2 rounded-xl"
                             style={{color: 'var(--accent-red)', backgroundColor: 'rgba(255,71,87,0.08)'}}>{error}</p>}
            </div>

            <div className="flex flex-col gap-3 px-4" style={{paddingTop: '16px', paddingBottom: '34px'}}>
                <button onClick={handlePayClick} disabled={submitting || preparing || !feeBreakdown}
                        className="gradient-btn w-full font-semibold text-base rounded-2xl transition-all flex items-center justify-center gap-2"
                        style={{
                            height: '56px',
                            color: 'var(--text-primary)',
                            opacity: (submitting || preparing || !feeBreakdown) ? 0.7 : 1
                        }}>
                    {submitting ? <Loader2 size={18} className="animate-spin"/> : `Pay ${formatCents(totalCents)}`}
                </button>
            </div>
        </div>
    )
}
