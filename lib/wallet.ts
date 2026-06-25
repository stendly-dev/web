import {Keypair} from '@solana/web3.js'
import {api, getStoredAccountId} from './api'
import {base64ToBuffer, bufferToBase64, decodeBase58, WALLET_DB_NAME, WALLET_STORE_NAME} from "@/lib/utils";
import {captureProductError} from '@/lib/analytics';

function getStorageKey(): string {
    const accountId = getStoredAccountId() || 'default'
    return `stendly_wallet_${accountId}`
}

async function computeClientHash(pin: string, salt: Uint8Array): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), {name: 'PBKDF2'}, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        {name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256'},
        keyMaterial, 256
    );
    return bufferToBase64(bits);
}

async function hashAddress(address: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(address);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(WALLET_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(WALLET_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbSet(key: string, value: any): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLET_STORE_NAME, 'readwrite');
        const store = tx.objectStore(WALLET_STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function idbGet(key: string): Promise<any> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLET_STORE_NAME, 'readonly');
        const store = tx.objectStore(WALLET_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbDelete(key: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLET_STORE_NAME, 'readwrite');
        const store = tx.objectStore(WALLET_STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getAttemptsKey(): string {
    return `${getStorageKey()}_attempts`;
}

let workerInstance: Worker | null = null

function getWorker(): Worker | null {
    if (typeof window === 'undefined') return null
    if (typeof Worker === 'undefined') return null
    if (!workerInstance) {
        workerInstance = new Worker(new URL('./wallet.worker.ts', import.meta.url))
    }
    return workerInstance
}

function callWorker<T>(type: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
        const worker = getWorker()
        if (!worker) {
            reject(new Error('Worker not available'))
            return
        }

        const handler = (event: MessageEvent) => {
            if (event.data.type === 'result') {
                worker.removeEventListener('message', handler)
                resolve(event.data.result as T)
            } else if (event.data.type === 'error') {
                worker.removeEventListener('message', handler)
                captureProductError(new Error('Wallet worker operation failed'), 'worker_error', {
                    operation: type,
                    error_code: 'WORKER_OPERATION_FAILED',
                });
                reject(new Error(event.data.error))
            }
        }

        worker.addEventListener('message', handler)
        worker.postMessage({type, payload})
    })
}

export async function deleteLocalWallet(): Promise<void> {
    if (typeof window === 'undefined') return;
    const key = getStorageKey();
    await idbDelete(key);
}

export async function hasLocalWallet(expectedAddress: string): Promise<boolean> {
    if (typeof window === 'undefined') return false
    const key = getStorageKey()
    const expectedHash = await hashAddress(expectedAddress);

    try {
        const payload = await idbGet(key);
        if (payload && payload.addressHash === expectedHash) {
            return true;
        }
    } catch {
        // TODO
    }

    return false
}

export async function getWalletBlobAsync(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
        const payload = await idbGet(getStorageKey());
        return payload ? JSON.stringify(payload) : null;
    } catch {
        return null;
    }
}

export async function importWalletBlob(blobStr: string, pin: string): Promise<Keypair> {
    const payload = JSON.parse(blobStr);
    const salt = new Uint8Array(base64ToBuffer(payload.salt));

    const clientHash = await computeClientHash(pin, salt);

    let serverMac: string;
    try {
        const res = await api.users.deriveWallet(clientHash);
        serverMac = res.serverMac;
    } catch (e: any) {
        throw new Error(e.message || 'Invalid PIN or wallet locked.');
    }

    const worker = getWorker();
    if (worker) {
        const result = await callWorker<{ secretKey: number[]; publicKey: string }>('importWalletBlob', {
            blobStr,
            serverMac
        })
        const keypair = Keypair.fromSecretKey(new Uint8Array(result.secretKey))
        payload.addressHash = await hashAddress(result.publicKey)
        delete payload.address;
        const key = getStorageKey()
        await idbSet(key, payload)
        return keypair
    }
    throw new Error("Worker required for cryptography");
}

export async function importPrivateKeyBase58Async(privateKeyBase58: string, pin: string): Promise<Keypair> {
    const secretKey = decodeBase58(privateKeyBase58);
    if (secretKey.length !== 64) throw new Error('Invalid private key length');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const clientHash = await computeClientHash(pin, salt);

    const res = await api.users.initWallet(clientHash);
    const serverMac = res.serverMac;

    const worker = getWorker();
    if (worker) {
        const result = await callWorker<{
            secretKey: number[];
            publicKey: string;
            blobStr: string
        }>('importPrivateKey', {
            secretKeyArray: Array.from(secretKey),
            serverMac,
            saltBase64: bufferToBase64(salt)
        });
        const keypair = Keypair.fromSecretKey(new Uint8Array(result.secretKey));
        const storageKey = getStorageKey();
        const payload = JSON.parse(result.blobStr);
        payload.addressHash = await hashAddress(result.publicKey);
        delete payload.address;
        await idbSet(storageKey, payload);
        await api.users.updateProfile({solanaAddress: result.publicKey, walletProof: serverMac});
        return keypair;
    }
    throw new Error("Worker required for cryptography");
}

export async function generateAndSaveWallet(pin: string): Promise<Keypair> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const clientHash = await computeClientHash(pin, salt);

    const res = await api.users.initWallet(clientHash);
    const serverMac = res.serverMac;

    const worker = getWorker();
    if (worker) {
        const result = await callWorker<{
            secretKey: number[];
            publicKey: string;
            blobStr: string
        }>('generateAndSaveWallet', {serverMac, saltBase64: bufferToBase64(salt)})
        const keypair = Keypair.fromSecretKey(new Uint8Array(result.secretKey))
        const storageKey = getStorageKey()
        const payload = JSON.parse(result.blobStr)
        payload.addressHash = await hashAddress(result.publicKey)
        delete payload.address;
        await idbSet(storageKey, payload)
        await api.users.updateProfile({solanaAddress: result.publicKey, walletProof: serverMac})
        return keypair
    }
    throw new Error("Worker required for cryptography");
}

