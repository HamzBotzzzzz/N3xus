const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const pkgPath = join(process.cwd(), 'node_modules/@whiskeysockets/baileys/package.json');

if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.type = 'commonjs'; // ← set ke commonjs, bukan module
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('✅ Patched Baileys: type=commonjs');
}
