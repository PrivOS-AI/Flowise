import { z } from 'zod'
import { StructuredTool } from '@langchain/core/tools'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getBaseClasses } from '../../../src/utils'
import { AWS_REGIONS, DEFAULT_AWS_REGION, getAWSCredentials } from '../../../src/awsToolsUtils'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'

// Operation enum
enum Operation {
    UPLOAD = 'upload',
    DOWNLOAD = 'download',
    DELETE = 'delete',
    LIST = 'list'
}

/**
 * Tool for uploading files to S3/MinIO
 */
class S3UploadTool extends StructuredTool {
    name = 's3_upload'
    description = 'Upload a text file to S3/MinIO bucket. Provide key (filename) and content.'
    schema = z.object({
        key: z.string().min(1).describe('The key/filename for the object in S3'),
        content: z.string().describe('The text content to upload'),
        contentType: z.string().optional().describe('Optional content type (e.g., text/plain, application/json)')
    })
    private readonly s3Client: S3Client
    private readonly bucket: string

    constructor(s3Client: S3Client, bucket: string) {
        super()
        this.s3Client = s3Client
        this.bucket = bucket
    }

    async _call({ key, content, contentType }: z.infer<typeof this.schema>): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: content,
                ContentType: contentType || 'text/plain'
            })

            await this.s3Client.send(command)
            return `Successfully uploaded "${key}" to bucket "${this.bucket}"`
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to upload file: ${errorMessage}`)
        }
    }
}

/**
 * Tool for downloading files from S3/MinIO
 */
class S3DownloadTool extends StructuredTool {
    name = 's3_download'
    description = 'Download a text file from S3/MinIO bucket by key.'
    schema = z.object({
        key: z.string().min(1).describe('The key/filename of the object to download')
    })
    private readonly s3Client: S3Client
    private readonly bucket: string

    constructor(s3Client: S3Client, bucket: string) {
        super()
        this.s3Client = s3Client
        this.bucket = bucket
    }

    async _call({ key }: z.infer<typeof this.schema>): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            })

            const response = await this.s3Client.send(command)

            if (!response.Body) {
                throw new Error('No data received from S3')
            }

            // Convert stream to string
            const chunks: Uint8Array[] = []
            const stream = response.Body as any
            for await (const chunk of stream) {
                chunks.push(chunk)
            }
            const content = Buffer.concat(chunks).toString('utf-8')

            return JSON.stringify({
                key,
                bucket: this.bucket,
                content,
                size: content.length
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('NoSuchKey') || errorMessage.includes('404')) {
                return JSON.stringify({ key, found: false, error: 'File not found' })
            }
            throw new Error(`Failed to download file: ${errorMessage}`)
        }
    }
}

/**
 * Tool for deleting files from S3/MinIO
 */
class S3DeleteTool extends StructuredTool {
    name = 's3_delete'
    description = 'Delete a file from S3/MinIO bucket by key.'
    schema = z.object({
        key: z.string().min(1).describe('The key/filename of the object to delete')
    })
    private readonly s3Client: S3Client
    private readonly bucket: string

    constructor(s3Client: S3Client, bucket: string) {
        super()
        this.s3Client = s3Client
        this.bucket = bucket
    }

    async _call({ key }: z.infer<typeof this.schema>): Promise<string> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key
            })

            await this.s3Client.send(command)
            return `Successfully deleted "${key}" from bucket "${this.bucket}"`
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to delete file: ${errorMessage}`)
        }
    }
}

/**
 * Node implementation for S3/MinIO Storage tools
 */
class S3Storage_Tools implements INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    description: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'S3/MinIO Storage'
        this.name = 's3Storage'
        this.version = 1.0
        this.type = 'S3Storage'
        this.icon = 's3.svg'
        this.category = 'Tools' // Important: 'Tools' category for Agentflow
        this.description = 'Store and retrieve files in S3/MinIO for agents'
        this.baseClasses = [this.type, ...getBaseClasses(S3UploadTool)]
        this.credential = {
            label: 'AWS Credentials',
            name: 'credential',
            type: 'credential',
            credentialNames: ['awsApi']
        }
        this.inputs = [
            {
                label: 'AWS Region',
                name: 'region',
                type: 'options',
                options: AWS_REGIONS,
                default: DEFAULT_AWS_REGION,
                description: 'AWS Region'
            },
            {
                label: 'Bucket Name',
                name: 'bucketName',
                type: 'string',
                description: 'S3/MinIO bucket name'
            },
            {
                label: 'Custom Endpoint URL',
                name: 'endpointUrl',
                type: 'string',
                description: 'Custom endpoint URL for MinIO or S3-compatible services (e.g., http://localhost:9000)',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Force Path Style',
                name: 'forcePathStyle',
                type: 'boolean',
                description: 'Use path-style addressing (required for MinIO)',
                default: true,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Operation',
                name: 'operation',
                type: 'options',
                options: [
                    { label: 'Upload', name: Operation.UPLOAD },
                    { label: 'Download', name: Operation.DOWNLOAD },
                    { label: 'Delete', name: Operation.DELETE }
                ],
                default: Operation.UPLOAD,
                description: 'Choose operation to perform'
            }
        ]
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const credentials = await getAWSCredentials(nodeData, options)
        const region = (nodeData.inputs?.region as string) || DEFAULT_AWS_REGION
        const bucketName = nodeData.inputs?.bucketName as string
        const endpointUrl = nodeData.inputs?.endpointUrl as string
        const forcePathStyle = (nodeData.inputs?.forcePathStyle as boolean) ?? true
        const operation = (nodeData.inputs?.operation as string) || Operation.UPLOAD

        if (!bucketName) {
            throw new Error('Bucket name is required')
        }

        // Create S3 client configuration
        const clientConfig: any = {
            region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                ...(credentials.sessionToken && { sessionToken: credentials.sessionToken })
            },
            forcePathStyle: forcePathStyle
        }

        // Add custom endpoint for MinIO
        if (endpointUrl) {
            clientConfig.endpoint = endpointUrl
        }

        const s3Client = new S3Client(clientConfig)

        if (operation === Operation.UPLOAD) {
            return new S3UploadTool(s3Client, bucketName)
        } else if (operation === Operation.DOWNLOAD) {
            return new S3DownloadTool(s3Client, bucketName)
        } else if (operation === Operation.DELETE) {
            return new S3DeleteTool(s3Client, bucketName)
        }

        throw new Error(`Unknown operation: ${operation}`)
    }
}

module.exports = { nodeClass: S3Storage_Tools }
