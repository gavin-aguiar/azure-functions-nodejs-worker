// Copyright (c) .NET Foundation. All rights reserved.
// Licensed under the MIT License.

import 'mocha';
import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import { packageByoc } from '../scripts/packageByoc';

describe('BYOC packaging', () => {
    let root: string;
    let source: string;
    let output: string;
    const version = '3.16.1-byoc.2';
    const basename = `azure-functions-nodejs-worker-${version}.tar.gz`;
    const entrypoint = 'dist/src/nodejsWorker.js';
    const names = [
        'LICENSE',
        'NOTICE.html',
        'package.json',
        'worker.config.json',
        entrypoint,
        'dist/src/worker-bundle.js',
    ];

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(process.cwd(), '.byoc-test-'));
        source = path.join(root, 'source');
        output = path.join(root, 'output');
        fs.mkdirSync(path.join(source, 'dist', 'src'), { recursive: true });
        for (const name of names) {
            fs.writeFileSync(path.join(source, name), `fixture ${name}\n`);
        }
        fs.writeFileSync(
            path.join(source, 'package.json'),
            JSON.stringify({ name: 'azure-functions-nodejs-worker', version, main: entrypoint })
        );
        fs.writeFileSync(
            path.join(source, 'worker.config.json'),
            JSON.stringify({
                description: { language: 'node', defaultExecutablePath: 'node', defaultWorkerPath: entrypoint },
            })
        );
    });

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('packages only the release payload and extracts with a real tar implementation', () => {
        fs.writeFileSync(path.join(source, '.env'), 'not for distribution');
        fs.mkdirSync(path.join(source, 'node_modules'));
        fs.writeFileSync(path.join(source, 'node_modules', 'native.node'), 'not for distribution');
        const result = packageByoc(source, output);
        expect(path.basename(result.archivePath)).to.equal(basename);
        const archive = fs.readFileSync(result.archivePath);
        expect(fs.readFileSync(result.checksumPath, 'utf8')).to.equal(
            `${createHash('sha256').update(archive).digest('hex')}  ${basename}\n`
        );
        const listed = execFileSync('tar', ['-tzf', result.archivePath], { encoding: 'utf8' }).trim().split(/\r?\n/);
        expect(listed).to.deep.equal([...names, 'worker-manifest.json']);
        const extracted = path.join(root, 'extracted');
        fs.mkdirSync(extracted);
        execFileSync('tar', ['-xzf', result.archivePath, '-C', extracted]);
        for (const name of names) {
            expect(fs.readFileSync(path.join(extracted, name))).to.deep.equal(fs.readFileSync(path.join(source, name)));
        }
        expect(JSON.parse(fs.readFileSync(path.join(extracted, 'worker-manifest.json'), 'utf8'))).to.deep.equal({
            name: 'azure-functions-nodejs-worker',
            version,
            platform: 'any',
            entrypoint,
        });
    });

    it('is reproducible despite input timestamps and permissions, with normalized tar headers', () => {
        const first = packageByoc(source, output);
        const original = fs.readFileSync(first.archivePath);
        for (const name of names) {
            fs.utimesSync(path.join(source, name), new Date(), new Date());
            fs.chmodSync(path.join(source, name), 0o600);
        }
        const second = packageByoc(source, path.join(root, 'other'));
        expect(fs.readFileSync(second.archivePath)).to.deep.equal(original);
        const tar = gunzipSync(original);
        for (let offset = 0; tar[offset]; ) {
            const header = tar.subarray(offset, offset + 512);
            const octal = (start: number, end: number) =>
                parseInt(header.subarray(start, end).toString('ascii').replace(/\0/g, '').trim(), 8);
            expect(octal(100, 108)).to.equal(0o644);
            expect(octal(108, 116)).to.equal(0);
            expect(octal(116, 124)).to.equal(0);
            expect(octal(136, 148)).to.equal(0);
            offset += 512 + Math.ceil(octal(124, 136) / 512) * 512;
        }
    });

    it('rejects missing or empty payloads without writing an archive', () => {
        const bundle = path.join(source, 'dist', 'src', 'worker-bundle.js');
        fs.writeFileSync(bundle, '');
        expect(() => packageByoc(source, output)).to.throw('nonempty regular file');
        fs.unlinkSync(bundle);
        expect(() => packageByoc(source, output)).to.throw();
        expect(fs.existsSync(output)).to.equal(false);
    });

    it('rejects mismatched metadata and unsafe version filenames', () => {
        const pkg = path.join(source, 'package.json');
        const metadata = JSON.parse(fs.readFileSync(pkg, 'utf8'));
        fs.writeFileSync(pkg, JSON.stringify({ ...metadata, version: '../escape' }));
        expect(() => packageByoc(source, output)).to.throw('safe version');
        fs.writeFileSync(pkg, JSON.stringify({ ...metadata, main: 'other.js' }));
        expect(() => packageByoc(source, output)).to.throw('entrypoint');
        fs.writeFileSync(pkg, JSON.stringify({ ...metadata, name: 'other-worker' }));
        expect(() => packageByoc(source, output)).to.throw('worker name');
        fs.writeFileSync(pkg, JSON.stringify(metadata));
        fs.writeFileSync(path.join(source, 'worker.config.json'), '{"description":{}}');
        expect(() => packageByoc(source, output)).to.throw('entrypoint');
    });

    it('rejects output within the source and symlinked input or output directories', () => {
        expect(() => packageByoc(source, source)).to.throw('outside');
        expect(() => packageByoc(source, path.join(source, 'release'))).to.throw('outside');
        const alias = path.join(root, 'alias');
        fs.symlinkSync(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
        expect(() => packageByoc(alias, output)).to.throw('Symlinks');
        expect(() => packageByoc(source, path.join(alias, 'release'))).to.throw('Symlinks');
        fs.rmSync(path.join(source, 'dist'), { recursive: true });
        fs.symlinkSync(root, path.join(source, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
        expect(() => packageByoc(source, output)).to.throw('Symlinks');
    });

    it('supports CLI help and reports malformed arguments', () => {
        const script = path.resolve('scripts', 'packageByoc.js');
        expect(execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' })).to.contain('--source DIR');
        expect(() => execFileSync(process.execPath, [script, '--unknown'], { stdio: 'pipe' })).to.throw();
        execFileSync(process.execPath, [script, '--source', source, '--output', output]);
        expect(fs.existsSync(path.join(output, basename))).to.equal(true);
    });
});
