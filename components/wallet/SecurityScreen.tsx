import React, {useEffect, useState} from 'react'
import {ArrowLeft, ChevronRight, Clock, Wallet} from 'lucide-react'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

interface SecurityScreenProps {
    onBack: () => void
    onWalletSettings: () => void
}

export default function SecurityScreen({onBack, onWalletSettings}: SecurityScreenProps) {
    const [lockTimer, setLockTimer] = useState('300000')

    useEffect(() => {
        const saved = localStorage.getItem('stendly_lock_timer')
        if (saved) setLockTimer(saved)
    }, [])

    const handleTimerChange = (val: string) => {
        setLockTimer(val)
        localStorage.setItem('stendly_lock_timer', val)
    }

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center justify-between px-4 pt-6 pb-4 relative z-10">
                <div className="w-10 flex justify-start">
                    <button onClick={onBack}
                            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                            style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}>
                        <ArrowLeft size={18} color="var(--text-primary)"/>
                    </button>
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                      style={{color: 'var(--text-primary)'}}>Security</span>
                <div className="w-10 flex justify-end"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 mt-4 flex flex-col gap-4">
                <div className="rounded-2xl overflow-hidden card-shadow flex flex-col"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <button onClick={onWalletSettings}
                            className="flex items-center justify-between px-4 py-4 transition-colors active:bg-white/5 text-left">
                        <div className="flex items-center gap-3">
                            <Wallet size={20} color="var(--text-primary)"/>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium"
                                      style={{color: 'var(--text-primary)'}}>Wallet</span>
                                <span className="text-xs mt-0.5" style={{color: 'var(--text-secondary)'}}>Export private key</span>
                            </div>
                        </div>
                        <ChevronRight size={18} color="var(--text-hint)"/>
                    </button>
                </div>

                <div className="rounded-2xl p-4 card-shadow flex flex-col gap-4"
                     style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}>
                    <div className="flex items-center gap-3">
                        <Clock size={20} color="var(--text-primary)"/>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium"
                                  style={{color: 'var(--text-primary)'}}>Auto-lock Timer</span>
                        </div>
                    </div>

                    <Select value={lockTimer} onValueChange={handleTimerChange}>
                        <SelectTrigger className="w-full rounded-xl h-12" style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                        }}>
                            <SelectValue placeholder="Select timer"/>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl" style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)'
                        }}>
                            <SelectItem value="0">Immediate</SelectItem>
                            <SelectItem value="60000">1 Minute</SelectItem>
                            <SelectItem value="300000">5 Minutes</SelectItem>
                            <SelectItem value="3600000">1 Hour</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}