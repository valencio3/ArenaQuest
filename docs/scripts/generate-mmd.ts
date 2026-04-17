import { Project, InterfaceDeclaration, EnumDeclaration, ModuleDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

export function generateMMD(sourceFilesGlob: string, outputPath: string, title: string) {
    const project = new Project();
    project.addSourceFilesAtPaths(sourceFilesGlob);

    let mermaidSchema = '---\n';
    mermaidSchema += `title: ${title}\n`;
    mermaidSchema += 'config:\n';
    mermaidSchema += '    layout: elk\n';
    mermaidSchema += '---\n';
    mermaidSchema += 'erDiagram\n';

    const interfaces: InterfaceDeclaration[] = [];
    const enums: EnumDeclaration[] = [];

    // Recursively traverse modules (namespaces)
    function traverseModule(moduleDecl: ModuleDeclaration) {
        interfaces.push(...moduleDecl.getInterfaces());
        enums.push(...moduleDecl.getEnums());
        moduleDecl.getModules().forEach(traverseModule);
    }

    project.getSourceFiles().forEach(sourceFile => {
        interfaces.push(...sourceFile.getInterfaces());
        enums.push(...sourceFile.getEnums());
        sourceFile.getModules().forEach(traverseModule);
    });

    const relationships: string[] = [];

    interfaces.forEach(interf => {
        const interfaceName = interf.getName();
        mermaidSchema += `    ${interfaceName} {\n`;

        interf.getProperties().forEach(prop => {
            let typeText = prop.getTypeNode()?.getText() || prop.getType().getText();
            const propName = prop.getName();

            let isArray = false;
            if (typeText.endsWith('[]')) {
                isArray = true;
                typeText = typeText.substring(0, typeText.length - 2);
            } else if (typeText.startsWith('Array<') && typeText.endsWith('>')) {
                isArray = true;
                typeText = typeText.substring(6, typeText.length - 1);
            }

            // Clean namespace prefixes
            const cleanType = typeText.split('.').pop() || 'string';
            // In mermaid, types shouldn't contain spaces.
            const safeType = cleanType.replace(/[^a-zA-Z0-9_]/g, '');

            mermaidSchema += `        ${propName} ${safeType || 'string'}\n`;

            // Detect relationships
            const isKnownInterface = interfaces.some(i => i.getName() === cleanType);
            const isKnownEnum = enums.some(e => e.getName() === cleanType);

            if (isKnownInterface || isKnownEnum) {
                if (isArray) {
                    relationships.push(`    ${interfaceName} ||--o{ ${cleanType} : "has_many_${propName}"`);
                } else {
                    relationships.push(`    ${interfaceName} ||--|| ${cleanType} : "has_one_${propName}"`);
                }
            }
        });

        mermaidSchema += `    }\n\n`;
    });

    enums.forEach(en => {
        const enumName = en.getName();
        mermaidSchema += `    ${enumName} {\n`;
        en.getMembers().forEach(member => {
            mermaidSchema += `        ${member.getName()} string\n`;
        });
        mermaidSchema += `    }\n\n`;
    });

    // Append relationships
    relationships.forEach(rel => {
        mermaidSchema += `${rel}\n`;
    });

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, mermaidSchema);
    console.log(`✅ Arquivo ${outputPath} gerado com sucesso!`);
}

// Execução via linha de comando
if (typeof require !== 'undefined' && require.main === module) {
    const args = process.argv.slice(2);
    const sourceFilesGlob = args[0] || "packages/shared/types/**/*.ts";
    const outputPath = args[1] || "./docs/templates/entity-schema.mmd";
    const title = args[2] || "Entity Schema";

    console.log(`Gerando diagrama a partir de: ${sourceFilesGlob}`);
    console.log(`Salvando diagrama em: ${outputPath}`);

    generateMMD(sourceFilesGlob, outputPath, title);
}