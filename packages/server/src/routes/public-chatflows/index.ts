import express from 'express'
import chatflowsController from '../../controllers/chatflows'
const router = express.Router()

// CREATE

// READ
router.get(['/', '/:id'], chatflowsController.getSinglePublicChatflow)
router.get('/bots/all', chatflowsController.getAllBots)
router.get('/subagents/all', chatflowsController.getAllSubAgents)

// UPDATE

// DELETE

export default router
