import {API_BACKEND_HEALTH_CHECK_TIMEOUT_MS, API_BASE_URL, API_HEALTH_CHECK_TIMEOUT_MS} from "@/lib/utils";
import {captureProductError, resetAnalyticsIdentity} from '@/lib/analytics';


let inMemoryAccessToken: string | null = null;
let inMemoryAccountId: string | null = null;
let backendHealthy = true;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckListeners: ((healthy: boolean) => void)[] = [];
const csrfHeaders = {'X-Stendly-CSRF': '1'};

export function getAccessToken(): string | null {
    return inMemoryAccessToken;
}

export function isBackendHealthy(): boolean {
    return backendHealthy;
}

export function onHealthChange(callback: (healthy: boolean) => void): () => void {
    healthCheckListeners.push(callback);
    callback(backendHealthy);
    return () => {
        healthCheckListeners = healthCheckListeners.filter(l => l !== callback);
    };
}

export function setTokens(
    accessToken: string,
    refreshToken?: string,
    accountId?: string,
): void {
    inMemoryAccessToken = accessToken;
    if (accountId) {
        inMemoryAccountId = accountId;
    }
}

export function clearTokens(): void {
    inMemoryAccessToken = null;
    inMemoryAccountId = null;
    resetAnalyticsIdentity();
    fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: csrfHeaders,
        credentials: 'include',
        keepalive: true
    }).catch(() => {
    });
}

export function getStoredAccountId(): string | null {
    return inMemoryAccountId;
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly body?: unknown,
    ) {
        super(message);
        this.name = 'ApiError'
    }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let refreshErrorSubscribers: ((err: any) => void)[] = [];

function onRefreshed(token: string) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
    refreshErrorSubscribers = [];
}

function onRefreshError(err: any) {
    refreshErrorSubscribers.forEach(cb => cb(err));
    refreshSubscribers = [];
    refreshErrorSubscribers = [];
}

type ApiRequestOptions = RequestInit & {
    skipAuth?: boolean
}

