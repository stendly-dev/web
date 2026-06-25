'use client'

import {Suspense, useEffect} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Loader2} from 'lucide-react'

function PayRedirect() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const user = searchParams.get('user')
        const address = searchParams.get('address')
        const invoice = searchParams.get('invoice')

        if (invoice) {
            router.replace(`/checkout?invoice=${invoice}`)
        } else if (user) {
            router.replace(`/?user=${user}`)
        } else if (address) {
            router.replace(`/?address=${address}`)
        } else {
            router.replace('/')
        }
    }, [router, searchParams])

    return (
        <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: 'var(--bg-primary)'}}>
            <Loader2 className="animate-spin" style={{color: 'var(--accent-primary)'}} size={32}/>
        </div>
    )
}

export default function PayPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center"
                 style={{backgroundColor: 'var(--bg-primary)'}}>
                <Loader2 className="animate-spin" style={{color: 'var(--accent-primary)'}} size={32}/>
            </div>
        }>
            <PayRedirect/>
        </Suspense>
    )
}