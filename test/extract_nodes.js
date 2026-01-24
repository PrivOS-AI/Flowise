const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = 'packages/components/nodes';
const AGENTFLOW_DIR = 'packages/components/nodes/agentflow';
const PRIVOS_DIR = 'packages/components/nodes/PrivOS';
const NODE_TYPE_MAP_PATH = 'packages/ui/src/ui-component/dialog/NodeTypeMap.js';
const OUTPUT_DIR = 'nodes';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// --- Helpers ---

// Find balanced bracket block starting from '[' at startIndex
function extractBlock(content, startIndex) {
    let openBrackets = 0;
    let started = false;
    for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        if (char === '[') {
            if (!started) started = true;
            openBrackets++;
        } else if (char === ']') {
            openBrackets--;
        }
        if (started && openBrackets === 0) {
            return content.substring(startIndex, i + 1);
        }
    }
    return null;
}

// Find balanced brace block starting from '{' at startIndex
function extractBraceBlock(content, startIndex) {
    let openBraces = 0;
    let started = false;
    for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        if (char === '{') {
            if (!started) started = true;
            openBraces++;
        } else if (char === '}') {
            openBraces--;
        }
        if (started && openBraces === 0) {
            return content.substring(startIndex, i + 1);
        }
    }
    return null;
}

// --- Catalog Scan ---

const nodeCatalog = [];

function scanForCatalog(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);

    for (const item of items) {
        let fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanForCatalog(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let nameMatch = content.match(/this\.name\s*=\s*['"]([^'"]+)['"]/);
            if (!nameMatch) nameMatch = content.match(/name\s*=\s*['"]([^'"]+)['"]/);
            const name = nameMatch ? nameMatch[1] : null;

            let catMatch = content.match(/this\.category\s*=\s*['"]([^'"]+)['"]/);
            if (!catMatch) catMatch = content.match(/category\s*:\s*['"]([^'"]+)['"]/);
            const category = catMatch ? catMatch[1] : null;

            const tagsMatch = content.match(/(?:this\.)?tags\s*=\s*(\[[^\]]*\])/);
            let tags = [];
            if (tagsMatch) {
                const tagBlock = tagsMatch[1];
                const tagRegex = /['"]([^'"]+)['"]/g;
                let tm;
                while ((tm = tagRegex.exec(tagBlock)) !== null) {
                    tags.push(tm[1]);
                }
            }

            if (name && category) {
                nodeCatalog.push({ name, category, tags });
            }
        }
    }
}

console.log('Scanning for node catalog...');
scanForCatalog(COMPONENTS_DIR);
console.log(`Cataloged ${nodeCatalog.length} nodes.`);

// --- ID Mapping ---

