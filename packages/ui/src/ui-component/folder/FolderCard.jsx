import { Box, Typography } from '@mui/material'
import { IconFolder } from '@tabler/icons-react'
import MainCard from '@/ui-component/cards/MainCard'
import PropTypes from 'prop-types'

const FolderCard = ({ folder, count, onClick }) => {
    return (
        <MainCard
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                cursor: 'pointer',
                minHeight: 'auto',
                height: 80,
                '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                },
                transition: 'all 0.2s ease-in-out'
            }}
            onClick={onClick}
        >
            <Box sx={{ p: 1.5, height: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconFolder size={32} color='#ffd700' />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant='body1'
                        noWrap
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: 500,
                            fontSize: '0.95rem'
                        }}
                    >
                        {folder.name}
                    </Typography>
                    {count > 0 && (
                        <Typography variant='caption' color='text.secondary'>
                            {count} item{count !== 1 ? 's' : ''}
                        </Typography>
                    )}
                </Box>
            </Box>
        </MainCard>
    )
}

FolderCard.propTypes = {
    folder: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    }).isRequired,
    count: PropTypes.number.isRequired,
    onClick: PropTypes.func.isRequired
}

export default FolderCard
