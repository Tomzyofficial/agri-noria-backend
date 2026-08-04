import fs from 'fs';
import path from 'path';

let failed = 0;
let total = 0;

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js')) {
            total++;
            try {
                // Read and check for basic syntax by parsing or importing
                const fileUrl = 'file:///' + fullPath.replace(/\\/g, '/');
                import(fileUrl).catch(err => {
                    // Ignore runtime connection errors on import execution, but report syntax errors
                    if (err instanceof SyntaxError) {
                        console.error('SYNTAX ERROR IN FILE:', fullPath);
                        console.error(err);
                        failed++;
                    }
                });
            } catch(e) {
                if (e instanceof SyntaxError) {
                    console.error('SYNTAX ERROR IN FILE:', fullPath);
                    console.error(e);
                    failed++;
                }
            }
        }
    });
}

walk('./src');
setTimeout(() => {
    console.log(`\nVerified ${total} JavaScript files in backend src/. Total syntax errors: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}, 2000);
