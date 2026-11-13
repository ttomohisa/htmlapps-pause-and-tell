'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'experiments/insertion-poc/index.template.html'),'utf8');
test('the active insertion entry uses the canonical exact English badge',()=>{
 assert.match(source,/<span data-ja="完全ローカル処理" data-en="Fully local processing">完全ローカル処理<\/span>/);
 assert.doesNotMatch(source,/Entirely local processing/);
 assert.match(fs.readFileSync(path.join(root,'build-standalone.ps1'),'utf8'),/\$TemplatePath = Join-Path \$insertionRoot "dist\\index.html"/);
});
test('existing compact-workflow footer hiding and release version are retained',()=>{
 assert.match(source,/@media \(max-width: 767px\), \(pointer: coarse\) and \(max-height: 600px\) \{[\s\S]*?footer \{ display: none; \}/);
 assert.match(source,/id="versionBadge">v1\.0\.1<\/span>/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).version,'1.0.1');
});

test('the phone file picker enters the same source loading path',()=>{
 assert.match(source,/id="sourceFallbackButton" class="pt-file-fallback"/);
 assert.match(source,/id="sourceFallbackFile" hidden>/);
 assert.match(source,/\.pt-file-fallback \{ display: inline-flex; \}/);
 const runtime=fs.readFileSync(path.join(root,'experiments/insertion-poc/insertion-poc.js'),'utf8');
 assert.match(runtime,/for\(const input of \[\$\('sourceFile'\),\$\('sourceFallbackFile'\)\]\)/);
 assert.match(runtime,/if\(file\)void loadSource\(file\)/);
});
