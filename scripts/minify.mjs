#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyJs } from "terser";
import { minify as minifyCss } from "csso";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssIn = join(root, "css/article.css");
const jsIn = join(root, "js/article.js");
const cssOut = join(root, "css/article.min.css");
const jsOut = join(root, "js/article.min.js");

const css = readFileSync(cssIn, "utf8");
const js = readFileSync(jsIn, "utf8");

const cssResult = minifyCss(css).css;
writeFileSync(cssOut, cssResult);

const jsResult = await minifyJs(js, {
  compress: true,
  mangle: true,
  format: { comments: false },
});
if (!jsResult.code) throw new Error("terser produced empty output");
writeFileSync(jsOut, jsResult.code);

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log(`css/article.css  ${kb(Buffer.byteLength(css))} → css/article.min.css  ${kb(Buffer.byteLength(cssResult))}`);
console.log(`js/article.js    ${kb(Buffer.byteLength(js))} → js/article.min.js    ${kb(Buffer.byteLength(jsResult.code))}`);
