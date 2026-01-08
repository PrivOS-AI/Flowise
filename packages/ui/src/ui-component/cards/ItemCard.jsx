import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useState } from 'react'

// material-ui
import { styled } from '@mui/material/styles'
import { Box, Grid, Tooltip, Typography, useTheme, IconButton, Menu, MenuItem } from '@mui/material'

// icons
import { IconDots } from '@tabler/icons-react'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import MoreItemsTooltip from '../tooltip/MoreItemsTooltip'

const CardWrapper = styled(MainCard)(({ theme }) => ({
    background: theme.palette.card.main,
    color: theme.darkTextPrimary,
    overflow: 'auto',
    position: 'relative',
    boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)',
    cursor: 'pointer',
    '&:hover': {
        background: theme.palette.card.hover,
        boxShadow: '0 2px 14px 0 rgb(32 40 45 / 20%)'
    },
    height: '100%',
    minHeight: '160px',
    maxHeight: '300px',
    width: '100%',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line'
}))

// ===========================|| CONTRACT CARD ||=========================== //

const ItemCard = ({ data, images, icons, onClick, menuOptions }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const [anchorEl, setAnchorEl] = useState(null)
    const menuOpen = Boolean(anchorEl)

    const handleMenuClick = (e) => {
        e.stopPropagation()
        setAnchorEl(e.currentTarget)
    }

    const handleMenuClose = () => {
        setAnchorEl(null)
    }

    const handleMenuAction = (action) => {
        action(data)
        handleMenuClose()
    }

    return (
        <CardWrapper content={false} onClick={onClick} sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}>
            <Box sx={{ height: '100%', p: 2.25 }}>
                <Grid container justifyContent='space-between' direction='column' sx={{ height: '100%', gap: 3 }}>
                    {menuOptions && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <IconButton size='small' onClick={handleMenuClick}>
                                <IconDots size={18} />
                            </IconButton>
                            <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
                                {menuOptions.map((option, index) => (
                                    <MenuItem key={index} onClick={() => handleMenuAction(option.action)}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </Box>
                    )}
                    <Box display='flex' flexDirection='column' sx={{ width: '100%' }}>
                        <div
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                overflow: 'hidden'
                            }}
                        >
                            {data.iconSrc && (
                                <div
                                    style={{
                                        width: 35,
                                        height: 35,
                                        display: 'flex',
                                        flexShrink: 0,
                                        marginRight: 10,
                                        borderRadius: '50%',
                                        backgroundImage: `url(${data.iconSrc})`,
                                        backgroundSize: 'contain',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center center'
                                    }}
                                ></div>
                            )}
                            {!data.iconSrc && data.color && (
                                <div
                                    style={{
                                        width: 35,
                                        height: 35,
                                        display: 'flex',
                                        flexShrink: 0,
                                        marginRight: 10,
                                        borderRadius: '50%',
                                        background: data.color
                                    }}
                                ></div>
                            )}
                            <Typography
                                sx={{
                                    display: '-webkit-box',
                                    fontSize: '1.25rem',
                                    fontWeight: 500,
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden'
                                }}
                            >
                                {data.templateName || data.name}
                            </Typography>
                        </div>
                        {data.description && (
                            <span
                                style={{
                                    display: '-webkit-box',
                                    marginTop: 10,
                                    overflowWrap: 'break-word',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden'
                                }}
                            >
                                {data.description}
                            </span>
                        )}
                    </Box>
                    {(images?.length > 0 || icons?.length > 0) && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'start',
                                gap: 1
                            }}
                        >
                            {[
                                ...(images || []).map((img) => ({ type: 'image', src: img.imageSrc, label: img.label })),
                                ...(icons || []).map((ic) => ({ type: 'icon', icon: ic.icon, color: ic.color, label: ic.name }))
                            ]
                                .slice(0, 3)
                                .map((item, index) => (
                                    <Tooltip key={item.src || index} title={item.label} placement='top'>
                                        {item.type === 'image' ? (
                                            <Box
                                                sx={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: '50%',
                                                    backgroundColor: customization.isDarkMode
                                                        ? theme.palette.common.white
                                                        : theme.palette.grey[300] + 75
                                                }}
                                            >
                                                <img
                                                    style={{ width: '100%', height: '100%', padding: 5, objectFit: 'contain' }}
                                                    alt=''
                                                    src={item.src}
                                                />
                                            </Box>
                                        ) : (
                                            <div
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <item.icon size={25} color={item.color} />
                                            </div>
                                        )}
                                    </Tooltip>
                                ))}

                            {(images?.length || 0) + (icons?.length || 0) > 3 && (
                                <MoreItemsTooltip
                                    images={[
                                        ...(images?.slice(3) || []),
                                        ...(icons?.slice(Math.max(0, 3 - (images?.length || 0))) || []).map((ic) => ({ label: ic.name }))
                                    ]}
                                >
                                    <Typography
                                        sx={{
                                            alignItems: 'center',
                                            display: 'flex',
                                            fontSize: '.9rem',
                                            fontWeight: 200
                                        }}
                                    >
                                        + {(images?.length || 0) + (icons?.length || 0) - 3} More
                                    </Typography>
                                </MoreItemsTooltip>
                            )}
                        </Box>
                    )}
                </Grid>
            </Box>
        </CardWrapper>
    )
}

ItemCard.propTypes = {
    data: PropTypes.object,
    images: PropTypes.array,
    icons: PropTypes.array,
    onClick: PropTypes.func,
    menuOptions: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string,
            action: PropTypes.func
        })
    )
}

export default ItemCard
