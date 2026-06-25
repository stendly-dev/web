'use client'
import React, {useEffect, useState} from 'react'
import {Download, Loader2, Plus, Terminal as TerminalIcon} from 'lucide-react'
import {api} from '@/lib/api'
import {toast} from '@/hooks/use-toast'
import {QRCodeCanvas} from 'qrcode.react'
import {API_BASE_URL} from "@/lib/utils";
import {captureProductEvent} from '@/lib/analytics';

export default function TerminalsPage() {
    const [terminals, setTerminals] = useState<any[]>([])
    const [newTerminalName, setNewTerminalName] = useState('')
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        (async () => {
            await loadTerminals()
        })()
    }, [])

    const loadTerminals = async () => {
        setLoading(true)
        try {
            const terms = await api.b2b.getTerminals()
            setTerminals(terms)
        } catch (err) {
            toast({title: 'Error', description: 'Failed to load terminals', variant: 'destructive'})
        } finally {
            setLoading(false)
        }
    }

    const handleCreateTerminal = async () => {
        if (!newTerminalName.trim()) return
        setCreating(true)
        try {
            await api.b2b.createTerminal(newTerminalName)
            captureProductEvent('terminal_ui_created');
            setNewTerminalName('')
            await loadTerminals()
            toast({title: 'Success', description: 'Terminal created.'})
        } catch (err) {
            toast({title: 'Error', description: 'Failed to create terminal', variant: 'destructive'})
        } finally {
            setCreating(false)
        }
    }

    const downloadQRPng = (id: string, name: string) => {
        const canvas = document.getElementById(`qr-canvas-${id}`) as HTMLCanvasElement
        if (!canvas) {
            toast({title: 'Error', description: 'QR code not ready yet.', variant: 'destructive'})
            return
        }

        const url = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = `terminal-${name.replace(/\s+/g, '-').toLowerCase()}-qr.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast({title: 'Downloaded', description: 'Terminal QR code saved as PNG.'})
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <TerminalIcon style={{color: 'var(--accent-primary)'}} size={24}/>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>POS Terminals</h2>
            </div>
            <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                Create static QR codes for your physical locations. Customers scan the QR code, and you push the payment
                amount to the terminal via API.
            </p>
            <div className="flex gap-3">
                <input type="text" value={newTerminalName} onChange={e => setNewTerminalName(e.target.value)}
                       placeholder="Terminal Name (e.g. Register 1)"
                       className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all" style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)'
                }}/>
                <button onClick={handleCreateTerminal} disabled={creating || !newTerminalName.trim()}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                        style={{color: 'var(--accent-primary-text)', backgroundColor: 'var(--accent-primary)'}}>
                    {creating ? <Loader2 size={18} className="animate-spin"/> : <><Plus size={18}/> Create</>}
                </button>
            </div>

            <div style={{display: 'none'}}>
                {terminals.map(t => (
                    <QRCodeCanvas
                        key={`canvas-${t.id}`}
                        id={`qr-canvas-${t.id}`}
                        value={`solana:${API_BASE_URL}/api/actions/terminal/${t.id}`}
                        size={1024}
                        level="H"
                        marginSize={4}
                    />
                ))}
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin"
                                                                       style={{color: 'var(--accent-primary)'}}/></div>
                ) : terminals.length === 0 ? (
                    <p className="text-sm py-8" style={{color: 'var(--text-hint)'}}>No terminals created yet.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {terminals.map(t => (
                            <div key={t.id} className="p-4 rounded-lg" style={{backgroundColor: 'var(--bg-elevated)'}}>
                                <div className="mb-3">
                                    <p className="font-semibold" style={{color: 'var(--text-primary)'}}>{t.name}</p>
                                    <p className="text-xs font-mono mt-1 break-all"
                                       style={{color: 'var(--text-hint)'}}>{t.id}</p>
                                </div>
                                <button onClick={() => downloadQRPng(t.id, t.name)}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors"
                                        style={{backgroundColor: 'var(--bg-card)', color: 'var(--accent-primary)'}}>
                                    <Download size={14}/> Download PNG
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
