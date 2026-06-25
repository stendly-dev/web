import {Keypair, PublicKey, Transaction} from '@solana/web3.js'
import {base64ToBuffer, bufferToBase64, encodeBase58} from "@/lib/utils";

async function deriveKeyEncryptionKey(serverMac: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(serverMac), {name: 'PBKDF2'}, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-512'},
        keyMaterial, {name: 'AES-KW', length: 256}, false, ['wrapKey', 'unwrapKey']
    );
}

async function importWalletBlob(blobStr: string, serverMac: string): Promise<{
    secretKey: Uint8Array;
    publicKey: string
}> {
    const payload = JSON.parse(blobStr)
    const salt = new Uint8Array(base64ToBuffer(payload.salt))
    const iv = new Uint8Array(base64ToBuffer(payload.iv))
    const wrappedKeyData = base64ToBuffer(payload.wrappedKey)
    const encryptedData = base64ToBuffer(payload.data)

    const kek = await deriveKeyEncryptionKey(serverMac, salt)
    const dek = await crypto.subtle.unwrapKey(
        'raw', wrappedKeyData, kek, 'AES-KW', {name: 'AES-GCM', length: 256}, false, ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, dek, encryptedData)
    const keypair = Keypair.fromSecretKey(new Uint8Array(decrypted))

    return {secretKey: keypair.secretKey, publicKey: keypair.publicKey.toBase58()}
}

async function importPrivateKey(secretKeyArray: number[], serverMac: string, saltBase64: string): Promise<{
    secretKey: Uint8Array;
    publicKey: string;
    blobStr: string
}> {
    const secretKey = new Uint8Array(secretKeyArray);
    const keypair = Keypair.fromSecretKey(secretKey);
    const salt = new Uint8Array(base64ToBuffer(saltBase64));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const kek = await deriveKeyEncryptionKey(serverMac, salt);
    const dek = await crypto.subtle.generateKey(
        {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']
    );

    const wrappedKey = await crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW');
    const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, dek, secretKey);

    const payload = {
        salt: saltBase64,
        iv: bufferToBase64(iv),
        wrappedKey: bufferToBase64(wrappedKey),
        data: bufferToBase64(encrypted),
        address: keypair.publicKey.toBase58(),
    };

    return {secretKey: keypair.secretKey, publicKey: keypair.publicKey.toBase58(), blobStr: JSON.stringify(payload)};
}

async function generateAndSaveWallet(serverMac: string, saltBase64: string): Promise<{
    secretKey: Uint8Array;
    publicKey: string;
    blobStr: string
}> {
    const keypair = Keypair.generate()
    const secretKey = keypair.secretKey

    const salt = new Uint8Array(base64ToBuffer(saltBase64))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const kek = await deriveKeyEncryptionKey(serverMac, salt)
    const dek = await crypto.subtle.generateKey(
        {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']
    );

    const wrappedKey = await crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW');
    const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, dek, secretKey)

    const payload = {
        salt: saltBase64,
        iv: bufferToBase64(iv),
        wrappedKey: bufferToBase64(wrappedKey),
        data: bufferToBase64(encrypted),
        address: keypair.publicKey.toBase58(),
    }

    return {secretKey: keypair.secretKey, publicKey: keypair.publicKey.toBase58(), blobStr: JSON.stringify(payload)}
}

