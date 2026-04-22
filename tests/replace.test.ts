import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { exists, replaceDirContent } from '../server/replace.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const getSandbox = async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'replace-test-'));
    return {
        root,
        out: path.join(root, 'output'),
        tmp: path.join(root, 'tmp')
    };
};

describe('exists', () => {
    test('return true if a file exists', async () => {
        const { root } = await getSandbox();
        const filePath = path.join(root, 'test.txt');
        await fs.writeFile(filePath, 'data');
        
        assert.strictEqual(await exists(filePath), true);
        await fs.rm(root, { recursive: true, force: true });
    });

    test('return false if a file does not exist', async () => {
        assert.strictEqual(await exists('/path/to/nothing/12345'), false);
    });
});

describe('replaceDirContent', () => {

    test('maintains deeply nested directory structures', async () => {
        const { root, out, tmp } = await getSandbox();
        
        const deepOut = path.join(out, 'a/b/c');
        const deepTmp = path.join(tmp, 'a/b/c');
        
        await fs.mkdir(deepOut, { recursive: true });
        await fs.mkdir(deepTmp, { recursive: true });

        await fs.writeFile(path.join(deepOut, 'target.txt'), 'old-content');
        await fs.writeFile(path.join(deepTmp, 'target.txt'), 'new-content');

        await replaceDirContent(out, tmp);

        const content = await fs.readFile(path.join(deepOut, 'target.txt'), 'utf8');
        assert.strictEqual(content, 'new-content');
        
        assert.strictEqual(await exists(path.join(deepTmp, 'target.txt')), false);

        await fs.rm(root, { recursive: true, force: true });
    });

    test('creates destination directory if it does not exist', async () => {
        const { root, out, tmp } = await getSandbox();

        await fs.mkdir(tmp);
        await fs.writeFile(path.join(tmp, 'new-file.txt'), 'hello');

        await replaceDirContent(out, tmp);

        assert.strictEqual(await exists(path.join(out, 'new-file.txt')), true);
        const content = await fs.readFile(path.join(out, 'new-file.txt'), 'utf8');
        assert.strictEqual(content, 'hello');

        await fs.rm(root, { recursive: true, force: true });
    });

    test('restores original file on specific file failure but keeps previous successes', async () => {
        const { root, out, tmp } = await getSandbox();
        await fs.mkdir(out);
        await fs.mkdir(tmp);

        // File 1 should succeed
        await fs.writeFile(path.join(out, 'success.txt'), 'old-1');
        await fs.writeFile(path.join(tmp, 'success.txt'), 'new-1');

        // File 2 should fail
        await fs.writeFile(path.join(out, 'fail.txt'), 'old-2');
        const failPathTmp = path.join(tmp, 'fail.txt');
        await fs.mkdir(failPathTmp); 

        try {
            await replaceDirContent(out, tmp);
            assert.fail('should have thrown an error');
        } catch (err) {
            // was updated before failure
            const f1 = await fs.readFile(path.join(out, 'success.txt'), 'utf8');
            assert.strictEqual(f1, 'new-1');

            // was restored after failure
            const f2 = await fs.readFile(path.join(out, 'fail.txt'), 'utf8');
            assert.strictEqual(f2, 'old-2');
        }

        await fs.rm(root, { recursive: true, force: true });
    });

    test('fails when source directory is missing', async () => {
        const { root, out } = await getSandbox();
        const nonExistentTmp = path.join(root, 'ghost-folder');
        
        await replaceDirContent(out, nonExistentTmp);
        assert.strictEqual(await exists(out), true);

        await fs.rm(root, { recursive: true, force: true });
    });
});