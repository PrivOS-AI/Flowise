import { Request, Response, NextFunction } from 'express'
import agentflowv3Service from '../../services/agentflowv3-generator'

const getV3Prompt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prompt = await agentflowv3Service.buildAgentflowV3Prompt()
        return res.json({ prompt })
    } catch (error) {
        next(error)
    }
}

export default {
    getV3Prompt
}
