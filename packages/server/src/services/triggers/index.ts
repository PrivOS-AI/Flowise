import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { Trigger } from '../../database/entities/Trigger'

// Get all triggers
const getAllTriggers = async (workspaceId?: string, page: number = -1, limit: number = -1) => {
    try {
        const appServer = getRunningExpressApp()
        const queryBuilder = appServer.AppDataSource.getRepository(Trigger).createQueryBuilder('t').orderBy('t.updatedDate', 'DESC')
        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }
        if (workspaceId) queryBuilder.andWhere('t.workspaceId = :workspaceId', { workspaceId })

        const [data, total] = await queryBuilder.getManyAndCount()

        if (page > 0 && limit > 0) {
            return { total, data }
        } else {
            return data
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: triggersService.getAllTriggers - ${getErrorMessage(error)}`
        )
    }
}

// Get trigger by id
const getTrigger = async (id: string) => {
    try {
        const appServer = getRunningExpressApp()
        const trigger = await appServer.AppDataSource.getRepository(Trigger).findOneBy({
            id: id
        })
        return trigger
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: triggersService.getTrigger - ${getErrorMessage(error)}`)
    }
}

// Get trigger by slug
const getTriggerBySlug = async (slug: string) => {
    try {
        const appServer = getRunningExpressApp()
        const trigger = await appServer.AppDataSource.getRepository(Trigger).findOneBy({
            slug: slug
        })
        return trigger
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: triggersService.getTriggerBySlug - ${getErrorMessage(error)}`
        )
    }
}

// Get triggers by flow id
const getTriggersByFlowId = async (flowId: string) => {
    try {
        const appServer = getRunningExpressApp()
        const triggers = await appServer.AppDataSource.getRepository(Trigger).find({
            where: { flowId },
            order: { updatedDate: 'DESC' }
        })
        return triggers
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: triggersService.getTriggersByFlowId - ${getErrorMessage(error)}`
        )
    }
}

// Create new trigger
const createTrigger = async (body: any) => {
    try {
        const appServer = getRunningExpressApp()
        const newTrigger = new Trigger()
        Object.assign(newTrigger, body)
        const trigger = appServer.AppDataSource.getRepository(Trigger).create(newTrigger)
        const result = await appServer.AppDataSource.getRepository(Trigger).save(trigger)
        return result
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: triggersService.createTrigger - ${getErrorMessage(error)}`)
    }
}

// Update trigger
const updateTrigger = async (id: string, body: any) => {
    try {
        const appServer = getRunningExpressApp()
        const trigger = await appServer.AppDataSource.getRepository(Trigger).findOneBy({
            id: id
        })
        if (!trigger) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Trigger ${id} not found`)

        const updateTrigger = new Trigger()
        Object.assign(updateTrigger, body)
        appServer.AppDataSource.getRepository(Trigger).merge(trigger, updateTrigger)
        const result = await appServer.AppDataSource.getRepository(Trigger).save(trigger)
        return result
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: triggersService.updateTrigger - ${getErrorMessage(error)}`)
    }
}

// Delete trigger via id
const deleteTrigger = async (id: string) => {
    try {
        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.getRepository(Trigger).delete({ id: id })
        return result
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: triggersService.deleteTrigger - ${getErrorMessage(error)}`)
    }
}

const deleteManyTrigger = async (where: any) => {
    try {
        const appServer = getRunningExpressApp()
        const result = await appServer.AppDataSource.getRepository(Trigger).delete(where)
        return result
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: triggersService.deleteManyTrigger - ${getErrorMessage(error)}`)
    }
}

export default {
    getAllTriggers,
    getTrigger,
    getTriggerBySlug,
    getTriggersByFlowId,
    createTrigger,
    updateTrigger,
    deleteTrigger,
    deleteManyTrigger
}