'use client'

import React, {useCallback, useRef} from 'react'

interface OtpInputProps {
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

export default function OtpInput({
                                     length = 6,
                                     value,
                                     onChange,
                                     onComplete,
                                     error,
                                     disabled,
                                     type = 'password',
                                     autoFocus = true,
                                     className,
                                 }: OtpInputProps) {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([])

    const setInputRef = useCallback((index: number) => (el: HTMLInputElement | null) => {
        inputsRef.current[index] = el
    }, [])

    const handleChange = useCallback((index: number, raw: string) => {
        const cleaned = raw.replace(/\D/g, '').slice(0, 1)
        if (cleaned.length > 1) return

        const next = [...value]
        next[index] = cleaned
        onChange(next)

        if (cleaned && index < length - 1) {
            inputsRef.current[index + 1]?.focus()
        }

        const joined = next.join('')
        if (joined.length === length) {
            onComplete?.(joined)
        }
    }, [value, onChange, onComplete, length])

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            inputsRef.current[index - 1]?.focus()
        }
    }, [value])

    return (
        <div className={`flex gap-2 ${className ?? ''}`}>
            {Array.from({length}).map((_, i) => (
                <input
                    key={i}
                    ref={setInputRef(i)}
                    type={type}
                    inputMode="numeric"
                    maxLength={1}
                    value={value[i] ?? ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={disabled}
                    className="w-11 h-14 text-center text-xl font-bold rounded-xl outline-none"
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                        color: 'var(--text-primary)',
                    }}
                    autoFocus={autoFocus && i === 0}
                />
            ))}
        </div>
    )
}