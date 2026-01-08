import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import PropTypes from 'prop-types'

const FolderMenu = ({ anchorEl, onClose, onRename, onDelete }) => {
    return (
        <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right'
            }}
            slotProps={{
                paper: {
                    sx: {
                        minWidth: 120
                    }
                }
            }}
        >
            <MenuItem
                onClick={() => {
                    onRename()
                    onClose()
                }}
            >
                <ListItemIcon>
                    <IconEdit size={16} />
                </ListItemIcon>
                <ListItemText>Rename</ListItemText>
            </MenuItem>
            <MenuItem
                onClick={() => {
                    onDelete()
                    onClose()
                }}
                sx={{ color: 'error.main' }}
            >
                <ListItemIcon>
                    <IconTrash size={16} color='error' />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
            </MenuItem>
        </Menu>
    )
}

FolderMenu.propTypes = {
    anchorEl: PropTypes.object,
    onClose: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
}

export default FolderMenu
