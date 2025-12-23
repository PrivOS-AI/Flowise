import express from 'express'
import chatflowsController from '../../controllers/chatflows'
import { checkAnyPermission, checkPermission } from '../../enterprise/rbac/PermissionCheck'
const router = express.Router()

// CREATE
router.post('/', checkAnyPermission('chatflows:create,chatflows:update'), chatflowsController.saveChatflow)

// READ
router.get('/', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getAllChatflows)
router.get(['/', '/:id'], checkAnyPermission('chatflows:view,chatflows:update,chatflows:delete'), chatflowsController.getChatflowById)
router.get(['/apikey/', '/apikey/:apikey'], chatflowsController.getChatflowByApiKey)

// UPDATE
router.put(['/', '/:id'], checkAnyPermission('chatflows:create,chatflows:update'), chatflowsController.updateChatflow)

// DELETE
router.delete(['/', '/:id'], checkPermission('chatflows:delete'), chatflowsController.deleteChatflow)

// CHECK FOR CHANGE
router.get('/has-changed/:id/:lastUpdatedDateTime', chatflowsController.checkIfChatflowHasChanged)

// SCHEDULE MANAGEMENT
router.get('/schedule/:id', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getChatflowSchedule)
router.post('/schedule/:id', checkAnyPermission('chatflows:update'), chatflowsController.updateChatflowSchedule)
router.post('/schedule/:id/enable', checkAnyPermission('chatflows:update'), chatflowsController.enableChatflowSchedule)
router.post('/schedule/:id/disable', checkAnyPermission('chatflows:update'), chatflowsController.disableChatflowSchedule)
router.get('/schedules/all', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getAllScheduledChatflows)

// SCHEDULE MONITORING
router.get('/schedule/:id/metrics', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getScheduleMetrics)
router.get('/schedules/metrics', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getGlobalScheduleMetrics)
router.get('/schedules/health', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getScheduleHealth)
router.get('/schedules/queue-stats', checkAnyPermission('chatflows:view,chatflows:update'), chatflowsController.getScheduleQueueStats)

// BOT MANAGEMENT
router.get('/bots/all', chatflowsController.getAllBots)
router.post('/bot/:id', chatflowsController.updateBotEnabled)

// SUBAGENT MANAGEMENT
router.get('/subagents/all', chatflowsController.getAllSubAgents)
router.post('/subagent/:id', chatflowsController.updateSubAgentEnabled)

export default router
