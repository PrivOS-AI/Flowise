/**
 * In-memory accumulator for ClaudeWS question answers
 *
 * Accumulates individual answers and emits complete event when all questions answered
 */

interface PendingAttempt {
    attemptId: string
    toolUseId: string
    serverId: string
    questions: Array<{ header: string; question: string; options?: any[]; multiSelect?: boolean }>
    answers: Record<string, string>
    totalQuestions: number
    answeredCount: number
    createdAt: number
}

class AnswerAccumulator {
    private pendingAttempts = new Map<string, PendingAttempt>()
    private readonly TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

    /**
     * Initialize questions for an attempt (called when questions are stored)
     */
    initQuestions(attemptId: string, toolUseId: string, serverId: string, questions: any[]): void {
        const key = `${attemptId}-${toolUseId}`

        this.pendingAttempts.set(key, {
            attemptId,
            toolUseId,
            serverId,
            questions,
            answers: {},
            totalQuestions: questions.length,
            answeredCount: 0,
            createdAt: Date.now()
        })

        console.log(`[ClaudeWS Accumulator] Initialized ${questions.length} questions for attempt ${attemptId}`)
    }

    /**
     * Add an answer. Returns completed data if all questions answered, null otherwise
     */
    addAnswer(
        attemptId: string,
        toolUseId: string,
        questionHeader: string,
        answer: string | string[]
    ): { completed: boolean; data?: any; error?: string } {
        const key = `${attemptId}-${toolUseId}`
        const pending = this.pendingAttempts.get(key)

        if (!pending) {
            return {
                completed: false,
                error: `No pending questions found for attempt ${attemptId}`
            }
        }

        // Check timeout
        const elapsed = Date.now() - pending.createdAt
        if (elapsed > this.TIMEOUT_MS) {
            this.pendingAttempts.delete(key)
            return {
                completed: false,
                error: 'Questions have timed out'
            }
        }

        // Skip if already answered
        if (pending.answers[questionHeader]) {
            console.log(`[ClaudeWS Accumulator] Question ${questionHeader} already answered`)
            return { completed: false }
        }

        // Add answer
        pending.answers[questionHeader] = Array.isArray(answer) ? answer.join(', ') : answer
        pending.answeredCount++

        console.log(`[ClaudeWS Accumulator] Answered ${pending.answeredCount}/${pending.totalQuestions} for attempt ${attemptId}`)

        // Check if all questions answered
        if (pending.answeredCount >= pending.totalQuestions) {
            console.log(`[ClaudeWS Accumulator] All questions answered for attempt ${attemptId}`)

            const data = {
                attemptId,
                serverId: pending.serverId,
                questions: pending.questions,
                answers: pending.answers
            }

            // Clean up
            this.pendingAttempts.delete(key)

            return { completed: true, data }
        }

        return { completed: false }
    }

    /**
     * Get pending attempt status
     */
    getStatus(attemptId: string, toolUseId: string): { pending: boolean; answered: number; total: number; serverId: string } | null {
        const key = `${attemptId}-${toolUseId}`
        const pending = this.pendingAttempts.get(key)

        if (!pending) return null

        return {
            pending: true,
            answered: pending.answeredCount,
            total: pending.totalQuestions,
            serverId: pending.serverId
        }
    }

    /**
     * Clean up expired attempts
     */
    cleanupExpired(): number {
        const now = Date.now()
        let cleaned = 0

        for (const [key, pending] of this.pendingAttempts.entries()) {
            if (now - pending.createdAt > this.TIMEOUT_MS) {
                this.pendingAttempts.delete(key)
                cleaned++
            }
        }

        if (cleaned > 0) {
            console.log(`[ClaudeWS Accumulator] Cleaned up ${cleaned} expired attempts`)
        }

        return cleaned
    }
}

export const answerAccumulator = new AnswerAccumulator()

// Clean up expired attempts every minute
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        answerAccumulator.cleanupExpired()
    }, 60 * 1000)
}
