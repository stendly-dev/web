'use client'
import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import {cn} from '@/lib/utils'

function Switch({
                    className,
                    ...props
                }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--accent-green)] data-[state=unchecked]:bg-[var(--border-subtle)]',
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            />
        </SwitchPrimitive.Root>
    )
}

export {Switch}