async function signTransactionBase64(
    unsignedBase64: string,
    serverMac: string,
    blobStr: string,
    expectedRecipient?: string,
    expectedAmountCents?: number,
    usdcMintAddress?: string,
    expectedFeeCents?: number
): Promise<string> {
    const {secretKey} = await importWalletBlob(blobStr, serverMac);
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

    const binaryString = atob(unsignedBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }

    const tx = Transaction.from(bytes)

    if (expectedRecipient && expectedAmountCents && usdcMintAddress) {
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

        let owner: PublicKey;
        let mint: PublicKey;

        try {
            owner = new PublicKey(expectedRecipient);
            mint = new PublicKey(usdcMintAddress);
        } catch (e) {
            throw new Error(`Invalid address format for validation: ${expectedRecipient}`);
        }

        const [expectedAta] = PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
        );
        const expectedAtaBase58 = expectedAta.toBase58();

        let primaryTransferFound = false;
        let feeTransferFound = false;
        const expectedLamports = BigInt(expectedAmountCents) * BigInt(10000);
        const expectedFeeLamports = BigInt(expectedFeeCents || 0) * BigInt(10000);

        const ALLOWED_PROGRAMS = [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
            'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
            'ComputeBudget111111111111111111111111111111'
        ];

        for (const ix of tx.instructions) {
            const programIdBase58 = ix.programId.toBase58();

            if (!ALLOWED_PROGRAMS.includes(programIdBase58)) {
                throw new Error(`Security Alert: Unauthorized program detected (${programIdBase58}).`);
            }

            if (programIdBase58 === TOKEN_PROGRAM_ID.toBase58()) {
                if (ix.data[0] === 3 && ix.data.length === 9) {
                    const amount = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength).getBigUint64(1, true);

                    if (amount === expectedLamports && ix.keys.length >= 2 && ix.keys[1].pubkey.toBase58() === expectedAtaBase58) {
                        primaryTransferFound = true;
                        continue;
                    }

                    if (expectedFeeLamports > BigInt(0) && amount === expectedFeeLamports && !feeTransferFound) {
                        feeTransferFound = true;
                        continue;
                    }

                    throw new Error("Security Alert: Malicious token transfer detected.");
                } else {
                    throw new Error("Security Alert: Unauthorized token instruction detected.");
                }
            }
        }
        if (!primaryTransferFound) {
            throw new Error("Security Alert: Transaction verification failed. Primary transfer missing.");
        }
    }

    try {
        tx.partialSign(keypair)
    } catch (e: any) {
        if (e.message?.includes('unknown signer')) {
            throw new Error('Transaction does not require a signature from this wallet.')
        }
        throw e
    }

    const serialized = tx.serialize({requireAllSignatures: false})
    let binary = ''
    for (let i = 0; i < serialized.byteLength; i++) {
        binary += String.fromCharCode(serialized[i])
    }
    return btoa(binary)
}

type WalletWorkerRequest =
    | { type: 'importWalletBlob'; payload: { blobStr: string; serverMac: string } }
    | { type: 'generateAndSaveWallet'; payload: { serverMac: string; saltBase64: string } }
    | { type: 'importPrivateKey'; payload: { secretKeyArray: number[]; serverMac: string; saltBase64: string } }
    | {
    type: 'signTransactionBase64';
    payload: {
        unsignedBase64: string;
        serverMac: string;
        blobStr: string;
        expectedRecipient?: string;
        expectedAmountCents?: number;
        usdcMintAddress?: string;
        expectedFeeCents?: number
    }
}
    | { type: 'exportPrivateKeyBase58'; payload: { blobStr: string; serverMac: string } }

self.addEventListener('message', async (event: MessageEvent<WalletWorkerRequest>) => {
    const {type, payload} = event.data
    try {
        switch (type) {
            case 'importWalletBlob': {
                const result = await importWalletBlob(payload.blobStr, payload.serverMac)
                self.postMessage({
                    type: 'result',
                    result: {secretKey: Array.from(result.secretKey), publicKey: result.publicKey}
                })
                break
            }
            case 'generateAndSaveWallet': {
                const result = await generateAndSaveWallet(payload.serverMac, payload.saltBase64)
                self.postMessage({
                    type: 'result',
                    result: {
                        secretKey: Array.from(result.secretKey),
                        publicKey: result.publicKey,
                        blobStr: result.blobStr
                    },
                })
                break
            }
            case 'importPrivateKey': {
                const result = await importPrivateKey(payload.secretKeyArray, payload.serverMac, payload.saltBase64)
                self.postMessage({
                    type: 'result',
                    result: {
                        secretKey: Array.from(result.secretKey),
                        publicKey: result.publicKey,
                        blobStr: result.blobStr
                    },
                })
                break
            }
            case 'signTransactionBase64': {
                const result = await signTransactionBase64(payload.unsignedBase64, payload.serverMac, payload.blobStr, payload.expectedRecipient, payload.expectedAmountCents, payload.usdcMintAddress, payload.expectedFeeCents)
                self.postMessage({type: 'result', result})
                break
            }
            case 'exportPrivateKeyBase58': {
                const {secretKey} = await importWalletBlob(payload.blobStr, payload.serverMac)
                self.postMessage({type: 'result', result: encodeBase58(secretKey)})
                break
            }
            default:
                self.postMessage({type: 'error', error: 'Unknown request type'})
        }
    } catch (error) {
        self.postMessage({type: 'error', error: error instanceof Error ? error.message : String(error)})
    }
})
