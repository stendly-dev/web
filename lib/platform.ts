export type Platform = 'web'

export function detectPlatform(): Platform {
    return 'web'
}

export function isMobilePlatform(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
    )
}

export function isDesktopWeb(): boolean {
    if (typeof window === 'undefined') return false;
    return detectPlatform() === 'web' && !isMobilePlatform()
}
