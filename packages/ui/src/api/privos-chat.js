import client from './client'

const getRoomsByUserId = (userId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.keyword) queryParams.append('keyword', params.keyword)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)

    const queryString = queryParams.toString()
    return client.get(`/privos-chat/${userId}/room${queryString ? `?${queryString}` : ''}`)
}

export default {
    getRoomsByUserId
}
