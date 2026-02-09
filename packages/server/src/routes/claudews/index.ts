/**
 * ClaudeWS API Routes
 *
 * Routes for handling ClaudeWS questions and answers
 */

import express from 'express'
import claudewsController from '../../controllers/claudews'

const router = express.Router()

/**
 * Store questions from ClaudeWS node
 * POST /api/v1/claudews/questions
 *
 * Body:
 * {
 *   "attemptId": string,
 *   "toolUseId": string,
 *   "questions": Question[]
 * }
 */
router.post('/questions', claudewsController.storeQuestion)

/**
 * Submit answer to a pending question
 * POST /api/v1/claudews/answer
 *
 * Body:
 * {
 *   "attemptId": string,
 *   "toolUseId": string,
 *   "questionHeader": string,
 *   "answer": string | string[]
 * }
 */
router.post('/answer', claudewsController.submitAnswer)

/**
 * Get all pending questions (debug endpoint)
 * GET /api/v1/claudews/questions/pending
 */
router.get('/questions/pending', claudewsController.getPendingQuestions)

export default router