export async function verifyPinAsync(pin: string): Promise<boolean> {
    const blobStr = await getWalletBlobAsync()
    if (!blobStr) throw new Error('Wallet not found locally.');

    const payload = JSON.parse(blobStr);
    const salt = new Uint8Array(base64ToBuffer(payload.salt));
    const clientHash = await computeClientHash(pin, salt);

    let serverMac: string;
    try {
        const res = await api.users.deriveWallet(clientHash);
        serverMac = res.serverMac;
    } catch (e: any) {
        throw new Error(e.message || 'Invalid PIN or wallet locked.');
    }

    const worker = getWorker();
    if (worker) {
        await callWorker<string>('exportPrivateKeyBase58', {blobStr, serverMac});
        return true;
    }
    throw new Error("Worker required for cryptography");
}

export async function exportPrivateKeyBase58Async(pin: string): Promise<string> {
    const blobStr = await getWalletBlobAsync()
    if (!blobStr) throw new Error('Wallet not found.');

    const payload = JSON.parse(blobStr);
    const salt = new Uint8Array(base64ToBuffer(payload.salt));
    const clientHash = await computeClientHash(pin, salt);

    let serverMac: string;
    try {
        const res = await api.users.deriveWallet(clientHash);
        serverMac = res.serverMac;
    } catch (e: any) {
        throw new Error(e.message || 'Invalid PIN or wallet locked.');
    }

    const worker = getWorker();
    if (worker) {
        return await callWorker<string>('exportPrivateKeyBase58', {blobStr, serverMac});
    }
    throw new Error("Worker required for cryptography");
}

export async function signTransactionBase64(
    unsignedBase64: string,
    pin: string,
    expectedRecipient?: string,
    expectedAmountCents?: number,
    usdcMintAddress?: string,
    expectedFeeCents?: number
): Promise<string> {
    const blobStr = await getWalletBlobAsync()
    if (!blobStr) throw new Error('Wallet not found.');

    const payload = JSON.parse(blobStr);
    const salt = new Uint8Array(base64ToBuffer(payload.salt));
    const clientHash = await computeClientHash(pin, salt);

    let serverMac: string;
    try {
        const res = await api.users.deriveWallet(clientHash);
        serverMac = res.serverMac;
    } catch (e: any) {
        throw new Error(e.message || 'Invalid PIN or wallet locked.');
    }

    const worker = getWorker();
    if (worker) {
        return await callWorker<string>('signTransactionBase64', {
            unsignedBase64,
            serverMac,
            blobStr,
            expectedRecipient,
            expectedAmountCents,
            usdcMintAddress,
            expectedFeeCents
        });
    }
    throw new Error("Worker required for cryptography");
}
