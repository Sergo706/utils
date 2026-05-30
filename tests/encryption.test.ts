import { describe, it } from 'node:test';
import assert from 'node:assert';
import { encryption } from '../server/encryption.js';

describe('Encryption Utility', () => {
  describe('Initialization & Config', () => {

    it('should use default configuration if none provided', () => {
      const { encrypt } = encryption();
      const res = encrypt('test', 'password');
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        // default IV is 12, salt is 32, tag is 16 = 60 bytes
        // "test" stringified is '"test"' which is 6 bytes.
        assert.strictEqual(res.data.length, 66);
      }
    });

    it('should use custom configuration', () => {
      const customConfig = {
        scrypt: { saltLength: 16 },
        initializationVectorLength: 16
      };
      const { encrypt } = encryption(customConfig);
      const res = encrypt('test', 'password');
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        // salt 16 + iv 16 + tag 16 = 48 bytes overhead + 6 bytes data = 54
        assert.strictEqual(res.data.length, 54);
      }
    });
  });

  describe('encrypt() & toBuffer()', () => {
    const { encrypt } = encryption();
    
    it('should successfully encrypt an object', () => {
      const res = encrypt({ key: 'value' }, 'password');
      assert.strictEqual(res.ok, true);
    });

    it('should successfully encrypt a string', () => {
      const res = encrypt('hello', 'password');
      assert.strictEqual(res.ok, true);
    });

    it('should successfully encrypt a number', () => {
      const res = encrypt(42, 'password');
      assert.strictEqual(res.ok, true);
    });

    it('should successfully encrypt a boolean', () => {
      const res = encrypt(true, 'password');
      assert.strictEqual(res.ok, true);
    });

    it('should successfully encrypt raw Buffer/Uint8Array', () => {
      const rawData = Buffer.from('raw binary');
      const res = encrypt(rawData, 'password');
      assert.strictEqual(res.ok, true);
    });
    
    it('should handle un stringifiable data', () => {
      const res = encrypt(10n, 'password');
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.ok(res.reason.includes('Failed to convert data'));
      }
    });
  });

  describe('decrypt()', () => {
    const { encrypt, decrypt } = encryption();
    const password = 'my_secure_password';

    it('should decrypt back to an object', () => {
      const originalData = { user: 'admin', roles: ['super', 'user'] };
      const enc = encrypt(originalData, password);
      assert.strictEqual(enc.ok, true);
      
      if (enc.ok) {
        const dec = decrypt<{ user: string, roles: string[] }>(enc.data, password);
        assert.strictEqual(dec.ok, true);
        if (dec.ok) {
          assert.deepStrictEqual(dec.data, originalData);
        }
      }
    });

    it('should fail decryption if password is wrong', () => {
      const enc = encrypt('test secret', password);
      assert.strictEqual(enc.ok, true);
      
      if (enc.ok) {
        const dec = decrypt(enc.data, 'wrong_password');
        assert.strictEqual(dec.ok, false);
        if (!dec.ok) {
          assert.strictEqual(dec.reason, 'Incorrect password or data');
        }
      }
    });

    it('should fail decryption if data format is too short', () => {
      const dec = decrypt(Buffer.from('short'), password);
      assert.strictEqual(dec.ok, false);
      if (!dec.ok) {
        assert.strictEqual(dec.reason, 'Invalid encrypted data format');
      }
    });

    it('should fail decryption if data integrity is compromised', () => {
      const enc = encrypt('super secret data', password);
      assert.strictEqual(enc.ok, true);
      
      if (enc.ok) {
        const tampered = Buffer.from(enc.data);
        tampered[tampered.length - 1] ^= 1;

        const dec = decrypt(tampered, password);
        assert.strictEqual(dec.ok, false);
        if (!dec.ok) {
          assert.strictEqual(dec.reason, 'Incorrect password or data');
        }
      }
    });

    it('should fail decryption if tag is tampered', () => {
      const enc = encrypt('super secret data', password);
      assert.strictEqual(enc.ok, true);
      
      if (enc.ok) {
        const tampered = Buffer.from(enc.data);
        tampered[45] ^= 1;

        const dec = decrypt(tampered, password);
        assert.strictEqual(dec.ok, false);
        if (!dec.ok) {
          assert.strictEqual(dec.reason, 'Incorrect password or data');
        }
      }
    });

    it('should fallback to raw bytes if data is not JSON parseable', () => {
      const { encrypt: encryptRaw, decrypt: decryptRaw } = encryption();
      
      const rawBuf = Buffer.from('not json object { ]');
      const enc = encryptRaw(rawBuf, password);
      assert.strictEqual(enc.ok, true);
      
      if (enc.ok) {
        const dec = decryptRaw<Buffer>(enc.data, password);
        assert.strictEqual(dec.ok, true);
        if (dec.ok) {
          assert.ok(Buffer.isBuffer(dec.data));
          assert.strictEqual(Buffer.compare(Buffer.from(dec.data), rawBuf), 0);
        }
      }
    });
  });
});
