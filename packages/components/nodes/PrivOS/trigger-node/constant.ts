export const SCHEDULE_TYPES = {
    INTERVAL: 'interval',
    ONCE: 'once',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    CRON: 'cron',
} as const

export const SCHEDULE_TYPE_OPTIONS = [
    {
        label: 'Interval',
        name: SCHEDULE_TYPES.INTERVAL,
        description: 'Every X seconds/minutes/hours/days'
    },
    {
        label: 'Once',
        name: SCHEDULE_TYPES.ONCE,
        description: 'Run at specific date and time'
    },
    {
        label: 'Daily',
        name: SCHEDULE_TYPES.DAILY,
        description: 'Every day at specific time'
    },
    {
        label: 'Weekly',
        name: SCHEDULE_TYPES.WEEKLY,
        description: 'On specific days of week'
    },
    {
        label: 'Monthly',
        name: SCHEDULE_TYPES.MONTHLY,
        description: 'On specific days of month'
    },
    {
        label: 'Cron Expression',
        name: SCHEDULE_TYPES.CRON,
        description: 'Advanced timing with cron syntax'
    },
]

// ============================================================================
// CRON TEMPLATES
// ============================================================================

export const CRON_TEMPLATES = [
    {
        label: 'Every Minute',
        name: 'every_minute',
        cronExpression: '* * * * *',
        description: 'Runs every minute'
    },
    {
        label: 'Every 5 Minutes',
        name: 'every_5min',
        cronExpression: '*/5 * * * *',
        description: 'Runs every 5 minutes'
    },
    {
        label: 'Every 15 Minutes',
        name: 'every_15min',
        cronExpression: '*/15 * * * *',
        description: 'Runs every 15 minutes'
    },
    {
        label: 'Every 30 Minutes',
        name: 'every_30min',
        cronExpression: '*/30 * * * *',
        description: 'Runs every 30 minutes'
    },
    {
        label: 'Every Hour',
        name: 'every_hour',
        cronExpression: '0 * * * *',
        description: 'Runs at top of every hour'
    },
    {
        label: 'Every 6 Hours',
        name: 'every_6h',
        cronExpression: '0 */6 * * *',
        description: 'Runs 4 times daily'
    },
    {
        label: 'Every 12 Hours',
        name: 'every_12h',
        cronExpression: '0 */12 * * *',
        description: 'Runs twice daily'
    },
    {
        label: 'Daily at Midnight',
        name: 'daily_midnight',
        cronExpression: '0 0 * * *',
        description: 'Runs every day at 00:00 UTC'
    },
    {
        label: 'Daily at 9 AM',
        name: 'daily_9am',
        cronExpression: '0 9 * * *',
        description: 'Runs every day at 09:00 UTC'
    },
    {
        label: 'Weekdays at 9 AM',
        name: 'weekdays_9am',
        cronExpression: '0 9 * * 1-5',
        description: 'Mon-Fri at 09:00 UTC'
    },
    {
        label: 'Monday at 9 AM',
        name: 'monday_9am',
        cronExpression: '0 9 * * 1',
        description: 'Every Monday at 09:00 UTC'
    },
    {
        label: 'First Day of Month',
        name: 'monthly_1st',
        cronExpression: '0 0 1 * *',
        description: 'Runs on 1st of every month'
    },
    {
        label: 'Last Day of Month',
        name: 'monthly_last',
        cronExpression: '0 0 L * *',
        description: 'Runs on last day of month'
    }
]

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const SCHEDULE_DEFAULTS = {
    INTERVAL: 5,
    UNIT: 'minutes',
    TIME: '09:00',
    TIMEZONE: 'UTC',
    CRON: '0 * * * *',
    MAX_EXECUTIONS: -1,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 3000
} as const

// ============================================================================
// INTERVAL MULTIPLIERS (to milliseconds)
// ============================================================================

export const INTERVAL_MS: Record<string, number> = {
    seconds: 1000,
    minutes: 1000 * 60,
    hours: 1000 * 60 * 60,
    days: 1000 * 60 * 60 * 24
}

// ============================================================================
// COMMON SCHEDULES (for quick reference)
// ============================================================================

export const COMMON_SCHEDULES = {
    EVERY_MINUTE: { interval: 1, unit: 'minutes' },
    EVERY_5_MINUTES: { interval: 5, unit: 'minutes' },
    EVERY_15_MINUTES: { interval: 15, unit: 'minutes' },
    EVERY_30_MINUTES: { interval: 30, unit: 'minutes' },
    EVERY_HOUR: { interval: 1, unit: 'hours' },
    EVERY_6_HOURS: { interval: 6, unit: 'hours' },
    EVERY_DAY: { interval: 1, unit: 'days' },
    EVERY_WEEK: { interval: 7, unit: 'days' }
}
