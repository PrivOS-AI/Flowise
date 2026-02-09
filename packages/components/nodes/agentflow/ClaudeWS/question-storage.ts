/**
 * Global Question Storage for ClaudeWS (Components Package)
 *
 * This is a shared storage for pending questions across all ClaudeWS node instances.
 * The API endpoint can access this storage to submit answers.
 *
 * Key format: `${attemptId}-${toolUseId}-${questionHeader}`
 */

import { Socket } from 'socket.io-client'

export interface QuestionOption {
    label: string
    description: string
}

export type QuestionType = 'choice' | 'text'

export interface Question {
    question: string
    header: string
    type: QuestionType
    options: QuestionOption[]
    multiSelect: boolean
}

interface PendingQuestionData {
    attemptId: string
    toolUseId: string
    question: Question
    resolve: (answer: Record<string, string>) => void
    socket: Socket
    createdAt: number
}

type PendingQuestionInput = Omit<PendingQuestionData, 'createdAt'>

class QuestionStorage {
    private questions = new Map<string, PendingQuestionData>()
    private readonly TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

    /**
     * Store a pending question
     */
    storeQuestion(key: string, data: PendingQuestionInput): void {
        this.questions.set(key, {
            ...data,
            createdAt: Date.now()
        })
        console.log('[ClaudeWS Questions] Stored question:', key)
    }

    /**
     * Get a pending question by key
     */
    getQuestion(key: string): PendingQuestionData | undefined {
        return this.questions.get(key)
    }

    /**
     * Submit answer to a pending question
     * Returns true if question was found and resolved, false otherwise
     */
    submitAnswer(key: string, answer: string | string[]): { success: boolean; message: string; attemptId?: string } {
        const pending = this.questions.get(key)

        if (!pending) {
            return {
                success: false,
                message: `No pending question found for key: ${key}`
            }
        }

        // Check timeout
        const elapsed = Date.now() - pending.createdAt
        if (elapsed > this.TIMEOUT_MS) {
            this.questions.delete(key)
            return {
                success: false,
                message: 'Question has timed out'
            }
        }

        console.log('[ClaudeWS Questions] Submitting answer:', {
            key,
            answer,
            attemptId: pending.attemptId
        })

        // Build answer object
        const answerObj: Record<string, string> = {}
        if (Array.isArray(answer)) {
            answerObj[pending.question.header] = answer.join(', ')
        } else {
            answerObj[pending.question.header] = answer
        }

        // Resolve the promise to continue the flow
        pending.resolve(answerObj)

        // Remove from storage
        this.questions.delete(key)

        return {
            success: true,
            message: 'Answer submitted successfully',
            attemptId: pending.attemptId
        }
    }

    /**
     * Clean up all questions for a specific attempt
     */
    cleanupAttempt(attemptId: string): void {
        let cleaned = 0
        for (const [key, pending] of this.questions.entries()) {
            if (pending.attemptId === attemptId) {
                this.questions.delete(key)
                cleaned++
            }
        }
        if (cleaned > 0) {
            console.log(`[ClaudeWS Questions] Cleaned up ${cleaned} questions for attempt: ${attemptId}`)
        }
    }

    /**
     * Get all pending questions (for debugging)
     */
    getAllPending(): Array<{ key: string; data: PendingQuestionData }> {
        return Array.from(this.questions.entries()).map(([key, data]) => ({
            key,
            data
        }))
    }

    /**
     * Clean up expired questions (should be called periodically)
     */
    cleanupExpired(): number {
        const now = Date.now()
        let cleaned = 0
        for (const [key, pending] of this.questions.entries()) {
            if (now - pending.createdAt > this.TIMEOUT_MS) {
                this.questions.delete(key)
                cleaned++
            }
        }
        if (cleaned > 0) {
            console.log(`[ClaudeWS Questions] Cleaned up ${cleaned} expired questions`)
        }
        return cleaned
    }
}

// Export singleton instance
export const claudewsQuestionStorage = new QuestionStorage()

// Clean up expired questions every minute
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        claudewsQuestionStorage.cleanupExpired()
    }, 60 * 1000)
}
