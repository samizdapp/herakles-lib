import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import builtins from "rollup-plugin-node-polyfills";
import globals from "rollup-plugin-node-globals";
import replace from "@rollup/plugin-replace";

export default [

  {
    input: "src/pocket_proxy.js",
    output: {
      dir: "dist",
      format: "cjs",
    },
    plugins: [],
  },
  {
    input: "src/pocket_client.js",
    output: {
      dir: "dist",
      format: "es",
    },
    plugins: [
      commonjs(),
      resolve({ preferBuiltins: false }),
      globals(),
      builtins({}),
      replace({
        delimiters: ["", ""],
        "crypto_1.default.randomBytes(4)":
          "self.crypto.getRandomValues(new Uint8Array(4))",
        "crypto_1.default.randomBytes(8)":
          "self.crypto.getRandomValues(new Uint8Array(8))",
        "var xhr;": "var xhr = {}",
        "function checkTypeSupport(type) {":
          "function checkTypeSupport(type) { return false;",
      }),
    ],
  }
];
