const { writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

const pkgPath = join(process.cwd(), 'node_modules/@whiskeysockets/baileys/package.json');

if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.type !== 'module') {
        pkg.type = 'module';
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log('✅ Patched Baileys: type=module');
    }
} else {
    console.error('❌ Baileys package.json not found');
}
