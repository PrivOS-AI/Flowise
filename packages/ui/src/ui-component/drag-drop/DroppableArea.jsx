import { useDroppable } from '@dnd-kit/core'
import { Box } from '@mui/material'
import PropTypes from 'prop-types'

const DroppableArea = ({ id, children, disabled = false }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        disabled: disabled
    })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                position: 'relative',
                ...(isOver && {
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'primary.main',
                        opacity: 0.1,
                        pointerEvents: 'none',
                        borderRadius: 2
                    }
                })
            }}
        >
            {children}
        </Box>
    )
}

DroppableArea.propTypes = {
    id: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    disabled: PropTypes.bool
}

export default DroppableArea
