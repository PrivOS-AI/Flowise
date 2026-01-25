import { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'

const SPINNER_FRAMES = ['·', '✻', '✽', '✶', '✢', '❅', '❆', '✧', '✦']
const FRAME_INTERVAL = 200

const STATUS_VERBS = [
    'Thinking',
    'Tinkering',
    'Shipping',
    'Cooking',
    'Brewing',
    'Crafting',
    'Weaving',
    'Forging',
    'Building',
    'Conjuring',
    'Spinning',
    'Crunching',
    'Pondering',
    'Dreaming',
    'Plotting'
]

export function getRandomStatusVerb() {
    return STATUS_VERBS[Math.floor(Math.random() * STATUS_VERBS.length)]
}

export function useRandomStatusVerb() {
    return useMemo(() => getRandomStatusVerb(), [])
}

export function RunningDots({ className, style }) {
    const [frameIndex, setFrameIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
        }, FRAME_INTERVAL)
        return () => clearInterval(interval)
    }, [])

    return (
        <span
            className={className}
            style={{
                fontFamily: 'monospace',
                display: 'inline-block',
                width: '1ch',
                textAlign: 'center',
                color: '#b9664a',
                ...style
            }}
        >
            {SPINNER_FRAMES[frameIndex]}
        </span>
    )
}

RunningDots.propTypes = {
    className: PropTypes.string,
    style: PropTypes.object
}
