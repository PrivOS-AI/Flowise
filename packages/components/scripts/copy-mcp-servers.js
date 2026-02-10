#!/usr/bin/env node

/**
 * Copy MCP server ES module files from source to dist
 * and create package.json to mark directory as ES module
 */

const fs = require('fs')
const path = require('path')

const sourceDir = path.join(__dirname, '../nodes/tools/MCP/ImageGen/dist')
const targetDir = path.join(__dirname, '../dist/nodes/tools/MCP/ImageGen')

// eslint-disable-next-line no-console
console.log('[MCP Build] Copying MCP server files...')

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
}

// Copy .js files and rename to .mjs (ES modules)
const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.js'))

files.forEach((file) => {
    const sourcePath = path.join(sourceDir, file)
    const targetFile = file.replace('.js', '.mjs') // Rename to .mjs
    const targetPath = path.join(targetDir, targetFile)
    fs.copyFileSync(sourcePath, targetPath)
    // eslint-disable-next-line no-console
    console.log(`[MCP Build] Copied ${file} → ${targetFile}`)
})

// eslint-disable-next-line no-console
console.log(`[MCP Build] Done! Copied ${files.length} file(s) as .mjs`)

// Copy workflows folder
const workflowsSourceDir = path.join(__dirname, '../nodes/tools/MCP/ImageGen/workflows')
const workflowsTargetDir = path.join(targetDir, 'workflows')

if (fs.existsSync(workflowsSourceDir)) {
    // Create workflows directory
    if (!fs.existsSync(workflowsTargetDir)) {
        fs.mkdirSync(workflowsTargetDir, { recursive: true })
    }

    // Copy all JSON files from workflows
    const workflowFiles = fs.readdirSync(workflowsSourceDir).filter((f) => f.endsWith('.json'))

    workflowFiles.forEach((file) => {
        const sourcePath = path.join(workflowsSourceDir, file)
        const targetPath = path.join(workflowsTargetDir, file)
        fs.copyFileSync(sourcePath, targetPath)
        // eslint-disable-next-line no-console
        console.log(`[MCP Build] Copied workflow: ${file}`)
    })

    // eslint-disable-next-line no-console
    console.log(`[MCP Build] Copied ${workflowFiles.length} workflow template(s)`)
}
