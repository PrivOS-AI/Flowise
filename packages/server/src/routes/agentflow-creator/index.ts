import express from 'express'
import * as agentflowCreatorController from '../../controllers/agentflow-creator'

const router = express.Router()

/**
 * AGENT FLOW CREATOR ROUTES
 *
 * Create Agent Flows programmatically via API
 * Base path: /api/v1/agentflow-creator
 */

/**
 * POST /api/v1/agentflow-creator
 *
 * Create a new Agent Flow programmatically
 *
 * Body:
 * {
 *   "name": "My Agent Flow",
 *   "flowData": {
 *     "nodes": [...],
 *     "edges": [...]
 *   },
 *   "apiKey": "optional_api_key" // Optional - set via AGENTFLOW_CREATOR_KEY env var
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "flowId": "abc123",
 *   "flowName": "My Agent Flow",
 *   "message": "Agent Flow created successfully",
 *   "accessUrl": "/agentflow/abc123"
 * }
 */
router.post('/', agentflowCreatorController.createAgentFlow)

/**
 * GET /api/v1/agentflow-creator
 *
 * Get all Agent Flows
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 5,
 *   "flows": [...]
 * }
 */
router.get('/', agentflowCreatorController.getAllAgentFlows)

/**
 * GET /api/v1/agentflow-creator/:id
 *
 * Get Agent Flow by ID
 *
 * Response:
 * {
 *   "success": true,
 *   "flow": {
 *     "id": "abc123",
 *     "name": "My Agent Flow",
 *     "flowData": {...}
 *   }
 * }
 */
router.get('/:id', agentflowCreatorController.getAgentFlowById)

export default router
