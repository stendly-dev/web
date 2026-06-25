'use client';

import * as Sentry from '@sentry/nextjs';
import {useEffect} from 'react';

export default function GlobalError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
    useEffect(() => {
        Sentry.captureException(error, {tags: {app: 'web', severity: 'p0'}});
    }, [error]);
    return <html lang="en"><body><main style={{padding: 32, fontFamily: 'sans-serif'}}>
        <h1>Stendly App failed to load</h1><button type="button" onClick={reset}>Try again</button>
    </main></body></html>;
}

