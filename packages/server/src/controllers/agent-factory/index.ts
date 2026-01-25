import { Request, Response, NextFunction } from 'express'
import agentFactoryService from '../../services/agent-factory'

const importPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.importPlugin(req.body)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const listPlugins = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const type = req.query.type as string
        const result = await agentFactoryService.listPlugins(type)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const discoverPlugins = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.discoverPlugins(req.body.paths)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const uploadPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.uploadPlugin(req.body)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const getPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.getPlugin(req.params.id)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const deletePlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.deletePlugin(req.params.id)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const getFileContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.getFileContent(req.body.path)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const listFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.listFiles(req.body.sourcePath)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const getDependencies = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await agentFactoryService.getDependencies(req.body.sourcePath)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

export default {
    importPlugin,
    listPlugins,
    discoverPlugins,
    uploadPlugin,
    getPlugin,
    deletePlugin,
    getFileContent,
    listFiles,
    getDependencies
}
