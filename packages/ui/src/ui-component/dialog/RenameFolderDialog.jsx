import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material'
import PropTypes from 'prop-types'

const RenameFolderDialog = ({ open, onClose, onSubmit, folderName }) => {
    const [name, setName] = useState('')

    useEffect(() => {
        setName(folderName)
    }, [folderName])

    const handleSubmit = () => {
        if (name.trim() && name !== folderName) {
            onSubmit(name.trim())
        }
    }

    const handleClose = () => {
        setName(folderName)
        onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    label='Folder Name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    sx={{ mt: 2 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button variant='contained' onClick={handleSubmit} disabled={!name.trim() || name === folderName}>
                    Rename
                </Button>
            </DialogActions>
        </Dialog>
    )
}

RenameFolderDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    folderName: PropTypes.string.isRequired
}

export default RenameFolderDialog
