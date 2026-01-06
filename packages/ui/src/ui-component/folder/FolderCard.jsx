import { Box, Typography, Badge } from '@mui/material'
import { IconFolder } from '@tabler/icons-react'
import MainCard from '@/ui-component/cards/MainCard'
import PropTypes from 'prop-types'

const FolderCard = ({ folder, count, onClick }) => {
    return (
        <MainCard
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                cursor: 'pointer',
                minHeight: 100,
                '&:hover': { borderColor: 'primary.main' }
            }}
            onClick={onClick}
        >
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box display='flex' alignItems='center' gap={1.5}>
                    <IconFolder size={24} color='#ffd700' />
                    <Typography variant='h3' noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                        {folder.name}
                    </Typography>
                </Box>
                <Box>
                    <Badge badgeContent={count} color='primary'>
                        <Typography variant='body2' color='text.secondary'>
                            Agentflows
                        </Typography>
                    </Badge>
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
