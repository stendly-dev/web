'use client';

import posthog from 'posthog-js/dist/module.full.no-external';
import * as Sentry from '@sentry/nextjs';

export type ProductEvent =
    | 'wallet_landing_view' | 'auth_started' | 'email_submitted'
    | 'otp_requested' | 'otp_verified' | 'pin_create_started' | 'pin_created'
    | 'wallet_created' | 'private_key_backup_shown' | 'private_key_backup_copied'
    | 'private_key_backup_skipped' | 'wallet_home_viewed' | 'returning_user_wallet_opened'
    | 'wallet_funded' | 'deposit_detected' | 'deposit_address_copied'
    | 'qr_scan_opened' | 'qr_scanner_opened' | 'qr_parsed' | 'qr_parse_failed'
    | 'fiat_topup_provider_opened'
    | 'send_started' | 'send_recipient_entered' | 'send_amount_entered'
    | 'fee_quote_requested' | 'fee_quote_succeeded' | 'fee_quote_failed'
    | 'send_fee_quote_failed' | 'insufficient_balance' | 'insufficient_fee_balance'
    | 'transaction_confirm_opened' | 'transaction_signed'
    | 'transaction_broadcast_started' | 'transaction_broadcast_succeeded'
    | 'transaction_broadcast_failed' | 'transaction_succeeded' | 'transaction_failed' | 'merchant_landing_view'
    | 'merchant_signup_started' | 'merchant_signup_completed' | 'kyb_form_viewed'
    | 'merchant_signup_ui_completed' | 'kyb_submit_started' | 'merchant_dashboard_loaded'
    | 'kyb_submitted' | 'kyb_approved' | 'api_key_page_viewed' | 'api_key_generated'
    | 'api_key_ui_generated' | 'webhook_secret_ui_generated' | 'webhook_url_ui_updated' | 'terminal_ui_created'
    | 'webhook_page_viewed' | 'webhook_secret_generated' | 'webhook_url_updated'
    | 'terminal_created' | 'payment_intent_created' | 'checkout_link_opened'
    | 'payment_intent_paid' | 'checkout_payment_observed' | 'webhook_delivered' | 'webhook_failed'
    | 'spend_tab_opened' | 'spend_product_viewed' | 'spend_order_created'
    | 'spend_order_paid' | 'spend_order_delivered'
    | 'frontend_error' | 'api_error' | 'worker_error' | 'transaction_error';

type Properties = Record<string, string | number | boolean | null | undefined>;
const forbiddenKey = /(email|identifier|otp|pin|private|secret|api[_-]?key|authorization|address|signature|body|payload)$/i;
const forbiddenValue = /\b(st_(live|test)_[A-Za-z0-9]+|Bearer\s+\S+)\b/i;

function sanitize(properties: Properties = {}): Properties {
    return Object.fromEntries(Object.entries(properties).filter(([key, value]) =>
        !forbiddenKey.test(key) && value != null && (['number', 'boolean'].includes(typeof value) ||
            (typeof value === 'string' && value.trim().length > 0 && value.length <= 256 && !forbiddenValue.test(value)))));
}

export function analyticsNetwork(): 'mainnet' | 'devnet' {
    return typeof window !== 'undefined' && window.location.hostname.includes('devnet') ? 'devnet' : 'mainnet';
}

export function amountBucket(cents: number): '0-5' | '5-20' | '20-100' | '100+' {
    if (cents < 500) return '0-5';
    if (cents < 2000) return '5-20';
    if (cents < 10000) return '20-100';
    return '100+';
}

export function moneyProperties(amountCents: number, properties: Properties = {}): Properties {
    return {
        amount_cents: amountCents,
        amount: amountCents / 100,
        amount_bucket: amountBucket(amountCents),
        currency: 'USD',
        asset: 'USDC',
        settlement_network: 'solana',
        ...properties,
    };
}

export function captureProductEvent(event: ProductEvent, properties: Properties = {}): void {
    if (typeof window === 'undefined') return;
    posthog.capture(event, sanitize({
        event_schema_version: 2,
        app: 'web',
        environment: process.env.NEXT_PUBLIC_APP_ENV || analyticsNetwork(),
        release: process.env.NEXT_PUBLIC_RELEASE || process.env.NEXT_PUBLIC_GIT_SHA,
        network: analyticsNetwork(),
        asset: 'USDC',
        page_path: window.location.pathname,
        page_title: document.title.slice(0, 256),
        locale: document.documentElement.lang || navigator.language,
        ...properties,
    }));
}

export function captureProductError(
    error: unknown,
    event: Extract<ProductEvent, 'frontend_error' | 'api_error' | 'worker_error' | 'transaction_error'>,
    properties: Properties = {},
): void {
    const safe = sanitize(properties);
    const errorType = error instanceof Error ? error.name : typeof error;
    const operation = typeof safe.operation === 'string' ? safe.operation : event;
    Sentry.captureException(new Error(`${operation} failed (${errorType})`), {
        tags: {app: 'web', event, network: analyticsNetwork()},
        extra: safe,
    });
    posthog.captureException(error, {
        app: 'web',
        product_event: event,
        error_type: errorType,
        operation,
        network: analyticsNetwork(),
        ...safe,
    });
    posthog.logger.error(`${operation} failed`, {
        app: 'web',
        event,
        error_type: errorType,
        network: analyticsNetwork(),
        ...safe,
    });
    captureProductEvent(event, safe);
}

async function hashIdentifier(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function identifyAnalyticsUser(accountId: string, merchantId?: string): Promise<void> {
    if (!accountId || typeof window === 'undefined') return;
    const userId = await hashIdentifier(accountId);
    posthog.identify(userId, {
        app: 'web',
        environment: process.env.NEXT_PUBLIC_APP_ENV || analyticsNetwork(),
        network: analyticsNetwork(),
    });
    Sentry.setUser({id: userId});
    if (merchantId) {
        const merchantHash = await hashIdentifier(merchantId);
        posthog.group('merchant', merchantHash, {
            environment: process.env.NEXT_PUBLIC_APP_ENV || analyticsNetwork(),
            network: analyticsNetwork(),
        });
        Sentry.setTag('merchant.id', merchantHash);
    }
}

export function resetAnalyticsIdentity(): void {
    if (typeof window === 'undefined') return;
    posthog.reset();
    Sentry.setUser(null);
}
