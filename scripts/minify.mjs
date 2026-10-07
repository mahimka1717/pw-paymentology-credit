#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyJs } from "terser";
import { minify as minifyCss } from "csso";
import { minify as minifyHtml } from "html-minifier-terser";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssIn = join(root, "css/article.css");
const jsIn = join(root, "js/article.js");
const htmlIn = join(root, "index.html");
const dist = join(root, "dist");

const css = readFileSync(cssIn, "utf8");
const js = readFileSync(jsIn, "utf8");
const html = readFileSync(htmlIn, "utf8");

const cssResult = minifyCss(css).css;
const jsResult = await minifyJs(js, {
  compress: true,
  mangle: true,
  format: { comments: false },
});
if (!jsResult.code) throw new Error("terser produced empty output");
const htmlResult = await minifyHtml(html, {
  collapseWhitespace: true,
  removeComments: true,
});

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "css"), { recursive: true });
mkdirSync(join(dist, "js"), { recursive: true });
writeFileSync(join(dist, "index.html"), htmlResult);
writeFileSync(join(dist, "css/article.min.css"), cssResult);
writeFileSync(join(dist, "js/article.min.js"), jsResult.code);
cpSync(join(root, "public"), join(dist, "public"), { recursive: true });

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log(`index.html       ${kb(Buffer.byteLength(html))} → dist/index.html  ${kb(Buffer.byteLength(htmlResult))}`);
console.log(`css/article.css  ${kb(Buffer.byteLength(css))} → dist/css/article.min.css  ${kb(Buffer.byteLength(cssResult))}`);
console.log(`js/article.js    ${kb(Buffer.byteLength(js))} → dist/js/article.min.js  ${kb(Buffer.byteLength(jsResult.code))}`);
console.log("Copied public/ → dist/public/");
