'use client';

import {usePathname, useSearchParams} from 'next/navigation';
import {useEffect} from 'react';
import {captureProductEvent} from '@/lib/analytics';

export default function AnalyticsTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (pathname === '/') captureProductEvent('wallet_landing_view');
        if (pathname === '/b2b') captureProductEvent('merchant_landing_view');
        if (pathname === '/checkout') captureProductEvent('checkout_link_opened');
    }, [pathname, searchParams]);

    return null;
}
