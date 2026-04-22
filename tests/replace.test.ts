import { test, describe } from 'node:test';
import assert from 'node:assert';
import { exists, replaceDirContent } from '../server/replace.js';
import fs from 'node:fs/promises'
import path from 'node:path';

describe('exists', () => {

    test('return true if a file exists', async () => {
        const paths = path.resolve('/tmp/file.txt')
        await fs.writeFile('/tmp/file.txt', 'data');
        assert.strictEqual(await exists(paths), true)
        await fs.rm(paths)
    })

    test('return false on error and if a file doesnt exists', async () => {
        assert.strictEqual(await exists('non-existent'), false)
        assert.strictEqual(await exists(path.resolve('/tmp/non-existent.txt')), false)
    })
})

describe('replace', () => {
    test('successfully replace a content of a dir', async () => {
        const outputDir = path.resolve('output')
        const tmpdir = path.resolve('tmp')
        await fs.mkdir(outputDir)
        await fs.mkdir(tmpdir)


        await fs.writeFile(path.resolve(outputDir, 'file.txt'), 'data');
        await fs.writeFile(path.resolve(outputDir, 'file2.txt'), 'data');

        await fs.writeFile(path.resolve(tmpdir, 'file.txt'), 'new-data-two');
        await fs.writeFile(path.resolve(tmpdir, 'file2.txt'), 'new-data-two');

        await replaceDirContent(outputDir, tmpdir)

        const firstFileContent = await fs.readFile(path.resolve(outputDir, 'file.txt'), 'utf8')
        const secFileContent = await fs.readFile(path.resolve(outputDir, 'file2.txt'), 'utf8')

        assert.strictEqual(firstFileContent, 'new-data-two')
        assert.strictEqual(secFileContent, 'new-data-two')
        await fs.rm(outputDir, {recursive: true, force: true})
        await fs.rm(tmpdir, {recursive: true, force: true})

    })

    test('restores original files on per-file failure', async () => {
        const outputDir = path.resolve('output-restore')
        const tmpdir = path.resolve('tmp-restore')

        await fs.mkdir(outputDir)
        await fs.mkdir(tmpdir)

        await fs.writeFile(path.resolve(outputDir, 'file1.txt'), 'data1');
        await fs.writeFile(path.resolve(outputDir, 'file2.txt'), 'data2');
        await fs.writeFile(path.resolve(outputDir, 'file3.txt'), 'data3');



        await fs.writeFile(path.resolve(tmpdir, 'file1.txt'), 'new-data123');
        await fs.writeFile(path.resolve(tmpdir, 'file2.txt'), 'new-data1234');
        await fs.mkdir(path.resolve(tmpdir, 'file3.txt'))


        await assert.rejects(
            replaceDirContent(outputDir, tmpdir),
            { name: 'Error' }, 
            'Expected replace() to fail because a directory cannot be copied as a file'
        );

        const f1 = await fs.readFile(path.resolve(outputDir, 'file1.txt'), 'utf8')
        const f2 = await fs.readFile(path.resolve(outputDir, 'file2.txt'), 'utf8')
        const f3 = await fs.readFile(path.resolve(outputDir, 'file3.txt'), 'utf8')


        assert.strictEqual(f1, 'new-data123', 'file1.txt should be replaced correctly');
        assert.strictEqual(f2, 'new-data1234', 'file2.txt should be replaced correctly');
        assert.strictEqual(f3, 'data3', 'file3.txt was not restored correctly');
        
        await fs.rm(outputDir, { recursive: true, force: true })
        await fs.rm(tmpdir, { recursive: true, force: true })
    })
})