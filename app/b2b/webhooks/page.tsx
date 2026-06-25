'use client'
import React, {useEffect, useState} from 'react'
import {CheckCheck, Copy, Loader2, Webhook} from 'lucide-react'
import {api, getAccessToken} from '@/lib/api'
import {toast} from '@/hooks/use-toast'
import {API_BASE_URL} from '@/lib/utils'
import {captureProductError, captureProductEvent} from '@/lib/analytics';

export default function WebhooksPage() {
    const [profile, setProfile] = useState<any>(null)
    const [webhookInput, setWebhookInput] = useState('')
    const [savingWebhook, setSavingWebhook] = useState(false)
    const [newSecret, setNewSecret] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        captureProductEvent('webhook_page_viewed');
        api.b2b.me().then(res => {
            setProfile(res)
            setWebhookInput(res.webhookUrl || '')
        })
    }, [])

    const handleSaveWebhook = async () => {
        setSavingWebhook(true)
        try {
            await api.b2b.updateWebhook(webhookInput)
            captureProductEvent('webhook_url_ui_updated', {webhook_configured: Boolean(webhookInput.trim())});
            toast({title: 'Success', description: 'Webhook settings saved successfully'})
        } catch (err) {
            toast({title: 'Error', description: 'Failed to update webhook', variant: 'destructive'})
        } finally {
            setSavingWebhook(false)
        }
    }

    const handleGenerateSecret = async () => {
        if (!confirm("Generating a new webhook secret will invalidate the old one. Continue?")) return
        try {
            const response = await fetch(`${API_BASE_URL}/api/b2b/merchants/generate-webhook-secret`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to generate webhook secret');
            }

            const data = await response.json()
            setNewSecret(data.webhookSecret)
            captureProductEvent('webhook_secret_ui_generated');
            setCopied(false)
            toast({title: 'Success', description: 'New Webhook Secret generated.'})
        } catch (err) {
            captureProductError(err, 'api_error', {route: '/api/b2b/merchants/generate-webhook-secret', method: 'POST'});
            toast({title: 'Error', description: 'Failed to generate secret', variant: 'destructive'})
        }
    }

    const handleCopySecret = () => {
        if (!newSecret) return
        navigator.clipboard.writeText(newSecret).then(() => {
            setCopied(true)
            setTimeout(() => {
                setNewSecret(null)
                setCopied(false)
            }, 3000)
        }).catch((_) => {
            toast({title: 'Error', description: 'Failed to copy', variant: 'destructive'})
        })
    }

    if (!profile) return <div className="flex justify-center py-8"><Loader2 className="animate-spin"
                                                                            style={{color: 'var(--accent-primary)'}}/>
    </div>

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Webhook style={{color: 'var(--accent-primary)'}} size={24}/>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>Webhook Settings</h2>
            </div>
            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                Webhooks notify your backend when a payment is successfully confirmed on the Solana blockchain.
            </p>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{color: 'var(--text-primary)'}}>Endpoint
                        URL</label>
                    <div className="flex gap-3">
                        <input data-analytics-sensitive
                            type="text"
                            value={webhookInput}
                            onChange={e => setWebhookInput(e.target.value)}
                            placeholder="https://api.your-service.com/webhooks/stendly"
                            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)'
                            }}
                        />
                        <button onClick={handleSaveWebhook} disabled={savingWebhook}
                                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                style={{color: 'var(--accent-primary-text)', backgroundColor: 'var(--accent-primary)'}}>
                            {savingWebhook ? <Loader2 size={18} className="animate-spin"/> : 'Save'}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{color: 'var(--text-primary)'}}>Webhook
                        Secret (HMAC-SHA256)</label>
                    {newSecret ? (
                        <div className="p-4 rounded-lg" style={{backgroundColor: 'rgba(255, 171, 0, 0.1)'}}>
                            <p className="text-sm font-semibold mb-3" style={{color: '#ffab00'}}>
                                Important: Copy your new Webhook Secret now. You won't be able to see it again!
                            </p>
                            <div className="flex items-center gap-3">
                                <input data-analytics-sensitive
                                    type="text"
                                    readOnly
                                    value={newSecret}
                                    className="flex-1 rounded-lg px-3 py-2 font-mono text-sm outline-none"
                                    style={{
                                        backgroundColor: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <button onClick={handleCopySecret}
                                        className="flex items-center justify-center rounded-lg transition-colors shrink-0"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            backgroundColor: 'var(--accent-primary)',
                                            color: 'var(--accent-primary-text)'
                                        }}>
                                    {copied ? <CheckCheck size={16}/> : <Copy size={16}/>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 rounded-lg"
                             style={{backgroundColor: 'var(--bg-elevated)'}}>
                            <div>
                                <p className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>Webhook
                                    Secret</p>
                                <p className="text-sm font-mono mt-1"
                                   style={{color: 'var(--text-hint)'}}>whsec_••••••••••••••••••••••••</p>
                            </div>
                            <button onClick={handleGenerateSecret}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                    style={{backgroundColor: 'var(--bg-card)', color: 'var(--accent-primary)'}}>
                                Roll Secret
                            </button>
                        </div>
                    )}
                    <p className="text-xs mt-2 leading-relaxed" style={{color: 'var(--text-hint)'}}>
                        Use this secret to verify the <code className="px-1 py-0.5 rounded"
                                                            style={{backgroundColor: 'var(--bg-elevated)'}}>X-Stendly-Signature</code> header.
                        This ensures the webhook was actually sent by Stendly.
                    </p>
                </div>
            </div>
        </div>
    )
}
