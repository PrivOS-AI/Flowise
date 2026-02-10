import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { DEFAULT_PRIVOS_API_BASE_URL, PRIVOS_ENDPOINTS } from 'flowise-components'
import logger from '../../utils/logger'

const getRoomsByUserId = async (userId: string, query: Record<string, any>) => {
    const { offset, count, search } = query
    const types = ['p', 'c']
    try {
        const url = new URL(`${DEFAULT_PRIVOS_API_BASE_URL}${PRIVOS_ENDPOINTS.ROOM_BY_USER_ID}`)
        url.searchParams.append('userId', userId)
        url.searchParams.append('offset', offset)
        url.searchParams.append('count', count)
        if (search) url.searchParams.append('search', search)
        types.forEach((type) => url.searchParams.append('types', type))

        const response = await fetch(url.toString(), {
            headers: {
                'X-API-KEY': process.env.PRIVOS_CHAT_API_KEY || ''
            }
        })

        const data = await response.json()
        return data
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: privosChat.getRoomsByUserId - ${getErrorMessage(error)}`)
    }
}

const checkRoomExists = async (roomId: string) => {
    try {
        const url = new URL(`${DEFAULT_PRIVOS_API_BASE_URL}${PRIVOS_ENDPOINTS.ROOM_EXISTS}`)
        url.searchParams.append('roomId', roomId)

        const response = await fetch(url.toString(), {
            headers: {
                'X-API-KEY': process.env.PRIVOS_CHAT_API_KEY || ''
            }
        })

        const data = await response.json()
        return data?.exists ? true : false
    } catch (error) {
        logger.error(`privosChat.checkRoomExists - ${getErrorMessage(error)}`)
        return false
    }
}

export default { getRoomsByUserId, checkRoomExists }
