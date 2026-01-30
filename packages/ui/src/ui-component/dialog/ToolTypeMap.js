export const toolDefaults = {
    "1": {
        "name": "calculator",
        "label": "Calculator",
        "category": "Tools",
        "inputs": {}
    },
    "2": {
        "name": "serpAPI",
        "label": "Serp API",
        "category": "Tools",
        "inputs": {}
    },
    "3": {
        "name": "googleCustomSearch",
        "label": "Google Custom Search",
        "category": "Tools",
        "inputs": {}
    },
    "4": {
        "name": "webBrowser",
        "label": "Web Browser",
        "category": "Tools",
        "inputs": {
            "model": "",
            "embeddings": ""
        }
    },
    "5": {
        "name": "readFile",
        "label": "Read File",
        "category": "Tools",
        "inputs": {
            "workspacePath": "",
            "enforceWorkspaceBoundaries": true,
            "maxFileSize": 10,
            "allowedExtensions": ""
        }
    },
    "6": {
        "name": "writeFile",
        "label": "Write File",
        "category": "Tools",
        "inputs": {
            "workspacePath": "",
            "enforceWorkspaceBoundaries": true,
            "maxFileSize": 10,
            "allowedExtensions": ""
        }
    },
    "7": {
        "name": "requestsGet",
        "label": "Requests Get",
        "category": "Tools",
        "inputs": {
            "requestsGetUrl": "",
            "requestsGetName": "requests_get",
            "requestsGetDescription": "Execute HTTP GET requests",
            "requestsGetHeaders": "",
            "requestsGetQueryParamsSchema": "",
            "requestsGetMaxOutputLength": 2000
        }
    },
    "8": {
        "name": "gmail",
        "label": "Gmail",
        "category": "Tools",
        "inputs": {
            "gmailType": "drafts",
            "draftActions": [],
            "messageActions": [],
            "labelActions": [],
            "threadActions": [],
            "draftMaxResults": 100,
            "draftTo": "",
            "draftSubject": "",
            "draftBody": ""
        }
    },
    "9": {
        "name": "slackMCP",
        "label": "Slack MCP",
        "category": "Tools (MCP)",
        "inputs": {
            "mcpActions": []
        }
    },
    "10": {
        "name": "customTool",
        "label": "Custom Tool",
        "category": "Tools",
        "inputs": {
            "selectedTool": "",
            "returnDirect": false,
            "customToolName": "",
            "customToolDesc": "",
            "customToolSchema": "",
            "customToolFunc": ""
        }
    }
}
