/**
 * ClaudeWS Question Answer Controller
 *
 * HTTP endpoints that accumulate answers and emit to ClaudeWS server
 * Questions are stored, answers accumulated, and when complete - emit event to resume
 */

import { Request, Response } from 'express'
import { io } from 'socket.io-client'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ClaudeWSServer } from '../../database/entities/ClaudeWSServer'
import { decryptCredentialData } from '../../utils'
import { answerAccumulator } from './answer-accumulator'

interface SubmitAnswerRequestBody {
    attemptId: string
    toolUseId: string
    questionHeader: string
    answer: string | string[]
}

interface StoreQuestionRequestBody {
    attemptId: string
    toolUseId: string
    serverId: string
    questions: any[]
}

/**
 * Store questions for later answering
 * POST /api/v1/claudews/questions
 *
 * Initializes answer accumulator with questions from ClaudeWS server
 */
const storeQuestion = async (req: Request, res: Response) => {
    try {
        const { attemptId, toolUseId, serverId, questions }: StoreQuestionRequestBody = req.body

        console.log('[ClaudeWS API] Questions received:', { attemptId, toolUseId, serverId, questionCount: questions?.length })

        // Initialize answer accumulator
        answerAccumulator.initQuestions(attemptId, toolUseId, serverId, questions)

        res.json({
            success: true,
            message: 'Questions stored, ready to receive answers',
            totalQuestions: questions.length
        })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return res.status(500).json({
            success: false,
            message: `Error: ${errorMessage}`
        })
    }
}

/**
 * Submit answer and emit to ClaudeWS server when all questions answered
 * POST /api/v1/claudews/answer
 *
 * Accumulates answers for each question. When ALL questions are answered,
 * connects to ClaudeWS server via WebSocket and emits the complete answer set.
 */
const submitAnswer = async (req: Request, res: Response) => {
    try {
        const { attemptId, toolUseId, questionHeader, answer }: SubmitAnswerRequestBody = req.body

        // Validate
        if (!attemptId || !toolUseId || !questionHeader) {
            return res.status(400).json({
                success: false,
                message: 'attemptId, toolUseId, and questionHeader are required'
            })
        }

        console.log('[ClaudeWS API] Received answer:', { attemptId, toolUseId, questionHeader, answer })

        // Add answer to accumulator
        const result = answerAccumulator.addAnswer(attemptId, toolUseId, questionHeader, answer)

        if ('error' in result && result.error) {
            return res.status(404).json({
                success: false,
                message: result.error
            })
        }

        // Check if all questions answered
        if (!result.completed) {
            // Not complete yet, return 202 Accepted
            const status = answerAccumulator.getStatus(attemptId, toolUseId)
            return res.status(202).json({
                success: true,
                message: 'Answer recorded, waiting for remaining questions',
                answered: status?.answered || 0,
                total: status?.total || 0
            })
        }

        // All questions answered - emit to ClaudeWS server
        console.log('[ClaudeWS API] All questions answered, emitting to ClaudeWS server')

        const data = result.data!

        // Get the ClaudeWS server from database using serverId
        const appServer = getRunningExpressApp()
        const server = await appServer.AppDataSource.getRepository(ClaudeWSServer)
            .createQueryBuilder('srv')
            .where('srv.id = :serverId', { serverId: data.serverId })
            .getOne()

        if (!server) {
            return res.status(404).json({
                success: false,
                message: `ClaudeWS server not found for serverId: ${data.serverId}`
            })
        }

        // Decrypt API key
        const { apiKey: encryptedApiKey } = server
        const { apiKey } = await decryptCredentialData(encryptedApiKey)

        // Get base URL (remove trailing slash)
        const baseUrl = server.endpointUrl.replace(/\/$/, '')

        // Create temporary socket connection
        const socket = io(baseUrl, {
            reconnection: false,
            timeout: 10000,
            auth: { 'x-api-key': apiKey },
            extraHeaders: { 'x-api-key': apiKey }
        })

        // Wait for connection and emit event
        await new Promise<void>((resolve, reject) => {
            socket.on('connect', () => {
                console.log('[ClaudeWS API] Connected to ClaudeWS server, socket ID:', socket.id)

                // Join the attempt room
                socket.emit('attempt:subscribe', { attemptId })
                console.log('[ClaudeWS API] Subscribed to room:', `attempt:${attemptId}`)

                // Wait for server to process room join before emitting event
                setTimeout(() => {
                    // Emit complete question:answer event with ALL answers
                    socket.emit('question:answer', data)

                    console.log('[ClaudeWS API] Emitted complete question:answer event:', {
                        attemptId,
                        answerCount: Object.keys(data.answers).length
                    })

                    // Wait for event to be processed then disconnect
                    setTimeout(() => {
                        socket.disconnect()
                        resolve()
                    }, 500)
                }, 100) // Small delay to ensure room join is processed
            })

            socket.on('connect_error', (err: Error) => {
                console.error('[ClaudeWS API] Socket connection error:', err.message)
                reject(err)
            })

            // Timeout after 10 seconds
            setTimeout(() => {
                reject(new Error('Socket connection timeout'))
            }, 10000)
        })

        return res.json({
            success: true,
            message: 'All answers submitted successfully',
            attemptId
        })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ClaudeWS API] Error submitting answer:', errorMessage)

        return res.status(500).json({
            success: false,
            message: `Error submitting answer: ${errorMessage}`
        })
    }
}

/**
 * Get pending questions (for debugging)
 * GET /api/v1/claudews/questions/pending
 */
const getPendingQuestions = async (_req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            message: 'Questions are accumulated in memory. When all answered, event is emitted to ClaudeWS server.',
            architecture: 'POST /questions → accumulate → POST /answer (xN) → emit when complete'
        })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return res.status(500).json({
            success: false,
            message: `Error: ${errorMessage}`
        })
    }
}

export default {
    storeQuestion,
    submitAnswer,
    getPendingQuestions
}
