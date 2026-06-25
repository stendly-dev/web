'use client'

import React, {useEffect, useState} from 'react'
import {Moon, Sun} from 'lucide-react'
import {useTheme} from 'next-themes'

export default function ThemeToggle() {
    const {resolvedTheme, setTheme} = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])
    if (!mounted) return null

    const isDark = resolvedTheme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center justify-center rounded-full transition-colors shrink-0"
            style={{width: '36px', height: '36px', backgroundColor: 'var(--bg-elevated)'}}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? <Sun size={18} color="var(--text-primary)"/> : <Moon size={18} color="var(--text-primary)"/>}
        </button>
    )
}
