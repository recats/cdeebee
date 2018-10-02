
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import json from 'rollup-plugin-json';
import typescript from 'rollup-plugin-typescript2';

export default {
  output: {
    name: 'cdeebee',
    format: 'cjs',
  },
  plugins: [
    typescript(),
    babel({
      runtimeHelpers: true,
    }),
    commonjs({
      ignoreGlobal: true,
    }),
    json(),
    terser(),
  ],
};
