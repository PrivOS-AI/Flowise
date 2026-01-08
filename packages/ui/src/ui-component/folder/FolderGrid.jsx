import DroppableArea from '@/ui-component/drag-drop/DroppableArea'
import { Box } from '@mui/material'
import FolderCard from './FolderCard'
import { gridSpacing } from '@/store/constant'
import PropTypes from 'prop-types'

const FolderGrid = ({ folders, agentflows, onFolderClick }) => {
    const getAgentflowsInFolder = (folderId) => {
        return agentflows.filter((flow) => flow.folderId === folderId)
    }

    return (
        <Box sx={{ mb: 3 }}>
            {/* Folders Grid */}
            {folders.length > 0 && (
                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                    {folders.map((folder) => (
                        <DroppableArea key={folder.id} id={folder.id}>
                            <FolderCard
                                folder={folder}
                                count={getAgentflowsInFolder(folder.id).length}
                                onClick={() => onFolderClick(folder)}
                            />
                        </DroppableArea>
                    ))}
                </Box>
            )}
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
    agentflows: PropTypes.arrayOf(
        PropTypes.shape({
            folderId: PropTypes.string
        })
    ).isRequired,
    onFolderClick: PropTypes.func.isRequired
}

export default FolderGrid
