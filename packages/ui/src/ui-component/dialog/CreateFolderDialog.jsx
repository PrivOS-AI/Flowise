import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material'
import PropTypes from 'prop-types'

const CreateFolderDialog = ({ open, onClose, onSubmit, parentFolderName = null }) => {
    const [name, setName] = useState('')

    const handleSubmit = () => {
        if (name.trim()) {
            onSubmit(name.trim())
            setName('')
        }
    }

    const handleClose = () => {
        setName('')
        onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>{parentFolderName ? `Create Subfolder in "${parentFolderName}"` : 'Create New Folder'}</DialogTitle>
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
                <Button variant='contained' onClick={handleSubmit} disabled={!name.trim()}>
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    )
}

CreateFolderDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    parentFolderName: PropTypes.string
}

export default CreateFolderDialog
