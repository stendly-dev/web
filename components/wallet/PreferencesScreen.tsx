'use client'

import React, {useEffect, useState} from 'react'
import {ArrowLeft, Moon} from 'lucide-react'
import {Switch} from '@/components/ui/switch'
import {useTheme} from 'next-themes'

interface PreferencesScreenProps {
    onBack: () => void
}

export default function PreferencesScreen({onBack}: PreferencesScreenProps) {
    const {theme, setTheme, resolvedTheme} = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    const isDark = resolvedTheme === 'dark'

    const handleThemeToggle = (checked: boolean) => {
        setTheme(checked ? 'dark' : 'light')
    }

    return (
        <div className="flex flex-col w-full h-full" style={{backgroundColor: 'var(--bg-primary)'}}>
            <div className="flex items-center justify-between px-4 pt-6 pb-4 relative z-10">
                <div className="w-10 flex justify-start">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center rounded-full transition-colors"
                        style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}
                    >
                        <ArrowLeft size={18} style={{color: 'var(--text-primary)'}}/>
                    </button>
                </div>
                <span
                    className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold pointer-events-none"
                    style={{color: 'var(--text-primary)'}}
                >
                    Preferences
                </span>
                <div className="w-10 flex justify-end"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 mt-4">
                <div
                    className="rounded-2xl overflow-hidden card-shadow flex flex-col"
                    style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)'}}
                >
                    <div className="flex items-center justify-between px-4 py-4">
                        <div className="flex items-center gap-3">
                            <Moon size={20} style={{color: 'var(--text-primary)'}}/>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium" style={{color: 'var(--text-primary)'}}>
                                    Dark Mode
                                </span>
                                <span className="text-xs mt-0.5" style={{color: 'var(--text-secondary)'}}>
                                    App appearance
                                </span>
                            </div>
                        </div>
                        <Switch
                            checked={isDark}
                            onCheckedChange={handleThemeToggle}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}