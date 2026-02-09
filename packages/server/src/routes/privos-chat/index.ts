import express from 'express'
import privosChatController from '../../controllers/privos-chat'
const router = express.Router()

// GET
router.get('/:userId/room', privosChatController.getRoomsByUserId)

export default router
