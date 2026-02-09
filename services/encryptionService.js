import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive a 32-byte key from the env variable (or generate a warning)
function getEncryptionKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        console.warn('[Encryption] ENCRYPTION_KEY not set in .env — session encryption is DISABLED. Data will be stored in plain text.');
        return null;
    }
    // If key is hex-encoded (64 chars = 32 bytes)
    if (/^[0-9a-f]{64}$/i.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    // Otherwise, derive key using SHA-256
    return crypto.createHash('sha256').update(raw).digest();
}

const ENCRYPTION_KEY = getEncryptionKey();

export function encrypt(plaintext) {
    if (!ENCRYPTION_KEY) return plaintext;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: enc:iv:authTag:ciphertext
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(data) {
    if (!ENCRYPTION_KEY) return data;

    // If data doesn't start with 'enc:', it's plain text (legacy/unencrypted)
    if (!data || !data.startsWith('enc:')) {
        return data;
    }

    const parts = data.split(':');
    if (parts.length !== 4) {
        console.warn('[Encryption] Invalid encrypted data format, returning raw');
        return data;
    }

    const [, ivHex, authTagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function isEncrypted(data) {
    return data && data.startsWith('enc:');
}
