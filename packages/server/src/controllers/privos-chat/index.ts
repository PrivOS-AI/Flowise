import { Request, Response, NextFunction } from 'express'
import privosChatService from '../../services/privos-chat'

const getRoomsByUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await privosChatService.getRoomsByUserId(req.params.userId || '', req.query)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getRoomsByUserId
}
