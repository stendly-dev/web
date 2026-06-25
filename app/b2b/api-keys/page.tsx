'use client'
import React, {useState} from 'react'
import {CheckCheck, Copy, Key} from 'lucide-react'
import {api} from '@/lib/api'
import {toast} from '@/hooks/use-toast'
import {captureProductEvent} from '@/lib/analytics';

export default function ApiKeysPage() {
    const [newKey, setNewKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    React.useEffect(() => captureProductEvent('api_key_page_viewed'), []);
    const handleGenerateKey = async () => {
        if (!confirm("Generating a new key will invalidate the old one. Continue?")) return
        try {
            const res = await api.b2b.generateKey()
            setNewKey(res.apiKey)
            captureProductEvent('api_key_ui_generated');
            setCopied(false)
            toast({title: 'Success', description: 'New API key generated.'})
        } catch (err) {
            toast({title: 'Error', description: 'Failed to generate key', variant: 'destructive'})
        }
    }
    const handleCopy = () => {
        if (!newKey) return
        navigator.clipboard.writeText(newKey).then(() => {
            setCopied(true)
            setTimeout(() => {
                setNewKey(null)
                setCopied(false)
            }, 3000)
        }).catch((_) => {
            toast({title: 'Error', description: 'Failed to copy.', variant: 'destructive'})
        })
    }
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Key style={{color: 'var(--accent-primary)'}} size={24}/>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>API Credentials</h2>
            </div>
            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                Use your Secret Key to authenticate API requests. Keep it secure and never expose it in client-side
                code.
            </p>
            {newKey ? (
                <div className="p-4 rounded-lg" style={{backgroundColor: 'rgba(255, 171, 0, 0.1)'}}>
                    <p className="text-sm font-semibold mb-3" style={{color: '#ffab00'}}>
                        Important: Copy your new API key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-3">
                        <input data-analytics-sensitive
                            type="text"
                            readOnly
                            value={newKey}
                            className="flex-1 rounded-lg px-3 py-2 font-mono text-sm outline-none"
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)'
                            }}
                        />
                        <button onClick={handleCopy}
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
                        <p className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>Secret Key</p>
                        <p className="text-sm font-mono mt-1"
                           style={{color: 'var(--text-hint)'}}>st_live_••••••••••••••••••••••••</p>
                    </div>
                    <button onClick={handleGenerateKey}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            style={{backgroundColor: 'var(--bg-card)', color: 'var(--accent-primary)'}}>
                        Roll Key
                    </button>
                </div>
            )}
        </div>
    )
}
