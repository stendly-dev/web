'use client'

import React, {useCallback, useEffect} from 'react'
import {Delete} from 'lucide-react'

interface PinInputProps {
    length?: number
    value: string[]
    onChange: (value: string[]) => void
    onComplete?: (code: string) => void
    error?: string | null
    disabled?: boolean
    type?: 'password' | 'text'
    autoFocus?: boolean
    className?: string
}

export default function PinInput({
                                     length = 6,
                                     value,
                                     onChange,
                                     onComplete,
                                     error,
                                     disabled,
                                     className,
                                 }: PinInputProps) {

    const handleNumber = useCallback((num: string) => {
        if (disabled) return
        const next = [...value]
        const firstEmpty = next.findIndex(v => !v)
        if (firstEmpty !== -1) {
            next[firstEmpty] = num
            onChange(next)
            if (firstEmpty === length - 1) {
                onComplete?.(next.join(''))
            }
        }
    }, [value, disabled, length, onChange, onComplete])

    const handleBackspace = useCallback(() => {
        if (disabled) return
        const next = [...value]
        const lastFilled = next.map(v => !!v).lastIndexOf(true)
        if (lastFilled !== -1) {
            next[lastFilled] = ''
            onChange(next)
        }
    }, [value, disabled, onChange])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (disabled) return
            if (/^[0-9]$/.test(e.key)) {
                handleNumber(e.key)
            } else if (e.key === 'Backspace') {
                handleBackspace()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleNumber, handleBackspace, disabled])

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return
            const pasted = e.clipboardData?.getData('text')
            if (pasted && /^\d+$/.test(pasted.trim())) {
                const digits = pasted.trim().slice(0, length).split('')
                const next = [...value]
                for (let i = 0; i < digits.length; i++) {
                    next[i] = digits[i]
                }
                onChange(next)
                if (digits.length === length) {
                    onComplete?.(next.join(''))
                }
            }
        }
        window.addEventListener('paste', handlePaste)
        return () => window.removeEventListener('paste', handlePaste)
    }, [length, value, onChange, onComplete, disabled])

    return (
        <div className={`flex flex-col items-center w-full max-w-xs mx-auto ${className ?? ''}`}>
            <div className="flex gap-4 mb-10 h-4 items-center justify-center">
                {Array.from({length}).map((_, i) => {
                    const isFilled = !!value[i]
                    return (
                        <div
                            key={i}
                            className={`rounded-full transition-all duration-200 ${
                                isFilled
                                    ? 'w-3 h-3 bg-(--text-primary)'
                                    : 'w-3 h-3 border-2 border-(--border-subtle) bg-transparent'
                            } ${error ? 'bg-(--accent-red) border-(--accent-red)' : ''}`}
                        />
                    )
                })}
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-4 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        onClick={() => handleNumber(num.toString())}
                        disabled={disabled}
                        className="h-16 flex items-center justify-center text-2xl font-medium rounded-full transition-colors active:bg-(--bg-elevated) disabled:opacity-50"
                        style={{color: 'var(--text-primary)'}}
                    >
                        {num}
                    </button>
                ))}
                <div/>
                <button
                    onClick={() => handleNumber('0')}
                    disabled={disabled}
                    className="h-16 flex items-center justify-center text-2xl font-medium rounded-full transition-colors active:bg-(--bg-elevated) disabled:opacity-50"
                    style={{color: 'var(--text-primary)'}}
                >
                    0
                </button>
                <button
                    onClick={handleBackspace}
                    disabled={disabled}
                    className="h-16 flex items-center justify-center rounded-full transition-colors active:bg-(--bg-elevated) disabled:opacity-50"
                    style={{color: 'var(--text-primary)'}}
                >
                    <Delete size={28} strokeWidth={1.5}/>
                </button>
            </div>
        </div>
    )
}