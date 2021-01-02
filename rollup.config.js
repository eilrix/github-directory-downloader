import commonjs from "@rollup/plugin-commonjs";
import autoExternal from "rollup-plugin-auto-external";
import typescript from "@rollup/plugin-typescript"
import { dirname, resolve } from 'path';
import pkg from './package.json';

const input = resolve(__dirname, 'src/index.ts');
const getOutput = (format = 'esm') => {
    if (format === 'esm') {
        return { dir: resolve(__dirname, pkg.module), format, sourcemap: true, exports: 'default' };
    }
    return { file: resolve(__dirname, pkg.main), format, exports: 'default' };
};

const getPlugins = (format = 'esm') => {
    const typeScriptOptions = format === 'esm' ?
        {
            declaration: true,
            declarationMap: true,
            rootDir: resolve(__dirname, 'src'),
            declarationDir: resolve(__dirname, pkg.module),
            module: "esnext"
        } : { module: "esnext" };
    return [
        autoExternal(),
        commonjs(),
        typescript(typeScriptOptions)
    ];
};

export default [
    {
        input,
        output: getOutput('cjs'),
        plugins: getPlugins('cjs'),
    },
    {
        input,
        output: getOutput('esm'),
        plugins: getPlugins('esm'),
    },
    {
        input: resolve(__dirname, 'src/cli.ts'),
        output: {
            file: resolve(__dirname, dirname(pkg.main), 'cli.js'),
            format: 'cjs',
            exports: 'default'
        },
        plugins: getPlugins('cjs'),
    },
];