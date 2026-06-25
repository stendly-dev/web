import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'
import Decimal from 'decimal.js'
import {Transaction} from './api'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Formats a cent amount as a currency string.
 * Uses Decimal.js to avoid floating-point errors.
 */
export function formatCents(cents: number | undefined | null, forceSign = false): string {
    if (cents == null || isNaN(Number(cents))) return '$0.00'
    const d = new Decimal(cents)
    const sign = d.isNegative() ? '-' : forceSign && d.isPositive() ? '+' : ''
    const abs = d.abs().div(100)
    return `${sign}$${abs.toFixed(2)}`
}

const AMOUNT_REGEX = /^[+-]?\d+(\.\d{1,2})?$/

/**
 * Parses a user-entered amount string into cents.
 * Strictly validates input before conversion.
 * Uses Decimal.js to avoid floating-point errors.
 */
export function parseAmountToCents(amountStr: string): number {
    const trimmed = amountStr.trim()
    if (!AMOUNT_REGEX.test(trimmed)) return 0

    try {
        const d = new Decimal(trimmed)
        return d.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber()
    } catch {
        return 0
    }
}

export function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
}

export function base64ToBuffer(b64: string): ArrayBuffer {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
}

export function encodeBase58(buffer: Uint8Array | ArrayBuffer): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const digits = [0];
    for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
        }
    }
    let zeroes = 0;
    while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes++;
    return ALPHABET[0].repeat(zeroes) + digits.reverse().map(d => ALPHABET[d]).join('');
}

export function decodeBase58(base58: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP: Record<string, number> = {};
    for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;

    if (base58.length === 0) return new Uint8Array(0);
    const bytes = [0];
    for (let i = 0; i < base58.length; i++) {
        const c = base58[i];
        if (!(c in ALPHABET_MAP)) throw new Error('Invalid Base58 character');
        let carry = ALPHABET_MAP[c];
        for (let j = 0; j < bytes.length; j++) {
            carry += bytes[j] * 58;
            bytes[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }
    for (let i = 0; i < base58.length && base58[i] === '1'; i++) {
        bytes.push(0);
    }
    return new Uint8Array(bytes.reverse());
}

export function txCounterpartyLabel(tx: Transaction, profile?: {
    username?: string | null;
    displayName?: string | null
}): string {
    if (tx.type === 'merchant_payment') {
        return tx.counterpartyDisplayName && tx.counterpartyDisplayName !== "Anonymous"
            ? tx.counterpartyDisplayName
            : 'Merchant';
    }

    if (tx.type === 'top_up') {
        return tx.counterpartyDisplayName && tx.counterpartyDisplayName !== "Anonymous"
            ? tx.counterpartyDisplayName
            : 'External Deposit';
    }

    if (tx.counterpartyUsername) return `@${tx.counterpartyUsername}`
    if (tx.counterpartyDisplayName && tx.direction === 'received') {
        return tx.counterpartyDisplayName
    }
    return 'Transfer'
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
export const API_HEALTH_CHECK_TIMEOUT_MS = 15000;
export const API_BACKEND_HEALTH_CHECK_TIMEOUT_MS = 5000;
export const WALLET_DB_NAME = 'StendlyWalletDB';
export const WALLET_STORE_NAME = 'wallets';