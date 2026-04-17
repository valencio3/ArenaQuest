/**
 * Read all files from docs/templates/*.mmd
 * Convert them to svg using mermaid-cli
 * Save them to docs/imges/<filename>.svg
 */

import { exec } from "child_process";
import { promisify } from "util";
import { join, basename } from "path";
import { mkdirSync, existsSync, readdirSync } from "fs";

const execAsync = promisify(exec);

async function main() {
    const outputDir = "docs/imges";
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    const templatesDir = "docs/templates";
    // Using native node.js FS module to find .mmd files instead of external glob package
    const files = readdirSync(templatesDir)
        .filter(file => file.endsWith(".mmd"))
        .map(file => join(templatesDir, file).replace(/\\/g, '/'));
    
    for (const file of files) {
        const fileName = basename(file, ".mmd");
        const svgFile = join(outputDir, `${fileName}.svg`).replace(/\\/g, '/');
        console.log(`Converting ${file} to ${svgFile}`);
        // Using npx mmdc to ensure the binary is resolved properly whether run via package scripts or directly
        await execAsync(`pnpm exec mmdc -i ${file} -o ${svgFile}`);
    }
}

main().catch(console.error);