import type {Metadata, Viewport} from 'next'
import {JetBrains_Mono, Manrope} from 'next/font/google'
import './globals.css'
import React from "react"
import {Suspense} from 'react'
import {QueryProvider} from '@/components/QueryProvider'
import {HealthProvider} from '@/contexts/HealthContext'
import {ThemeProvider} from '@/components/ThemeProvider'
import AnalyticsTracker from '@/components/AnalyticsTracker'

const manrope = Manrope({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-sans',
    display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-mono',
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'Stendly App',
    description: 'Stendly B2B2C Crypto Payment Gateway App.',
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        }
    },
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Stendly',
    },
    formatDetection: {
        telephone: false,
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0A0A0F',
    viewportFit: 'cover',
}

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        <body className="font-sans antialiased">
        <Suspense fallback={null}><AnalyticsTracker/></Suspense>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <QueryProvider>
                <HealthProvider>
                    {children}
                </HealthProvider>
            </QueryProvider>
        </ThemeProvider>
        </body>
        </html>
    )
}
