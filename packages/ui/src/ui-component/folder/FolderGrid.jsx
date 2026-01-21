import DroppableArea from '@/ui-component/drag-drop/DroppableArea'
import { Box, Typography } from '@mui/material'
import FolderCard from './FolderCard'
import PropTypes from 'prop-types'

const FolderGrid = ({ folders, getFlowCount, onFolderClick }) => {
    if (folders.length === 0) return null

    return (
        <Box sx={{ mb: 3 }}>
            {/* Section Header */}
            <Typography variant='h4' sx={{ mb: 2, fontWeight: 700, color: 'text.primary' }}>
                Folders
            </Typography>
            {/* Folders Grid - Google Drive style: more columns */}
            <Box display='grid' gridTemplateColumns='repeat(auto-fill, minmax(200px, 1fr))' gap={2}>
                {folders.map((folder) => (
                    <DroppableArea key={folder.id} id={folder.id}>
                        <FolderCard folder={folder} count={getFlowCount(folder.id)} onClick={() => onFolderClick(folder)} />
                    </DroppableArea>
                ))}
            </Box>
        </Box>
    )
}

FolderGrid.propTypes = {
    folders: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired
        })
    ).isRequired,
    getFlowCount: PropTypes.func.isRequired,
    onFolderClick: PropTypes.func.isRequired
}

export default FolderGrid
