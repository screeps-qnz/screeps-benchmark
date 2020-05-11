"use strict";

import clear from "rollup-plugin-clear";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import json from "rollup-plugin-json";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("./package.json");

const ignoreWarnings = ["commonjs-proxy",
  "Circular dependency",
  "The 'this' keyword is equivalent to 'undefined'",
  "Use of eval is strongly discouraged"
];

const date = new Date();
const dateSplit = date.toISOString().split("T");

export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "cjs",
    sourcemap: false,
    banner: `// screeps-benchmark \n` +
      `// version: ${pkg.version}\n` +
      `// build:   ${dateSplit[0]} ${dateSplit[1].substring(0, dateSplit[1].length-1)} UTC\n\n`
  },

  onwarn: (warning) => {
    for (const ignoreWarning of ignoreWarnings) {
      if (warning.toString().includes(ignoreWarning)) {
        return;
      }
    }
    console.warn(warning.message);
  },

  plugins: [
    /*
    clear({
      targets: ["dist"]
    }),
    */
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json"
    }),
    json()
  ]
}
