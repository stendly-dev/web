'use client'

import {useMemo, useState} from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    Banknote,
    CheckCheck,
    Copy,
    ExternalLink,
    Info,
    QrCode,
    Wallet
} from 'lucide-react'
import {QRCodeSVG} from 'qrcode.react'
import {useProfile} from '@/contexts/ProfileContext'
import {toast} from '@/hooks/use-toast'
import {captureProductEvent} from '@/lib/analytics'

interface ReceiveScreenProps {
    onBack: () => void
}

type MainTab = 'qr' | 'topup'
type TopUpView = 'choose' | 'external' | 'fiat'
type FiatCurrency = 'RUB'

type FiatProvider = {
    id: string
    currency: FiatCurrency
    minAmount: number
    fromCurrencyId: number
    toCurrencyId: number
    fromCurrencyCode: string
    toCurrencyCode: string
    recipientWalletField: string
    prefilledFields: string[]
    manualFields: string[]
}

const FIAT_PROVIDERS: FiatProvider[] = [
    {
        id: 'ferma-rub-usdc-sol',
        currency: 'RUB',
        minAmount: 1000,
        fromCurrencyId: 163,
        toCurrencyId: 130,
        fromCurrencyCode: 'rub',
        toCurrencyCode: 'usdc',
        recipientWalletField: 'USDCoin SOL wallet',
        prefilledFields: ['currency pair', 'amount', 'verification rate'],
        manualFields: ['full name', 'phone number', 'bank', 'e-mail', 'captcha', 'USDCoin SOL wallet']
    }
]

function buildProviderUrl(provider: FiatProvider, amount: number) {
    const url = new URL('https://ferma.cc/en/claim/new')
    url.searchParams.set('from', String(provider.fromCurrencyId))
    url.searchParams.set('to', String(provider.toCurrencyId))
    url.searchParams.set('cur_from', provider.fromCurrencyCode)
    url.searchParams.set('cur_to', provider.toCurrencyCode)
    url.searchParams.set('amount', String(amount))
    url.searchParams.set('verification', '1')
    return url.toString()
}

function shortValue(value: string, head = 8, tail = 8) {
    if (!value) return ''
    if (value.length <= head + tail + 3) return value
    return `${value.slice(0, head)}...${value.slice(-tail)}`
}

