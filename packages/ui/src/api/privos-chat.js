import client from './client'

const getRoomsByUserId = (userId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.search) queryParams.append('search', params.search)
    if (params.offset != undefined) queryParams.append('offset', params.offset)
    if (params.count) queryParams.append('count', params.count)

    const queryString = queryParams.toString()
    return client.get(`/privos-chat/${userId}/room${queryString ? `?${queryString}` : ''}`)
}

export default {
    getRoomsByUserId
}
