import { useDraggable } from '@dnd-kit/core'
import { IconGripVertical } from '@tabler/icons-react'
import PropTypes from 'prop-types'

const DraggableCard = ({ id, children, disabled = false, onDragStart, onDragEnd }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: id,
        disabled: disabled,
        onDragStart: (event) => {
            onDragStart?.(event)
        },
        onDragEnd: (event) => {
            onDragEnd?.(event)
        }
    })

    const wrapperStyle = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              opacity: isDragging ? 0.5 : 1,
              position: 'relative'
          }
        : { position: 'relative' }

    return (
        <div ref={setNodeRef} style={wrapperStyle} className='draggable-card-wrapper'>
            {/* Drag handle - only this element receives drag listeners */}
            <div
                {...listeners}
                {...attributes}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    cursor: disabled ? 'default' : 'grab',
                    padding: 4,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    opacity: isDragging ? 1 : 0.5,
                    transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => {
                    if (!disabled) e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                    if (!disabled && !isDragging) e.currentTarget.style.opacity = '0.5'
                }}
            >
                <IconGripVertical size={20} />
            </div>
            {children}
        </div>
    )
}

DraggableCard.propTypes = {
    id: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    disabled: PropTypes.bool,
    onDragStart: PropTypes.func,
    onDragEnd: PropTypes.func
}

export default DraggableCard