export default function ReceiveScreen({onBack}: ReceiveScreenProps) {
    const {profile} = useProfile()
    const [activeTab, setActiveTab] = useState<MainTab>('qr')
    const [topUpView, setTopUpView] = useState<TopUpView>('choose')
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [currency, setCurrency] = useState<FiatCurrency>('RUB')
    const [amount, setAmount] = useState('1000')

    const solanaAddress = profile?.solanaAddress || ''
    const username = profile?.username ? `@${profile.username}` : 'Stendly'

    const provider = useMemo(() => {
        const parsedAmount = Number(amount)
        return FIAT_PROVIDERS.find(item => item.currency === currency && parsedAmount >= item.minAmount)
            ?? FIAT_PROVIDERS.find(item => item.currency === currency)
            ?? FIAT_PROVIDERS[0]
    }, [amount, currency])

    const minAmount = provider.minAmount
    const parsedAmount = Number(amount)
    const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= minAmount

    const copyToClipboard = async (text: string, id: string) => {
        if (!text) return
        try {
            await navigator.clipboard.writeText(text)
            if (id.includes('address')) captureProductEvent('deposit_address_copied')
            setCopiedId(id)
            setTimeout(() => setCopiedId(current => current === id ? null : current), 2000)
        } catch {
            toast({title: 'Error', description: 'Failed to copy to clipboard.', variant: 'destructive'})
        }
    }

    const openProvider = async () => {
        if (!solanaAddress || !amountValid) return

        try {
            await navigator.clipboard.writeText(solanaAddress)
            setCopiedId('fiat-address')
            setTimeout(() => setCopiedId(current => current === 'fiat-address' ? null : current), 2000)
        } catch {
            // Ferma does not read the recipient wallet from URL query parameters.
        }

        captureProductEvent('fiat_topup_provider_opened')
        window.open(buildProviderUrl(provider, parsedAmount), '_blank', 'noopener,noreferrer')
    }

    const renderHeader = () => (
        <div className="flex items-center px-4 relative" style={{height: '60px'}}>
            <button
                onClick={topUpView === 'choose' ? onBack : () => setTopUpView('choose')}
                className="relative z-10 flex items-center justify-center rounded-full"
                style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}
                aria-label="Back"
            >
                <ArrowLeft size={18} color="var(--text-primary)"/>
            </button>
            <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none"
                style={{color: 'var(--text-primary)'}}>
                {topUpView === 'external' ? 'External Wallet' : topUpView === 'fiat' ? 'Fiat Top Up' : 'Receive'}
            </span>
        </div>
    )

    const renderSegmentedTabs = () => topUpView === 'choose' && (
        <div className="px-4 mb-5">
            <div className="flex rounded-full p-1" style={{backgroundColor: 'var(--bg-elevated)'}}>
                <button
                    onClick={() => setActiveTab('qr')}
                    className="flex-1 text-sm font-medium rounded-full transition-all"
                    style={{
                        height: '36px',
                        backgroundColor: activeTab === 'qr' ? 'var(--text-primary)' : 'transparent',
                        color: activeTab === 'qr' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                    }}>
                    QR
                </button>
                <button
                    onClick={() => setActiveTab('topup')}
                    className="flex-1 text-sm font-medium rounded-full transition-all"
                    style={{
                        height: '36px',
                        backgroundColor: activeTab === 'topup' ? 'var(--text-primary)' : 'transparent',
                        color: activeTab === 'topup' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                    }}>
                    Top up
                </button>
            </div>
        </div>
    )

    const CopyButton = ({id, text, label}: { id: string, text: string, label: string }) => (
        <button
            onClick={() => copyToClipboard(text, id)}
            className="shrink-0 flex items-center justify-center rounded-lg transition-opacity active:opacity-70"
            style={{width: '32px', height: '32px', backgroundColor: 'var(--bg-elevated)'}}
            aria-label={label}
            disabled={!text}
        >
            {copiedId === id
                ? <CheckCheck size={14} color="var(--accent-green)" strokeWidth={2}/>
                : <Copy size={14} color="var(--text-secondary)" strokeWidth={1.8}/>}
        </button>
    )

    const ReadOnlyField = ({label, value, id}: { label: string, value: string, id: string }) => (
        <div className="rounded-2xl overflow-hidden card-shadow"
             style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
            <div className="flex flex-col px-4 py-3">
                <span className="text-xs font-medium mb-1.5" style={{color: 'var(--text-secondary)'}}>{label}</span>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium min-w-0 flex-1 truncate" style={{color: 'var(--text-primary)'}}>
                        {shortValue(value)}
                    </span>
                    <CopyButton id={id} text={value} label={`Copy ${label}`}/>
                </div>
            </div>
        </div>
    )

    const renderQr = () => (
        <div className="flex flex-col items-center gap-4 mt-8">
            <div className="bg-white p-4 rounded-2xl card-shadow" style={{border: '1px solid var(--border-subtle)'}}>
                <QRCodeSVG value={solanaAddress} size={204} level="M"/>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
                <div className="col-start-2 flex items-center justify-center min-w-0">
                    <p className="text-lg font-semibold leading-none truncate" style={{color: 'var(--text-primary)'}}>
                        {username}
                    </p>
                </div>
                <div className="col-start-3 flex justify-start pl-2">
                    <CopyButton id="username" text={profile?.username || ''} label="Copy username"/>
                </div>
            </div>

            <div className="w-full">
                <ReadOnlyField label="Solana address" value={solanaAddress} id="qr-address"/>
            </div>

            <div className="flex gap-3 rounded-xl p-4"
                 style={{backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-red)'}}>
                <AlertTriangle size={16} color="var(--accent-red)" className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Send only USDC on the Solana network to this address. Other tokens are not accepted.
                </p>
            </div>
        </div>
    )

    const renderTopUpChoice = () => (
        <div className="flex flex-col gap-3 mt-2">
            <button
                onClick={() => setTopUpView('external')}
                className="flex items-center gap-4 text-left rounded-2xl p-4 card-shadow transition-opacity active:opacity-80"
                style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="shrink-0 flex items-center justify-center rounded-full"
                     style={{width: '44px', height: '44px', backgroundColor: 'var(--bg-elevated)'}}>
                    <Wallet size={21} color="var(--accent-primary)"/>
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>External wallet</p>
                    <p className="text-xs leading-relaxed mt-1" style={{color: 'var(--text-secondary)'}}>
                        Transfer USDC from another Solana wallet directly to your Stendly address. Use wallet swaps if
                        you need to convert another token first.
                    </p>
                </div>
            </button>

            <button
                onClick={() => setTopUpView('fiat')}
                className="flex items-center gap-4 text-left rounded-2xl p-4 card-shadow transition-opacity active:opacity-80"
                style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="shrink-0 flex items-center justify-center rounded-full"
                     style={{width: '44px', height: '44px', backgroundColor: 'var(--bg-elevated)'}}>
                    <Banknote size={21} color="var(--accent-primary)"/>
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>Fiat</p>
                    <p className="text-xs leading-relaxed mt-1" style={{color: 'var(--text-secondary)'}}>
                        Top up with local currency through an external exchange provider. The provider may request KYC
                        or AML checks before completing the transfer.
                    </p>
                </div>
            </button>
        </div>
    )

    const renderExternalWallet = () => (
        <div className="flex flex-col gap-4 mt-2">
            <div className="rounded-2xl p-4 card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center rounded-full"
                         style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                        <QrCode size={18} color="var(--accent-primary)"/>
                    </div>
                    <p className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>How to send</p>
                </div>
                <div className="flex flex-col gap-3 text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    <p>Copy the Solana address below and paste it as the recipient address in your other wallet.</p>
                    <p>Enter the amount you want to send and confirm the transfer in that wallet.</p>
                    <p>You may need SOL in the sending wallet to pay network gas. The exact requirement depends on that
                        wallet.</p>
                </div>
            </div>

            <ReadOnlyField label="Solana address" value={solanaAddress} id="external-address"/>

            <div className="flex gap-3 rounded-xl p-4"
                 style={{backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-red)'}}>
                <AlertTriangle size={16} color="var(--accent-red)" className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Required: send USDC on Solana only. Other tokens are not accepted. If another token arrives, Stendly
                    is not responsible for loss because blockchain transfers cannot be reversed.
                </p>
            </div>

            <div className="flex gap-3 rounded-xl p-4"
                 style={{backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-primary)'}}>
                <Info size={16} color="var(--accent-primary)" className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Need to swap another token to USDC? Do it in your wallet or through a trusted swap platform before
                    sending funds to Stendly.
                </p>
            </div>
        </div>
    )

    const renderFiat = () => (
        <div className="flex flex-col gap-4 mt-2">
            <div className="rounded-2xl overflow-hidden card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <label className="flex flex-col px-4 py-3">
                    <span className="text-xs font-medium mb-1.5" style={{color: 'var(--text-secondary)'}}>Currency</span>
                    <select
                        value={currency}
                        onChange={event => {
                            const nextCurrency = event.target.value as FiatCurrency
                            setCurrency(nextCurrency)
                            const nextProvider = FIAT_PROVIDERS.find(item => item.currency === nextCurrency)
                            if (nextProvider) setAmount(String(nextProvider.minAmount))
                        }}
                        className="bg-transparent border-none outline-none text-sm font-medium w-full"
                        style={{color: 'var(--text-primary)'}}>
                        <option value="RUB">RUB</option>
                    </select>
                </label>
            </div>

            <div className="rounded-2xl overflow-hidden card-shadow"
                 style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                <label className="flex flex-col px-4 py-3">
                    <span className="text-xs font-medium mb-1.5" style={{color: 'var(--text-secondary)'}}>
                        Amount
                    </span>
                    <input
                        type="number"
                        min={minAmount}
                        step="100"
                        inputMode="numeric"
                        value={amount}
                        onChange={event => setAmount(event.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-medium w-full"
                        style={{color: 'var(--text-primary)'}}
                    />
                </label>
            </div>

            {!amountValid && (
                <p className="text-xs px-1" style={{color: 'var(--accent-red)'}}>
                    Minimum top up amount is {minAmount} {currency}.
                </p>
            )}

            <ReadOnlyField label="Destination Solana address" value={solanaAddress} id="fiat-address"/>

            <div className="flex gap-3 rounded-xl p-4"
                 style={{backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-primary)'}}>
                <Info size={16} color="var(--accent-primary)" className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Stendly does not process fiat payments directly. You will continue with an external exchange
                    provider, send fiat there, and the provider sends USDC SOL to your Stendly address. The provider may
                    require KYC or AML verification.
                </p>
            </div>

            <div className="flex gap-3 rounded-xl p-4"
                 style={{backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-red)'}}>
                <AlertTriangle size={16} color="var(--accent-red)" className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed" style={{color: 'var(--text-secondary)'}}>
                    Ferma opens with {provider.prefilledFields.join(', ')} prefilled. Its form does not accept the
                    recipient wallet through the URL, so Stendly copies your address before opening it. Paste and verify
                    it in the {provider.recipientWalletField} field before paying.
                </p>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            {renderHeader()}
            {renderSegmentedTabs()}

            <div className="flex-1 overflow-y-auto px-4 pb-8">
                {topUpView === 'choose' && activeTab === 'qr' && renderQr()}
                {topUpView === 'choose' && activeTab === 'topup' && renderTopUpChoice()}
                {topUpView === 'external' && renderExternalWallet()}
                {topUpView === 'fiat' && renderFiat()}
            </div>

            {topUpView === 'fiat' && (
                <div className="px-4 flex flex-col gap-2" style={{paddingTop: '16px', paddingBottom: '34px'}}>
                    <button
                        onClick={openProvider}
                        disabled={!amountValid || !solanaAddress}
                        className="gradient-btn w-full font-semibold text-base rounded-2xl transition-all flex items-center justify-center gap-2"
                        style={{
                            height: '56px',
                            color: 'var(--accent-primary-text)',
                            opacity: (!amountValid || !solanaAddress) ? 0.5 : 1
                        }}>
                        Top up
                        <ExternalLink size={18}/>
                    </button>
                </div>
            )}
        </div>
    )
}
