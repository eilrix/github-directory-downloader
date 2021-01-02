import { expect } from 'chai';
import fs from 'fs-extra';
import { resolve } from 'path';

import download from '../src';

const tempDir = resolve(__dirname, '../coverage');

describe('commonjs', function () {
    it('require', async function () {

        const download = require('../dist/index');
        const stats = await download()
        expect(Boolean(stats)).to.be.true;
    });
});

describe('download', async function () {
    it('success', async function () {
        const stats = await download('https://github.com/mrdoob/three.js/tree/dev/docs/manual', tempDir);

        expect(Boolean(stats)).to.be.true;

        expect(stats.success).to.be.true;

        expect(stats.downloaded).to.be.eql(Object.keys(stats.files ?? {}).length);

        await fs.remove(tempDir);
    });
});

