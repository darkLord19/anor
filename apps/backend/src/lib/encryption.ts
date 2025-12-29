import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_SECRET environment variable is required');
  }
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secret, 'dotor-token-salt', 32);
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: base64 encoded string containing IV + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt a string that was encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract IV, authTag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Encrypt tokens object
 */
export function encryptTokens(tokens: {
  access_token: string;
  refresh_token: string;
}): {
  access_token: string;
  refresh_token: string;
} {
  return {
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token),
  };
}

/**
 * Decrypt tokens object
 */
export function decryptTokens(encryptedTokens: {
  access_token: string;
  refresh_token: string;
}): {
  access_token: string;
  refresh_token: string;
} {
  return {
    access_token: decrypt(encryptedTokens.access_token),
    refresh_token: decrypt(encryptedTokens.refresh_token),
  };
}

