import { Request, Response, NextFunction } from 'express'
import credentialsService from '../../services/credentials'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const createCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.createCredential - body not provided!`
            )
        }
        const body = req.body
        body.workspaceId = req.user?.activeWorkspaceId

        // Room isolation: Only set roomId if user is NOT root admin
        if (!req.isRootAdmin && req.roomId) {
            body.roomId = req.roomId
        }

        const apiResponse = await credentialsService.createCredential(body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.deleteCredentials - id not provided!`
            )
        }

        // Room isolation: Check if user can delete this credential
        const credential = await credentialsService.getCredentialById(req.params.id, req.user?.activeWorkspaceId)
        if (!credential) {
            return res.status(404).send(`Credential ${req.params.id} not found`)
        }

        // Prevent room users from deleting global resources
        if (!req.isRootAdmin && req.roomId && !credential.roomId) {
            throw new InternalFlowiseError(
                StatusCodes.FORBIDDEN,
                `Error: credentialsController.deleteCredentials - Cannot delete global resources. This credential was created by a root admin and is read-only for room users.`
            )
        }

        const apiResponse = await credentialsService.deleteCredentials(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllCredentials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await credentialsService.getAllCredentials(
            req.query.credentialName,
            req.user?.activeWorkspaceId,
            req.roomId,
            req.isRootAdmin
        )
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getCredentialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.getCredentialById - id not provided!`
            )
        }
        const apiResponse = await credentialsService.getCredentialById(req.params.id, req.user?.activeWorkspaceId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateCredential = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - id not provided!`
            )
        }
        if (!req.body) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: credentialsController.updateCredential - body not provided!`
            )
        }

        // Room isolation: Check if user can update this credential
        const credential = await credentialsService.getCredentialById(req.params.id, req.user?.activeWorkspaceId)
        if (!credential) {
            return res.status(404).send(`Credential ${req.params.id} not found`)
        }

        // Prevent room users from editing global resources
        if (!req.isRootAdmin && req.roomId && !credential.roomId) {
            throw new InternalFlowiseError(
                StatusCodes.FORBIDDEN,
                `Error: credentialsController.updateCredential - Cannot edit global resources. This credential was created by a root admin and is read-only for room users.`
            )
        }

        const apiResponse = await credentialsService.updateCredential(req.params.id, req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    createCredential,
    deleteCredentials,
    getAllCredentials,
    getCredentialById,
    updateCredential
}