function parseNodeTypeMap() {
    if (!fs.existsSync(NODE_TYPE_MAP_PATH)) return {};
    const mapFileContent = fs.readFileSync(NODE_TYPE_MAP_PATH, 'utf8');
    const nameToId = {};
    const cleanContent = mapFileContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const keyRegex = /['"](\d+)['"]\s*:\s*({[\s\S]*?})/g;

    let match;
    while ((match = keyRegex.exec(cleanContent)) !== null) {
        const id = match[1];
        const block = match[2];
        const nameMatch = block.match(/['"]name['"]\s*:\s*['"]([^'"]+)['"]/);
        if (nameMatch) {
            nameToId[nameMatch[1]] = id;
        }
    }
    return nameToId;
}

const nameToIdMap = parseNodeTypeMap();

// --- Main Parsing ---

function parseNodeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Find inputs array
    let matchIndex = content.search(/this\.inputs\s*=\s*\[/);
    if (matchIndex === -1) {
        matchIndex = content.search(/inputs\s*(?::\s*INodeParams\[\])?\s*=\s*\[/);
    }
    if (matchIndex === -1) return null;

    const bracketIndex = content.indexOf('[', matchIndex);
    const inputsString = extractBlock(content, bracketIndex);
    if (!inputsString) return null;

    return processInputs(inputsString);
}

function processInputs(inputsString) {
    const params = {};
    // Remove comments to clean up
    const cleanBox = inputsString.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Split into objects
    let openBraces = 0;
    let start = -1;
    const objects = [];

    for (let i = 0; i < cleanBox.length; i++) {
        if (cleanBox[i] === '{') {
            if (openBraces === 0) start = i;
            openBraces++;
        } else if (cleanBox[i] === '}') {
            openBraces--;
            if (openBraces === 0 && start !== -1) {
                objects.push(cleanBox.substring(start, i + 1));
                start = -1;
            }
        }
    }

    for (const objStr of objects) {
        const nameMatch = objStr.match(/name\s*:\s*['"]([^'"]+)['"]/);
        if (!nameMatch) continue;

        const name = nameMatch[1];
        const typeMatch = objStr.match(/type\s*:\s*['"]([^'"]+)['"]/);
        const type = typeMatch ? typeMatch[1] : 'string';

        const acceptVariableMatch = objStr.match(/acceptVariable\s*:\s*(true|false)/);
        const variable = acceptVariableMatch ? acceptVariableMatch[1] === 'true' : false;

        const defaultMatch = objStr.match(/default\s*:\s*(['"][\s\S]*?['"]|true|false|\d+)/);
        let defaultValue = undefined;
        if (defaultMatch) {
            let val = defaultMatch[1];
            if (val.startsWith("'") || val.startsWith('"')) {
                defaultValue = val.substring(1, val.length - 1);
            } else if (val === 'true') defaultValue = true;
            else if (val === 'false') defaultValue = false;
            else if (!isNaN(Number(val))) defaultValue = Number(val);
            else defaultValue = val;
        }

        const loadMethodMatch = objStr.match(/loadMethod\s*:\s*['"]([^'"]+)['"]/);
        let loadMethod = loadMethodMatch ? loadMethodMatch[1] : undefined;

        let options = undefined;
        // Static options
        if (type === 'options' || type === 'multiOptions') {
            const optionsMatch = objStr.match(/options\s*:\s*(\[[\s\S]*?\])/);
            if (optionsMatch) {
                const optionBlock = optionsMatch[1];
                const optionNames = [];
                const optRegex = /name\s*:\s*['"]([^'"]+)['"]/g;
                let match;
                while ((match = optRegex.exec(optionBlock)) !== null) {
                    optionNames.push(match[1]);
                }
                if (optionNames.length > 0) options = optionNames;
            }
        }

        // Dynamic options simulation
        if (type === 'asyncOptions' && loadMethod) {
            let categories = [];
            if (loadMethod === 'listModels') categories = ['Chat Models'];
            else if (loadMethod === 'listTools') categories = ['Tools', 'Tools (MCP)', 'MCP'];
            else if (loadMethod === 'listEmbeddings') categories = ['Embeddings'];
            else if (loadMethod === 'listVectorStores') categories = ['Vector Stores'];

            if (categories.length > 0) {
                const matchedNodes = nodeCatalog.filter(n => {
                    if (n.tags && n.tags.includes('LlamaIndex')) return false;
                    if (loadMethod === 'listTools' && ['chainTool', 'retrieverTool', 'webBrowser'].includes(n.name)) return false;
                    return categories.includes(n.category);
                });
                const dynamicOptions = matchedNodes.map(n => n.name);
                if (dynamicOptions.length > 0) options = dynamicOptions;
            }
        }

        // RECURSIVE ARRAY HANDLING
        let nestedParameters = undefined;
        if (type === 'array') {
            // Find "array: [...]"
            const arrayKeywordRegex = /array\s*:\s*\[/;
            const arrayMatch = objStr.match(arrayKeywordRegex);
            if (arrayMatch) {
                const startIndex = arrayMatch.index + arrayMatch[0].length - 1; // point to '['
                const arrayBlock = extractBlock(objStr, startIndex);
                if (arrayBlock) {
                    nestedParameters = processInputs(arrayBlock);
                }
            }
        }

        params[name] = {
            type: type,
            variable: variable,
            default: defaultValue,
        };

        if (options) params[name].options = options;
        if (loadMethod) params[name].loadMethod = loadMethod;
        if (nestedParameters) params[name].parameters = nestedParameters;
    }

    return params;
}

// --- Directory Traversal ---

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);

    for (const item of items) {
        let fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        let tsFile = null;

        if (stat.isDirectory()) {
            const potentialFile = path.join(fullPath, `${item}.ts`);
            if (fs.existsSync(potentialFile)) tsFile = potentialFile;
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
            tsFile = fullPath;
        }

        if (tsFile) {
            const params = parseNodeFile(tsFile);
            if (params && Object.keys(params).length > 0) {
                const content = fs.readFileSync(tsFile, 'utf8');
                let nodeName = null;
                const nameMatch = content.match(/this\.name\s*=\s*['"]([^'"]+)['"]/);
                if (nameMatch) nodeName = nameMatch[1];
                else {
                    const propMatch = content.match(/name\s*=\s*['"]([^'"]+)['"]/);
                    if (propMatch) nodeName = propMatch[1];
                }
                if (!nodeName) nodeName = path.basename(tsFile, '.ts');

                const id = nameToIdMap[nodeName];
                // Only warn if missing ID for known agent nodes (filtered by outputting everything? No we output everything found)
                if (!id) console.warn(`Warning: No ID found for node ${nodeName}`);

                const output = {
                    id: id,
                    parameters: params
                };

                const outputPath = path.join(OUTPUT_DIR, `${nodeName}.json`);
                fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));
                console.log(`Generated ${outputPath}`);
            }
        }
    }
}

console.log('Starting extraction...');
processDirectory(AGENTFLOW_DIR);

function traversePrivOS(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const subItems = fs.readdirSync(fullPath);
            for (const subItem of subItems) {
                if (subItem.endsWith('.ts') && !subItem.endsWith('.d.ts')) {
                    const tsFile = path.join(fullPath, subItem);
                    const params = parseNodeFile(tsFile);
                    if (params && Object.keys(params).length > 0) {
                        const content = fs.readFileSync(tsFile, 'utf8');
                        let nodeName = null;
                        const nameMatch = content.match(/this\.name\s*=\s*['"]([^'"]+)['"]/);
                        if (nameMatch) nodeName = nameMatch[1];
                        else nodeName = path.basename(subItem, '.ts');

                        const id = nameToIdMap[nodeName];
                        if (!id) console.warn(`Warning: No ID found for node ${nodeName}`);

                        const output = {
                            id: id,
                            parameters: params
                        };

                        const outputPath = path.join(OUTPUT_DIR, `${nodeName}.json`);
                        fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));
                        console.log(`Generated ${outputPath}`);
                    }
                }
            }
        }
    }
}
traversePrivOS(PRIVOS_DIR);
console.log('Done.');
