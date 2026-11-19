import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'docs');
const DEST = path.resolve(process.cwd(), 'dist', 'docs');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else if (entry.isFile()) fs.copyFileSync(from, to);
    }
}

copyDir(SRC, DEST);
console.log(`[copy-docs] ${SRC} -> ${DEST}`);