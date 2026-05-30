import crypto from 'node:crypto';
import { Results } from '../types/StandardResponse.js';


/**
 * Configuration options for the encryption and key derivation process.
 */
export interface EncryptionConfig {
   /** Options for the scrypt key derivation function. */
   scrypt?: {
     /** The length of the generated derived key in bytes (default: 32). */
     keyLength?: number;
     /** The length of the random salt in bytes (default: 32). */
     saltLength?: number;
     /** Memory and CPU cost parameters for scrypt. */
     params?: {
        /** The CPU/memory cost parameter (must be a power of 2, default: 16384). */
        n?: number;
        /** The block size parameter (default: 8). */
        r?: number;
        /** The parallelization parameter (default: 1). */
        p?: number
     }
   },
   /** The length of the Initialization Vector (IV) in bytes for AES-GCM (default: 12). */
   initializationVectorLength?: number 
}

export interface EncryptionInstance {
  /**
   * Converts unknown data into a Buffer or Uint8Array.
   * If the data is an object, it will be stringified to JSON first.
   * 
   * @param data - The data to convert.
   * @returns A Buffer or Uint8Array representation of the data.
   * @throws {Error} If the data cannot be converted or stringified.
   */
  toBuffer: (data: unknown) => Buffer | Uint8Array;

  /**
   * Encrypts the provided data using AES-256-GCM.
   * A random salt and IV are generated, and the encryption key is derived using scrypt.
   * 
   * @param data - The data to encrypt (can be a string, number, object, or buffer).
   * @param password - The secret password used to derive the encryption key.
   * @returns A Results object containing the combined encrypted buffer (salt + IV + tag + ciphertext) if successful.
   */
  encrypt: (data: unknown, password: string) => Results<Buffer>;

  /**
   * Decrypts a buffer that was encrypted using this utility's `encrypt` function.
   * Extracts the salt, IV, and tag from the buffer to re-derive the key and verify integrity.
   * Automatically attempts to parse the decrypted data as JSON.
   * 
   * @template T - The expected type of the decrypted data.
   * @param encrypted - The combined buffer containing the salt, IV, tag, and ciphertext.
   * @param password - The secret password used during encryption.
   * @returns A Results object containing the decrypted and optionally parsed data.
   */
  decrypt: <T>(encrypted: Buffer, password: string) => Results<T>;
}

/**
 * Initializes the encryption utility with the provided configuration options.
 * 
 * @param options - Custom configuration for scrypt and encryption lengths.
 * @returns An object containing `encrypt`, `decrypt`, and `toBuffer` helper functions.
 */
export function encryption(options: EncryptionConfig = {}): EncryptionInstance {
   const config = {
        scrypt: {
            keyLength: options.scrypt?.keyLength ?? 32,
            saltLength: options.scrypt?.saltLength ?? 32,
            params: { 
                N: options.scrypt?.params?.n ?? 16384,
                r: options.scrypt?.params?.r ?? 8,
                p: options.scrypt?.params?.p ?? 1
              }
        },
        initializationVectorLength: options.initializationVectorLength ?? 12
   }; 

  const toBuffer = (data: unknown): Buffer | Uint8Array => {

      if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
         return data;
      }

      try {
          return Buffer.from(JSON.stringify(data), 'utf8');
      } catch (err) {
          throw new Error('Failed to convert data to buffer: ' + (err as Error).message);
      }
  };

  const encrypt = (data: unknown, password: string): Results<Buffer> => {
      try {
        const binaryData = toBuffer(data);
        const iv = crypto.randomBytes(config.initializationVectorLength);
        const salt = crypto.randomBytes(config.scrypt.saltLength);
        const key = crypto.scryptSync(password, salt, config.scrypt.keyLength, config.scrypt.params);
        
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(binaryData), cipher.final()]);
        const tag = cipher.getAuthTag();
    
        return {
            ok: true,
            date: new Date().toISOString(),
            data: Buffer.concat([salt, iv, tag, encrypted])
        };
      } catch (err) {
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: `Encryption failed: ${(err as Error).message}`
            };
      }
};

  const decrypt = <T>(encrypted: Buffer, password: string): Results<T> => {
    try {
      const saltLen = config.scrypt.saltLength;
      const ivLen = config.initializationVectorLength; 
      const tagLen = 16;
      const minLength = saltLen + ivLen + tagLen;

      if (encrypted.length < minLength) {
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Invalid encrypted data format'
        };
      }

      let offset = 0;
      const salt = encrypted.subarray(offset, offset += saltLen);
      const iv = encrypted.subarray(offset, offset += ivLen);
      const tag = encrypted.subarray(offset, offset += tagLen);
      const ciphertext = encrypted.subarray(offset);

      const key = crypto.scryptSync(password, salt, config.scrypt.keyLength, config.scrypt.params);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      const decryptedBytes = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
     ]);

      let finalData: unknown;
      try {
        finalData = JSON.parse(decryptedBytes.toString('utf8'));
      } catch {
         finalData = decryptedBytes;
      }
      return {
          ok: true,
          date: new Date().toISOString(),
          data: finalData as T
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : null;
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ERR_CRYPTO_OPERATION_FAILED' || err?.message.toLowerCase().includes('unsupported state')) {
        return { 
            ok: false,
            date: new Date().toISOString(),
            reason: 'Incorrect password or data' 
        };
      }
      return { 
        ok: false,
        date: new Date().toISOString(),
        reason: 'Decryption failure: ' + (err?.message ?? 'Unknown error') 
    };
    }
  };

  return {
    toBuffer,
    decrypt,
    encrypt
  };
};