import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname

    if (path.startsWith('/admin') || path.startsWith('/b2b')) {
        const token = request.cookies.get('refreshToken')?.value
        if (!token) {
            return NextResponse.redirect(new URL(`/auth?returnTo=${encodeURIComponent(path)}`, request.url))
        }

        return NextResponse.next()
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin/:path*', '/b2b/:path*'],
}