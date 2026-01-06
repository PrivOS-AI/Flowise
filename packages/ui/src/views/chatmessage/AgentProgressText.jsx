import { memo, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, LinearProgress } from '@mui/material'
import { IconLoader } from '@tabler/icons-react'
import { useTheme } from '@mui/material/styles'

/**
 * AgentProgressText - Component hiển thị tiến độ agent dạng text đơn giản
 * Hiển thị: "Đang thực hiện 1/3" hoặc "Đã hoàn thành 3/3 bước"
 */
const AgentProgressText = ({ execution, status }) => {
    const theme = useTheme()
    const [progress, setProgress] = useState({ current: 0, total: 0, text: '' })

    useEffect(() => {
        if (!execution || !Array.isArray(execution) || execution.length === 0) {
            setProgress({ current: 0, total: 0, text: '' })
            return
        }

        // Đếm tổng số node và số node đã hoàn thành
        const totalNodes = execution.length
        const finishedNodes = execution.filter((node) => node.status === 'FINISHED').length
        const inProgressNodes = execution.filter((node) => node.status === 'INPROGRESS').length
        const errorNodes = execution.filter((node) => node.status === 'ERROR' || node.status === 'TIMEOUT').length
        const stoppedNodes = execution.filter((node) => node.status === 'STOPPED' || node.status === 'TERMINATED').length

        // Tính current step
        let current = finishedNodes
        if (inProgressNodes > 0) {
            current = finishedNodes + 1 // Đang thực hiện = finished + 1
        }

        // Xác định trạng thái tổng thể
        const isCompleted = status === 'FINISHED' || (finishedNodes === totalNodes && totalNodes > 0)
        const isError = status === 'ERROR' || errorNodes > 0
        const isStopped = status === 'STOPPED' || status === 'TERMINATED' || stoppedNodes > 0
        const isInProgress = inProgressNodes > 0 || (!isCompleted && !isError && !isStopped)

        // Tạo text hiển thị
        let progressText = ''
        if (isCompleted) {
            progressText = `✅ Đã hoàn thành ${totalNodes} bước`
        } else if (isError) {
            progressText = `❌ Lỗi tại bước ${current}/${totalNodes}`
        } else if (isStopped) {
            progressText = `⏸️ Đã dừng tại bước ${current}/${totalNodes}`
        } else if (isInProgress) {
            progressText = `⏳ Đang thực hiện ${current}/${totalNodes}`
        } else {
            progressText = `🚀 Chuẩn bị thực hiện ${totalNodes} bước`
        }

        setProgress({
            current,
            total: totalNodes,
            text: progressText
        })
    }, [execution, status])

    // Không hiển thị nếu không có progress
    if (progress.total === 0) {
        return null
    }

    // Tính % complete cho progress bar
    const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

    // Xác định màu progress bar
    const getProgressColor = () => {
        if (status === 'ERROR') return theme.palette.error.main
        if (status === 'STOPPED' || status === 'TERMINATED') return theme.palette.warning.main
        if (status === 'FINISHED') return theme.palette.success.main
        return theme.palette.primary.main
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                mt: 1,
                mb: 1,
                px: 1,
                py: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: `1px solid ${theme.palette.divider}`
            }}
        >
            {/* Text progress */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {status === 'INPROGRESS' && <IconLoader size={16} color={theme.palette.primary.main} className='spin-animation' />}
                    <Typography
                        variant='body2'
                        sx={{
                            fontWeight: 500,
                            color: 'text.primary'
                        }}
                    >
                        {progress.text}
                    </Typography>
                </Box>
                {/* Hiển thị % */}
                <Typography
                    variant='caption'
                    sx={{
                        color: 'text.secondary',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                    }}
                >
                    {Math.round(progressPercent)}%
                </Typography>
            </Box>

            {/* Progress bar */}
            <LinearProgress
                variant='determinate'
                value={progressPercent}
                sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.action.selected,
                    '& .MuiLinearProgress-bar': {
                        backgroundColor: getProgressColor(),
                        borderRadius: 3
                    }
                }}
            />
        </Box>
    )
}

AgentProgressText.propTypes = {
    execution: PropTypes.array,
    status: PropTypes.string
}

export default memo(AgentProgressText)