async function request<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
    retried = false,
): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const token = getAccessToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
    };
    if (token && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${token}`
    }
    const fetchOptions: RequestInit = {...options, headers, credentials: 'include'};

    let res: Response;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_CHECK_TIMEOUT_MS);
        res = await fetch(url, {...fetchOptions, signal: controller.signal});
        clearTimeout(timeoutId);
    } catch (err) {
        captureProductError(err, 'api_error', {
            route: path,
            method: options.method || 'GET',
            error_code: err instanceof DOMException && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        });
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new ApiError(0, 'Request timeout. Backend may be unreachable.');
        }
        if (err instanceof TypeError && err.message.includes('fetch')) {
            setBackendHealthy(false);
            throw new ApiError(0, 'Network error. Cannot connect to backend service.');
        }
        throw new ApiError(0, 'Network request failed.');
    }

    if (res.status === 401 && !retried && !options.skipAuth) {
        if (isRefreshing) {
            return new Promise<T>((resolve, reject) => {
                refreshSubscribers.push(() => {
                    request<T>(path, options, true).then(resolve).catch(reject);
                });
                refreshErrorSubscribers.push(() => {
                    reject(new ApiError(401, 'Session expired'));
                });
            });
        }

        isRefreshing = true;
        try {
            const refreshed = await refreshAccessToken();
            setTokens(refreshed.accessToken, undefined, refreshed.accountId);
            isRefreshing = false;
            onRefreshed(refreshed.accessToken);
            return request<T>(path, options, true);
        } catch (err) {
            isRefreshing = false;
            onRefreshError(err);
            if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 400)) {
                clearTokens();
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
                    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = `/auth?returnTo=${currentPath}`;
                }
                throw new ApiError(401, 'Session expired');
            }
            throw err;
        }
    }

    if (!res.ok) {
        let body: unknown;
        try {
            body = await res.json()
        } catch {
            body = null
        }
        const msg = extractErrorMessage(body, res.status);
        const errorCode = extractErrorCode(body) || res.headers.get('X-Error-Code') || `HTTP_${res.status}`;
        captureProductError(new ApiError(res.status, msg), 'api_error', {
            route: path,
            method: options.method || 'GET',
            status: res.status,
            error_code: errorCode,
            request_id: res.headers.get('X-Request-Id'),
        });
        throw new ApiError(res.status, msg, body)
    }

    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    if (!text) return undefined as unknown as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as unknown as T;
    }
}

function extractErrorCode(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const value = (body as Record<string, unknown>)['error'];
    if (value && typeof value === 'object') {
        const code = (value as Record<string, unknown>)['code'];
        return typeof code === 'string' ? code : null;
    }
    const code = (body as Record<string, unknown>)['code'];
    return typeof code === 'string' ? code : null;
}

function extractErrorMessage(body: unknown, status: number): string {
    if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;

        if (b['errors']) {
            if (Array.isArray(b['errors']) && b['errors'].length > 0) {
                return String(b['errors'][0]);
            }
            if (typeof b['errors'] === 'object' && b['errors'] !== null) {
                const firstKey = Object.keys(b['errors'])[0];
                if (firstKey) {
                    const fieldErrors = (b['errors'] as Record<string, unknown>)[firstKey];
                    if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
                        return String(fieldErrors[0]);
                    }
                }
            }
        }
        if (typeof b['detail'] === 'string' && b['detail']) return b['detail'];

        if (typeof b['error'] === 'string') return b['error'];
        if (typeof b['message'] === 'string') return b['message'];
        if (typeof b['title'] === 'string') return b['title'];
    }
    return `Request failed: ${status}`
}

interface RefreshResponse {
    accessToken: string
    accountId: string
    requiresProfileSetup: boolean
    balanceCents: number
}

let activeRefreshPromise: Promise<RefreshResponse> | null = null;

function isRetryableError(err: unknown): boolean {
    if (err instanceof ApiError) {
        return err.status === 0 || err.status >= 500;
    }
    return true;
}

async function refreshAccessToken(): Promise<RefreshResponse> {
    if (activeRefreshPromise) return activeRefreshPromise;

    const delays = [1000, 3000, 10000];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
            await new Promise(r => setTimeout(r, delays[attempt - 1]));
        }

        activeRefreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                ...csrfHeaders,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        }).then(async (res) => {
            if (!res.ok) throw new ApiError(res.status, 'Refresh failed');
            return res.json();
        });

        try {
            return await activeRefreshPromise;
        } catch (err) {
            lastError = err;
            activeRefreshPromise = null;
            if (!isRetryableError(err)) throw err;
        }
    }

    throw lastError;
}

export async function checkBackendHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_BACKEND_HEALTH_CHECK_TIMEOUT_MS);
        const res = await fetch(`${API_BASE_URL}/api/health`, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        const healthy = res.ok;
        setBackendHealthy(healthy);
        return healthy;
    } catch {
        setBackendHealthy(false);
        return false;
    }
}

function setBackendHealthy(healthy: boolean): void {
    if (backendHealthy !== healthy) {
        backendHealthy = healthy;
        healthCheckListeners.forEach(cb => cb(healthy));
    }
}

export function startHealthMonitoring(): void {
    if (typeof window === 'undefined') return;
    if (healthCheckInterval) return;

    checkBackendHealth();
    healthCheckInterval = setInterval(() => {
        checkBackendHealth();
    }, 30000);
}

export function stopHealthMonitoring(): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

export type ResolveMethod = 0 | 1 | 2 | 3 | 4

export interface AuthResponse {
    accessToken: string
    refreshToken: string
    accountId: string
    requiresProfileSetup: boolean
    balanceCents: number
}

export interface UserPublicAccountDto {
    id: string;
    primaryAuthMethod: 0 | 1 | 2 | 3;
    solanaAddress: string | null;
    status: 'unverified' | 'active' | 'suspended' | 'closed';
    createdAt: string;
    updatedAt: string | null;
    isActive: boolean;
    userProfile: {
        id: string;
        username: string | null;
        displayName: string | null;
        role: string;
        createdAt: string;
        updatedAt: string | null;
    };
}

export interface UserBalanceDto {
    balanceCents: number;
}

export interface UserProfile {
    id: string
    username: string | null
    displayName: string | null
    status: 'unverified' | 'active' | 'suspended' | 'closed'
    balanceCents: number
    solanaAddress: string | null
    primaryAuthMethod: 0 | 1 | 2 | 3
    role: string
}

export interface ResolvedRecipient {
    accountId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
    isStendlyUser: boolean,
    solanaAddress: string
}

export interface FeeComponent {
    id: string
    name: string
    amountCents: number
    description: string
}

export interface FeeBreakdown {
    paymentAmountCents: number
    networkFeeCents: number
    stendlyFeeCents: number
    depegFeeCents: number
    totalFeeCents: number
    totalUserPaysCents: number
    usdcMintAddress: string
    calculatedAtUtc: string
    components: FeeComponent[]
}

export interface TransferResponse {
    transactionId: string
    newBalanceCents: number
    amountSentCents: number
    totalFeeCents: number
    status: 'completed' | 'pending' | 'failed'
}

export interface Transaction {
    id: string
    direction: 'sent' | 'received'
    amountCents: number
    feeCents: number
    status: 'pending' | 'completed' | 'failed' | 'cancelled'
    type: 'p2p_transfer' | 'merchant_payment' | 'top_up'
    counterpartyUsername: string | null
    counterpartyDisplayName: string | null
    note: string | null
    createdAt: string
    completedAt: string | null
}

export interface TransactionHistory {
    transactions: Transaction[]
    total: number
    skip: number
    take: number
    hasMore: boolean
}

export interface UsernameAvailability {
    available: boolean
    error?: string
}

export interface PublicPaymentIntentResponse {
    id: string
    merchantName: string
    expectedAmountCents: number
    destinationAddress: string
    status: string
    expiresAt: string
}

export interface MerchantProfileResponse {
    id: string
    name: string
    payoutAddress: string
    webhookUrl: string | null
    webhookSecret: string | null
    verificationStatus: number
    rawApiKey?: string | null
}

export const api = {
    auth: {
        start: (primaryChannel: 0 | 1 | 2, identifier: string, username?: string) =>
            request<AuthResponse>('/api/auth/start', {
                method: 'POST',
                body: JSON.stringify({primaryChannel, identifier, username: username ?? null}),
            }),
        verify: (identifier: string, code: string) =>
            request<AuthResponse>('/api/auth/verify', {
                method: 'POST',
                body: JSON.stringify({identifier, code}),
            }),
        refresh: () => refreshAccessToken(),
        logout: async () => {
            clearTokens();
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                headers: csrfHeaders,
                credentials: 'include',
            })
        },
    },
    users: {
        me: () => request<UserPublicAccountDto>('/api/users/me'),
        balance: () => request<UserBalanceDto>('/api/users/me/balance'),
        updateProfile: (data: {
            username?: string | null;
            displayName?: string | null;
            solanaAddress?: string | null;
            walletProof?: string | null;
        }) =>
            request<void>('/api/users/me/profile', {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        checkUsername: (username: string) =>
            request<UsernameAvailability>(
                `/api/users/check-username?username=${encodeURIComponent(username)}`,
            ),
        initWallet: (clientHash: string) =>
            request<{ serverMac: string }>('/api/users/wallet/init', {
                method: 'POST',
                body: JSON.stringify({clientHash})
            }),
        deriveWallet: (clientHash: string) =>
            request<{ serverMac: string }>('/api/users/wallet/derive', {
                method: 'POST',
                body: JSON.stringify({clientHash})
            }),
    },
    invoices: {
        get: (intentId: string) => request<PublicPaymentIntentResponse>(`/api/invoices/${intentId}`, {skipAuth: true}),
        getByTerminal: (terminalId: string) => request<PublicPaymentIntentResponse>(`/api/invoices/by-terminal/${terminalId}`, {skipAuth: true})
    },
    b2b: {
        me: () => request<MerchantProfileResponse>('/api/b2b/merchants/me'),
        getStats: () => request<any>('/api/b2b/merchants/stats'),
        submitKyb: (data: any) => request<void>('/api/b2b/merchants/kyb', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        generateKey: () => request<{ apiKey: string }>('/api/b2b/merchants/generate-key', {
            method: 'POST'
        }),
        updateWebhook: (webhookUrl: string) => request<void>('/api/b2b/merchants/webhook', {
            method: 'PATCH',
            body: JSON.stringify({webhookUrl})
        }),
        getTerminals: () => request<any[]>('/api/b2b/merchants/terminals'),
        createTerminal: (name: string) => request<any>('/api/b2b/merchants/terminals', {
            method: 'POST',
            body: JSON.stringify({name})
        })
    },
    admin: {
        verifySecret: (secret: string) => request<void>('/api/admin/merchants/verify-secret', {
            method: 'POST',
            body: JSON.stringify({secret})
        }),
        getPending: () => request<any[]>('/api/admin/merchants/pending'),
        approve: (id: string) => request<void>(`/api/admin/merchants/${id}/approve`, {method: 'POST'}),
        reject: (id: string) => request<void>(`/api/admin/merchants/${id}/reject`, {method: 'POST'})
    },
    transactions: {
        resolve: (method: ResolveMethod, value: string) =>
            request<ResolvedRecipient>('/api/transactions/resolve', {
                method: 'POST',
                body: JSON.stringify({method, value}),
            }),
        prepare: (payload: {
            recipientAccountId?: string;
            paymentIntentId?: string;
            amountCents: number;
            priorityLevel: number;
            idempotencyKey: string
        }) =>
            request<FeeBreakdown>('/api/transactions/prepare', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        build: (payload: { idempotencyKey: string }) =>
            request<{ base64UnsignedTransaction: string }>('/api/transactions/build', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        submit: (payload: { idempotencyKey: string; base64PartiallySignedTransaction: string }) =>
            request<TransferResponse>('/api/transactions/submit', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        unlock: (paymentIntentId: string) =>
            request<void>('/api/transactions/unlock', {
                method: 'POST',
                body: JSON.stringify({paymentIntentId}),
            }),
        history: (
            accountId: string,
            params?: {
                skip?: number
                take?: number
                direction?: 'sent' | 'received' | 'all'
            },
        ) => {
            const q = new URLSearchParams();
            if (params?.skip !== undefined) q.set('skip', String(params.skip));
            if (params?.take !== undefined) q.set('take', String(params.take));
            if (params?.direction) q.set('direction', params.direction);
            const qs = q.toString();
            return request<TransactionHistory>(
                `/api/transactions/${encodeURIComponent(accountId)}${qs ? `?${qs}` : ''}`,
            )
        },
    },
};
