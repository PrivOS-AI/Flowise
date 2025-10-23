//veoClients.ts
import { GoogleGenAI, GenerateVideosParameters } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import appConfig from '../config.js';
import { log } from '../utils/logger.js';

// Define types for video generation
interface VideoConfig {
aspectRatio?: '16:9' | '9:16';
personGeneration?: 'dont_allow' | 'allow_adult';
numberOfVideos?: 1 | 2;
durationSeconds?: number;
negativePrompt?: string;
}

// Options for video generation
interface VideoGenerationOptions {
autoDownload?: boolean; // Default: true
includeFullData?: boolean; // Default: false
}

// Define types for video generation operation
interface VideoOperation {
done: boolean;
response?: {
generatedVideos?: Array<{
video?: {
uri?: string;
};
}>;
};
}

// Metadata for stored videos
interface StoredVideoMetadata {
id: string;
createdAt: string;
prompt?: string;
config: {
aspectRatio: '16:9' | '9:16';
personGeneration: 'dont_allow' | 'allow_adult';
durationSeconds: number;
};
mimeType: string;
size: number;
filepath: string; // Path to the video file on disk
videoUrl?: string; // URL to the video (when autoDownload is false)
}

/\*\*

-   Client for interacting with Google's Veo2 video generation API
    \*/
    export class VeoClient {
    private client: GoogleGenAI;
    private model: string = 'veo-2.0-generate-001';
    private storageDir: string;

/\*\*

-   Creates a new VeoClient instance
    \*/
    constructor() {
    // Initialize the Google Gen AI client
    this.client = new GoogleGenAI({ apiKey: appConfig.GOOGLE_API_KEY });


    // Set the storage directory
    this.storageDir = appConfig.STORAGE_DIR;

    // Ensure the storage directory exists
    this.ensureStorageDir().catch(err => {
      log.fatal('Failed to create storage directory:', err);
      process.exit(1);
    });

}

/\*\*

-   Ensures the storage directory exists
    \*/
    private async ensureStorageDir(): Promise<void> {
    try {
    await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
    throw new Error(`Failed to create storage directory: ${error}`);
    }
    }

/\*\*

-   Processes an image input which can be base64 data, a file path, or a URL
-
-   @param image The image input (base64 data, file path, or URL)
-   @param mimeType The MIME type of the image (optional, detected for files and URLs)
-   @returns The image bytes and MIME type
    \*/
    private async processImageInput(
    image: string,
    mimeType?: string
    ): Promise<{ imageBytes: string; mimeType: string }> {
    // Check if the image is a URL
    if (image.startsWith('http://') || image.startsWith('https://')) {
    log.debug('Processing image from URL');
    const response = await fetch(image);
    if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Get the MIME type from the response or use a default
        const responseMimeType = response.headers.get('content-type') || mimeType || 'image/jpeg';

        return {
          imageBytes: buffer.toString('base64'),
          mimeType: responseMimeType
        };
    }


    // Check if the image is a file path
    if (image.startsWith('/') || image.includes(':\\') || image.includes(':/')) {
      log.debug('Processing image from file path');
      const buffer = await fs.readFile(image);

      // Determine MIME type from file extension if not provided
      let detectedMimeType = mimeType;
      if (!detectedMimeType) {
        const extension = path.extname(image).toLowerCase();
        switch (extension) {
          case '.png':
            detectedMimeType = 'image/png';
            break;
          case '.jpg':
          case '.jpeg':
            detectedMimeType = 'image/jpeg';
            break;
          case '.gif':
            detectedMimeType = 'image/gif';
            break;
          case '.webp':
            detectedMimeType = 'image/webp';
            break;
          default:
            detectedMimeType = 'image/jpeg'; // Default
        }
      }

      return {
        imageBytes: buffer.toString('base64'),
        mimeType: detectedMimeType
      };
    }

    // Assume it's already base64 data
    return {
      imageBytes: image,
      mimeType: mimeType || 'image/png'
    };

}

/\*\*

-   Generates a video from a text prompt
-
-   @param prompt The text prompt for video generation
-   @param config Optional configuration for video generation
-   @param options Optional generation options
-   @returns Metadata for the generated video and optionally the video data
    \*/
    async generateFromText(
    prompt: string,
    config?: VideoConfig,
    options?: VideoGenerationOptions
    ): Promise<StoredVideoMetadata & { videoData?: string, videoUrl?: string }> {
    try {
    log.info('Generating video from text prompt');
    log.verbose('Text prompt parameters:', JSON.stringify({ prompt, config, options }));
        // Default options
        const autoDownload = options?.autoDownload !== false; // Default to true if not specified
        const includeFullData = options?.includeFullData === true; // Default to false if not specified

        // Create generation config
        const generateConfig: Record<string, any> = {};

        // Add optional parameters if provided
        if (config?.aspectRatio) {
          generateConfig.aspectRatio = config.aspectRatio;
        }

        if (config?.personGeneration) {
          generateConfig.personGeneration = config.personGeneration;
        }

        if (config?.numberOfVideos) {
          generateConfig.numberOfVideos = config.numberOfVideos;
        }

        if (config?.durationSeconds) {
          generateConfig.durationSeconds = config.durationSeconds;
        }

        if (config?.negativePrompt) {
          generateConfig.negativePrompt = config.negativePrompt;
        }

        // Initialize request parameters
        const requestParams = {
          model: this.model,
          prompt: prompt,
          config: generateConfig
        };

        // Call the generateVideos method
        log.debug('Calling generateVideos API');
        let operation = await this.client.models.generateVideos(requestParams);

        // Poll until the operation is complete
        log.debug('Polling operation status');
        while (!operation.done) {
          log.verbose('Operation not complete, waiting...', JSON.stringify(operation));
          // Wait for 5 seconds before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await this.client.operations.getVideosOperation({
            operation: operation
          });
        }

        log.debug('Video generation operation complete');
        log.verbose('Operation result:', JSON.stringify(operation));

        // Check if we have generated videos
        if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
          throw new Error('No videos generated in the response');
        }

        // Process each video
        const videoPromises = operation.response.generatedVideos.map(async (generatedVideo, index) => {
          if (!generatedVideo.video?.uri) {
            log.warn('Generated video missing URI');
            return null;
          }

          // Append API key to the URI - use the imported config module
          const videoUri = `${generatedVideo.video.uri}&key=${appConfig.GOOGLE_API_KEY}`;
          log.debug(`Processing video ${index + 1} from URI`);

          // Generate a unique ID for the video
          const id = index === 0 ? uuidv4() : `${uuidv4()}_${index}`;

          if (autoDownload) {
            // Fetch the video
            const response = await fetch(videoUri);
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
            }

            // Convert the response to a buffer
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Save the video to disk
            return this.saveVideoBuffer(buffer, prompt, config, id);
          } else {
            // Just return metadata with the URL
            const metadata: StoredVideoMetadata = {
              id,
              createdAt: new Date().toISOString(),
              prompt,
              config: {
                aspectRatio: config?.aspectRatio || '16:9',
                personGeneration: config?.personGeneration || 'dont_allow',
                durationSeconds: config?.durationSeconds || 5
              },
              mimeType: 'video/mp4',
              size: 0, // Size unknown without downloading
              filepath: '', // No filepath without downloading
              videoUrl: videoUri // Include the video URL
            };

            // Save the metadata
            await this.saveMetadata(id, metadata);

            return metadata;
          }
        });

        // Wait for all videos to be processed
        const metadataArray = await Promise.all(videoPromises);

        // Filter out any null values (from videos with missing URIs)
        const validMetadata = metadataArray.filter(metadata => metadata !== null);

        if (validMetadata.length === 0) {
          throw new Error('Failed to process any videos');
        }

        // Return the first video's metadata
        const result = validMetadata[0] as StoredVideoMetadata & { videoUrl?: string };

        // If we didn't download but have a URL, include it in the result
        if (!autoDownload && result.videoUrl) {
          return result;
        }

        // If includeFullData is true and we downloaded the video, include the video data
        if (includeFullData && autoDownload && result.filepath) {
          const videoData = await fs.readFile(result.filepath);
          return {
            ...result,
            videoData: videoData.toString('base64')
          };
        }

        return result;
    } catch (error) {
    log.error('Error generating video from text:', error);
    throw error;
    }
    }

/\*\*

-   Generates a video from an image
-
-   @param image The image input (base64 data, file path, or URL)
-   @param prompt Optional text prompt for video generation
-   @param config Optional configuration for video generation
-   @param options Optional generation options
-   @param mimeType The MIME type of the image (optional, detected for files and URLs)
-   @returns Metadata for the generated video and optionally the video data
    \*/
    async generateFromImage(
    image: string,
    prompt?: string,
    config?: VideoConfig,
    options?: VideoGenerationOptions,
    mimeType?: string
    ): Promise<StoredVideoMetadata & { videoData?: string, videoUrl?: string }> {
    try {
    log.info('Generating video from image');
    log.verbose('Image prompt parameters:', JSON.stringify({ prompt, config, options, mimeType }));
        // Default options
        const autoDownload = options?.autoDownload !== false; // Default to true if not specified
        const includeFullData = options?.includeFullData === true; // Default to false if not specified

        // Default prompt
        prompt = prompt || 'Generate a video from this image';

        // Create generation config
        const generateConfig: Record<string, any> = {};

        // Add optional parameters if provided
        if (config?.aspectRatio) {
          generateConfig.aspectRatio = config.aspectRatio;
        }

        // Note: personGeneration is not allowed for image-to-video generation

        if (config?.numberOfVideos) {
          generateConfig.numberOfVideos = config.numberOfVideos;
        }

        if (config?.durationSeconds) {
          generateConfig.durationSeconds = config.durationSeconds;
        }

        if (config?.negativePrompt) {
          generateConfig.negativePrompt = config.negativePrompt;
        }

        // Process the image input
        const { imageBytes, mimeType: detectedMimeType } = await this.processImageInput(image, mimeType);

        // Initialize request parameters with the image
        const requestParams = {
          model: this.model,
          prompt: prompt || 'Generate a video from this image',
          image: {
            imageBytes: imageBytes,
            mimeType: detectedMimeType
          },
          config: generateConfig
        };

        // Call the generateVideos method
        log.debug('Calling generateVideos API with image');
        let operation = await this.client.models.generateVideos(requestParams);

        // Poll until the operation is complete
        log.debug('Polling operation status');
        while (!operation.done) {
          log.verbose('Operation not complete, waiting...', JSON.stringify(operation));
          // Wait for 5 seconds before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await this.client.operations.getVideosOperation({
            operation: operation
          });
        }

        log.debug('Video generation operation complete');
        log.verbose('Operation result:', JSON.stringify(operation));

        // Check if we have generated videos
        if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
          throw new Error('No videos generated in the response');
        }

        // Process each video
        const videoPromises = operation.response.generatedVideos.map(async (generatedVideo, index) => {
          if (!generatedVideo.video?.uri) {
            log.warn('Generated video missing URI');
            return null;
          }

          // Append API key to the URI - use the imported config module
          const videoUri = `${generatedVideo.video.uri}&key=${appConfig.GOOGLE_API_KEY}`;
          log.debug(`Processing video ${index + 1} from URI`);

          // Generate a unique ID for the video
          const id = index === 0 ? uuidv4() : `${uuidv4()}_${index}`;

          if (autoDownload) {
            // Fetch the video
            const response = await fetch(videoUri);
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
            }

            // Convert the response to a buffer
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Save the video to disk
            return this.saveVideoBuffer(buffer, prompt, config, id);
          } else {
            // Just return metadata with the URL
            const metadata: StoredVideoMetadata = {
              id,
              createdAt: new Date().toISOString(),
              prompt,
              config: {
                aspectRatio: config?.aspectRatio || '16:9',
                personGeneration: config?.personGeneration || 'dont_allow',
                durationSeconds: config?.durationSeconds || 5
              },
              mimeType: 'video/mp4',
              size: 0, // Size unknown without downloading
              filepath: '', // No filepath without downloading
              videoUrl: videoUri // Include the video URL
            };

            // Save the metadata
            await this.saveMetadata(id, metadata);

            return metadata;
          }
        });

        // Wait for all videos to be processed
        const metadataArray = await Promise.all(videoPromises);

        // Filter out any null values (from videos with missing URIs)
        const validMetadata = metadataArray.filter(metadata => metadata !== null);

        if (validMetadata.length === 0) {
          throw new Error('Failed to process any videos');
        }

        // Return the first video's metadata
        const result = validMetadata[0] as StoredVideoMetadata & { videoUrl?: string };

        // If we didn't download but have a URL, include it in the result
        if (!autoDownload && result.videoUrl) {
          return result;
        }

        // If includeFullData is true and we downloaded the video, include the video data
        if (includeFullData && autoDownload && result.filepath) {
          const videoData = await fs.readFile(result.filepath);
          return {
            ...result,
            videoData: videoData.toString('base64')
          };
        }

        return result;
    } catch (error) {
    log.error('Error generating video from image:', error);
    throw error;
    }
    }

/\*\*

-   Saves a video buffer to disk
-
-   @param videoBuffer The video buffer to save
-   @param prompt The prompt used for generation
-   @param config The configuration used for generation
-   @param id The ID to use for the video
-   @returns Metadata for the saved video
    \*/
    private async saveVideoBuffer(
    videoBuffer: Buffer,
    prompt?: string,
    config?: VideoConfig,
    id: string = uuidv4()
    ): Promise<StoredVideoMetadata> {
    try {
    log.debug(`Saving video with ID: ${id}`);
        // Determine the file extension based on MIME type
        const mimeType = 'video/mp4'; // Assuming Veo2 returns MP4 videos
        const extension = '.mp4';

        // Create the file path (using absolute path)
        const filePath = path.resolve(this.storageDir, `${id}${extension}`);

        // Save the video to disk
        await fs.writeFile(filePath, videoBuffer);

        // Create and return the metadata
        const metadata: StoredVideoMetadata = {
          id,
          createdAt: new Date().toISOString(),
          prompt,
          config: {
            aspectRatio: config?.aspectRatio || '16:9',
            personGeneration: config?.personGeneration || 'dont_allow',
            durationSeconds: config?.durationSeconds || 5
          },
          mimeType,
          size: videoBuffer.length,
          filepath: filePath
        };

        // Save the metadata
        await this.saveMetadata(id, metadata);

        log.info(`Video saved successfully with ID: ${id}`);
        return metadata;
    } catch (error) {
    log.error(`Error saving video buffer: ${error}`);
    throw error;
    }
    }

/\*\*

-   Saves video metadata to disk
-
-   @param id The video ID
-   @param metadata The video metadata
    \*/
    private async saveMetadata(id: string, metadata: StoredVideoMetadata): Promise<void> {
    const metadataPath = path.resolve(this.storageDir, `${id}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }

/\*\*

-   Gets a video by ID
-
-   @param id The video ID
-   @param options Optional options for getting the video
-   @returns The video data and metadata
    \*/
    async getVideo(
    id: string,
    options?: { includeFullData?: boolean }
    ): Promise<{ data?: Buffer; metadata: StoredVideoMetadata; videoData?: string }> {
    try {
    // Get the metadata
    const metadata = await this.getMetadata(id);
        // Default options
        const includeFullData = options?.includeFullData === true; // Default to false if not specified

        // If includeFullData is false, just return the metadata
        if (!includeFullData) {
          return { metadata };
        }

        // Get the video data - use the filepath from metadata if available
        let filePath: string;
        if (metadata.filepath) {
          filePath = metadata.filepath;
        } else {
          // Fallback to constructing the path
          const extension = metadata.mimeType === 'video/mp4' ? '.mp4' : '.webm';
          filePath = path.resolve(this.storageDir, `${id}${extension}`);

          // Update the metadata with the filepath
          metadata.filepath = filePath;
          await this.saveMetadata(id, metadata);
        }

        const data = await fs.readFile(filePath);

        // If includeFullData is true, include the base64 data
        if (includeFullData) {
          return {
            metadata,
            data,
            videoData: data.toString('base64')
          };
        }

        return { data, metadata };
    } catch (error) {
    log.error(`Error getting video ${id}:`, error);
    throw new Error(`Video not found: ${id}`);
    }
    }

/\*\*

-   Gets video metadata by ID
-
-   @param id The video ID
-   @returns The video metadata
    \*/
    async getMetadata(id: string): Promise<StoredVideoMetadata> {
    try {
    const metadataPath = path.resolve(this.storageDir, `${id}.json`);
    const metadataJson = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(metadataJson) as StoredVideoMetadata;
    } catch (error) {
    log.error(`Error getting metadata for video ${id}:`, error);
    throw new Error(`Video metadata not found: ${id}`);
    }
    }

/\*\*

-   Lists all generated videos
-
-   @returns Array of video metadata
    \*/
    async listVideos(): Promise<StoredVideoMetadata[]> {
    try {
    // Get all files in the storage directory
    const files = await fs.readdir(this.storageDir);
          // Filter for JSON metadata files
          const metadataFiles = files.filter(file => file.endsWith('.json'));

          // Read and parse each metadata file
          const metadataPromises = metadataFiles.map(async file => {
            const filePath = path.resolve(this.storageDir, file);
            const metadataJson = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(metadataJson) as StoredVideoMetadata;
          });

          // Wait for all metadata to be read
          return Promise.all(metadataPromises);
        } catch (error) {
          log.error('Error listing videos:', error);
          return [];
        }
    }
    }

// Export a singleton instance
export const veoClient = new VeoClient();

//genvideo.ts
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { veoClient } from '../services/veoClient.js';
import { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { log } from '../utils/logger.js';
import appConfig from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Initialize the Google Gen AI client for image generation
const ai = new GoogleGenAI({ apiKey: appConfig.GOOGLE_API_KEY });

// Define the storage directory for generated images
const IMAGE_STORAGE_DIR = path.join(appConfig.STORAGE_DIR, 'images');

// Ensure the image storage directory exists
(async () => {
try {
await fs.mkdir(IMAGE_STORAGE_DIR, { recursive: true });
} catch (error) {
log.fatal('Failed to create image storage directory:', error);
process.exit(1);
}
})();

/\*\*

-   Saves a generated image to disk
-
-   @param imageBytes The base64 encoded image data
-   @param prompt The prompt used to generate the image
-   @param mimeType The MIME type of the image
-   @returns The filepath and ID of the saved image
    \*/
    async function saveGeneratedImage(
    imageBytes: string,
    prompt: string,
    mimeType: string = 'image/png'
    ): Promise<{ id: string; filepath: string }> {
    try {
    // Generate a unique ID for the image
    const id = uuidv4();
        // Determine the file extension based on MIME type
        let extension = '.png';
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
          extension = '.jpg';
        } else if (mimeType === 'image/webp') {
          extension = '.webp';
        }

        // Create the file path
        const filepath = path.resolve(IMAGE_STORAGE_DIR, `${id}${extension}`);

        // Convert base64 to buffer and save to disk
        const buffer = Buffer.from(imageBytes, 'base64');
        await fs.writeFile(filepath, buffer);

        // Save metadata
        const metadata = {
          id,
          createdAt: new Date().toISOString(),
          prompt,
          mimeType,
          size: buffer.length,
          filepath
        };

        const metadataPath = path.resolve(IMAGE_STORAGE_DIR, `${id}.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        log.info(`Image saved successfully with ID: ${id}`);
        return { id, filepath };
    } catch (error) {
    log.error('Error saving generated image:', error);
    throw error;
    }
    }

// Define schemas for tool inputs
const AspectRatioSchema = z.enum(['16:9', '9:16']);
const PersonGenerationSchema = z.enum(['dont_allow', 'allow_adult']);

/\*\*

-   Tool for generating a video from a text prompt
-
-   @param args The tool arguments
-   @returns The tool result
    \*/
    export async function generateVideoFromText(args: {
    prompt: string;
    aspectRatio?: '16:9' | '9:16';
    personGeneration?: 'dont_allow' | 'allow_adult';
    numberOfVideos?: 1 | 2;
    durationSeconds?: number;
    enhancePrompt?: boolean | string;
    negativePrompt?: string;
    includeFullData?: boolean | string;
    autoDownload?: boolean | string;
    }): Promise<CallToolResult> {
    try {
    log.info('Generating video from text prompt');
    log.verbose('Text prompt parameters:', JSON.stringify(args));

        // Convert string boolean parameters to actual booleans
        const enhancePrompt = typeof args.enhancePrompt === 'string'
          ? args.enhancePrompt.toLowerCase() === 'true' || args.enhancePrompt === '1'
          : args.enhancePrompt ?? false;

        const includeFullData = typeof args.includeFullData === 'string'
          ? args.includeFullData.toLowerCase() === 'true' || args.includeFullData === '1'
          : args.includeFullData ?? false;

        const autoDownload = typeof args.autoDownload === 'string'
          ? args.autoDownload.toLowerCase() === 'true' || args.autoDownload === '1'
          : args.autoDownload ?? true;

        // Create config object from individual parameters with defaults
        const config = {
          aspectRatio: args.aspectRatio || '16:9',
          personGeneration: args.personGeneration || 'dont_allow',
          numberOfVideos: args.numberOfVideos || 1,
          durationSeconds: args.durationSeconds || 5,
          enhancePrompt: enhancePrompt,
          negativePrompt: args.negativePrompt || ''
        };

        // Options for video generation with defaults
        const options = {
          includeFullData: includeFullData,
          autoDownload: autoDownload
        };

        // Generate the video
        const result = await veoClient.generateFromText(args.prompt, config, options);

        // Prepare response content
        const responseContent: Array<TextContent | ImageContent> = [];

        // If includeFullData is true and we have video data, include it in the response
        if (args.includeFullData && result.videoData) {
          responseContent.push({
            type: 'image', // Use 'image' type for video content since MCP doesn't have a 'video' type
            mimeType: result.mimeType,
            data: result.videoData
          });
        }

        // Add text content with metadata
        responseContent.push({
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Video generated successfully',
            videoId: result.id,
            resourceUri: `videos://${result.id}`,
            filepath: result.filepath,
            videoUrl: result.videoUrl,
            metadata: result
          }, null, 2)
        });

        // Return the result
        return {
          content: responseContent
        };

    } catch (error) {
    log.error('Error generating video from text:', error);

        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error generating video: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };

    }
    }

/\*\*

-   Tool for generating a video from an image
-
-   @param args The tool arguments
-   @returns The tool result
    \*/
    export async function generateVideoFromImage(args: {
    image: string | { type: 'image'; mimeType: string; data: string };
    prompt?: string;
    aspectRatio?: '16:9' | '9:16';
    numberOfVideos?: 1 | 2;
    durationSeconds?: number;
    enhancePrompt?: boolean | string;
    negativePrompt?: string;
    includeFullData?: boolean | string;
    autoDownload?: boolean | string;
    }): Promise<CallToolResult> {
    try {
    log.info('Generating video from image');
    log.verbose('Image parameters:', JSON.stringify(args));

        // Extract image data based on the type
        let imageData: string;
        let mimeType: string | undefined;

        if (typeof args.image === 'string') {
          // It's a URL or file path
          imageData = args.image;
        } else {
          // It's an ImageContent object
          imageData = args.image.data;
          mimeType = args.image.mimeType;
        }

        // Convert string boolean parameters to actual booleans
        const enhancePrompt = typeof args.enhancePrompt === 'string'
          ? args.enhancePrompt.toLowerCase() === 'true' || args.enhancePrompt === '1'
          : args.enhancePrompt ?? false;

        const includeFullData = typeof args.includeFullData === 'string'
          ? args.includeFullData.toLowerCase() === 'true' || args.includeFullData === '1'
          : args.includeFullData ?? false;

        const autoDownload = typeof args.autoDownload === 'string'
          ? args.autoDownload.toLowerCase() === 'true' || args.autoDownload === '1'
          : args.autoDownload ?? true;

        // Create config object from individual parameters with defaults
        const config = {
          aspectRatio: args.aspectRatio || '16:9',
          numberOfVideos: args.numberOfVideos || 1,
          durationSeconds: args.durationSeconds || 5,
          enhancePrompt: enhancePrompt,
          negativePrompt: args.negativePrompt || ''
        };

        // Options for video generation with defaults
        const options = {
          includeFullData: includeFullData,
          autoDownload: autoDownload
        };

        // Generate the video
        const result = await veoClient.generateFromImage(
          imageData,
          args.prompt,
          config,
          options,
          mimeType
        );

        // Prepare response content
        const responseContent: Array<TextContent | ImageContent> = [];

        // If includeFullData is true and we have video data, include it in the response
        if (args.includeFullData && result.videoData) {
          responseContent.push({
            type: 'image', // Use 'image' type for video content since MCP doesn't have a 'video' type
            mimeType: result.mimeType,
            data: result.videoData
          });
        }

        // Add text content with metadata
        responseContent.push({
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Video generated successfully',
            videoId: result.id,
            resourceUri: `videos://${result.id}`,
            filepath: result.filepath,
            videoUrl: result.videoUrl,
            metadata: result
          }, null, 2)
        });

        // Return the result
        return {
          content: responseContent
        };

    } catch (error) {
    log.error('Error generating video from image:', error);

        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error generating video: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };

    }
    }

/\*\*

-   Tool for generating an image from a text prompt
-
-   @param args The tool arguments
-   @returns The tool result with generated image
    \*/
    export async function generateImage(args: {
    prompt: string;
    numberOfImages?: number;
    includeFullData?: boolean | string;
    }): Promise<CallToolResult> {
    try {
    log.info('Generating image from text prompt');
    log.verbose('Image generation parameters:', JSON.stringify(args));
        // Create config object
        const config = {
          numberOfImages: args.numberOfImages || 1
        };

        // Generate the image using Imagen
        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: args.prompt,
          config: config,
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
          throw new Error('No images generated in the response');
        }

        const generatedImage = response.generatedImages[0];

        if (!generatedImage.image?.imageBytes) {
          throw new Error('Generated image missing image bytes');
        }

        // Save the generated image to disk
        const { id, filepath } = await saveGeneratedImage(
          generatedImage.image.imageBytes,
          args.prompt,
          'image/png'
        );

        // Prepare response content
        const responseContent: Array<TextContent | ImageContent> = [];

        // Convert includeFullData to boolean if it's a string
        const includeFullData = typeof args.includeFullData === 'string'
          ? args.includeFullData.toLowerCase() === 'true' || args.includeFullData === '1'
          : args.includeFullData !== false;

        // If includeFullData is true (default) or not specified, include the image data
        if (includeFullData) {
          responseContent.push({
            type: 'image',
            mimeType: 'image/png',
            data: generatedImage.image.imageBytes
          });
        }

        // Add text content with metadata
        responseContent.push({
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Image generated successfully',
            imageId: id,
            resourceUri: `images://${id}`,
            filepath: filepath
          }, null, 2)
        });

        // Return the result
        return {
          content: responseContent
        };
    } catch (error) {
    log.error('Error generating image:', error);
        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error generating image: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
    }
    }

/\*\*

-   Tool for generating a video from a generated image
-
-   @param args The tool arguments
-   @returns The tool result
    \*/
    export async function generateVideoFromGeneratedImage(args: {
    prompt: string;
    videoPrompt?: string;
    // Image generation parameters
    numberOfImages?: number;
    // Video generation parameters
    aspectRatio?: '16:9' | '9:16';
    personGeneration?: 'dont_allow' | 'allow_adult';
    numberOfVideos?: 1 | 2;
    durationSeconds?: number;
    enhancePrompt?: boolean | string;
    negativePrompt?: string;
    includeFullData?: boolean | string;
    autoDownload?: boolean | string;
    }): Promise<CallToolResult> {
    try {
    log.info('Generating video from generated image');
    log.verbose('Image generation parameters:', JSON.stringify(args));
        // Convert string boolean parameters to actual booleans
        const enhancePrompt = typeof args.enhancePrompt === 'string'
          ? args.enhancePrompt.toLowerCase() === 'true' || args.enhancePrompt === '1'
          : args.enhancePrompt ?? false;

        const includeFullData = typeof args.includeFullData === 'string'
          ? args.includeFullData.toLowerCase() === 'true' || args.includeFullData === '1'
          : args.includeFullData ?? false;

        const autoDownload = typeof args.autoDownload === 'string'
          ? args.autoDownload.toLowerCase() === 'true' || args.autoDownload === '1'
          : args.autoDownload ?? true;

        // Create image config with defaults
        const imageConfig = {
          numberOfImages: args.numberOfImages || 1
        };

        // Create video config with defaults
        const videoConfig = {
          aspectRatio: args.aspectRatio || '16:9',
          personGeneration: args.personGeneration || 'dont_allow',
          numberOfVideos: args.numberOfVideos || 1,
          durationSeconds: args.durationSeconds || 5,
          enhancePrompt: enhancePrompt,
          negativePrompt: args.negativePrompt || ''
        };

        // Options for video generation with defaults
        const options = {
          includeFullData: includeFullData,
          autoDownload: autoDownload
        };

        // First generate the image
        const imageResponse = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: args.prompt,
          config: imageConfig,
        });

        if (!imageResponse.generatedImages || imageResponse.generatedImages.length === 0) {
          throw new Error('No images generated in the response');
        }

        const generatedImage = imageResponse.generatedImages[0];

        if (!generatedImage.image?.imageBytes) {
          throw new Error('Generated image missing image bytes');
        }

        // Save the generated image to disk
        const { id: imageId, filepath: imageFilepath } = await saveGeneratedImage(
          generatedImage.image.imageBytes,
          args.prompt,
          'image/png'
        );

        // Use the generated image to create a video
        const videoPrompt = args.videoPrompt || args.prompt;
        const result = await veoClient.generateFromImage(
          generatedImage.image.imageBytes,
          videoPrompt,
          videoConfig,
          options,
          'image/png'
        );

        // Prepare response content
        const responseContent: Array<TextContent | ImageContent> = [];

        // Always include the generated image
        responseContent.push({
          type: 'image',
          mimeType: 'image/png',
          data: generatedImage.image.imageBytes
        });

        // If includeFullData is true and we have video data, include it in the response
        if (args.includeFullData && result.videoData) {
          responseContent.push({
            type: 'image', // Use 'image' type for video content since MCP doesn't have a 'video' type
            mimeType: result.mimeType,
            data: result.videoData
          });
        }

        // Add text content with metadata
        responseContent.push({
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Video generated from image successfully',
            videoId: result.id,
            videoResourceUri: `videos://${result.id}`,
            videoFilepath: result.filepath,
            videoUrl: result.videoUrl,
            imageId: imageId,
            imageResourceUri: `images://${imageId}`,
            imageFilepath: imageFilepath,
            metadata: result
          }, null, 2)
        });

        // Return the result
        return {
          content: responseContent
        };
    } catch (error) {
    log.error('Error generating video from generated image:', error);
        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error generating video from generated image: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
    }
    }

/\*\*

-   Gets image metadata by ID
-
-   @param id The image ID
-   @returns The image metadata
    \*/
    async function getImageMetadata(id: string): Promise<any> {
    try {
    const metadataPath = path.resolve(IMAGE_STORAGE_DIR, `${id}.json`);
    const metadataJson = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(metadataJson);
    } catch (error) {
    log.error(`Error getting metadata for image ${id}:`, error);
    throw new Error(`Image metadata not found: ${id}`);
    }
    }

/\*\*

-   Tool for getting an image by ID
-
-   @param args The tool arguments
-   @returns The tool result
    \*/
    export async function getImage(args: {
    id: string;
    includeFullData?: boolean | string;
    }): Promise<CallToolResult> {
    try {
    log.info(`Getting image with ID: ${args.id}`);
        // Get the image metadata
        const metadata = await getImageMetadata(args.id);

        // Convert includeFullData to boolean if it's a string
        const includeFullData = typeof args.includeFullData === 'string'
          ? args.includeFullData.toLowerCase() === 'true' || args.includeFullData === '1'
          : args.includeFullData !== false;

        // Prepare response content
        const responseContent: Array<TextContent | ImageContent> = [];

        // If includeFullData is true (default) or not specified, include the image data
        if (includeFullData && metadata.filepath) {
          try {
            const imageData = await fs.readFile(metadata.filepath);
            responseContent.push({
              type: 'image',
              mimeType: metadata.mimeType || 'image/png',
              data: imageData.toString('base64')
            });
          } catch (error) {
            log.error(`Error reading image file ${metadata.filepath}:`, error);
            // Continue without the image data
          }
        }

        // Add text content with metadata
        responseContent.push({
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Image retrieved successfully',
            imageId: metadata.id,
            resourceUri: `images://${metadata.id}`,
            filepath: metadata.filepath,
            prompt: metadata.prompt,
            createdAt: metadata.createdAt,
            mimeType: metadata.mimeType,
            size: metadata.size
          }, null, 2)
        });

        // Return the result
        return {
          content: responseContent
        };
    } catch (error) {
    log.error(`Error getting image:`, error);
        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error getting image: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
    }
    }

/\*\*

-   Tool for listing all generated images
-
-   @returns The tool result
    \*/
    export async function listGeneratedImages(): Promise<CallToolResult> {
    try {
    log.info('Listing all generated images');
        // Get all files in the image storage directory
        const files = await fs.readdir(IMAGE_STORAGE_DIR);

        // Filter for JSON metadata files
        const metadataFiles = files.filter(file => file.endsWith('.json'));

        // Read and parse each metadata file
        const imagesPromises = metadataFiles.map(async file => {
          const filePath = path.resolve(IMAGE_STORAGE_DIR, file);
          try {
            const metadataJson = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(metadataJson);
          } catch (error) {
            log.error(`Error reading image metadata file ${filePath}:`, error);
            return null;
          }
        });

        // Wait for all metadata to be read and filter out any null values
        const images = (await Promise.all(imagesPromises)).filter(image => image !== null);

        // Return the result
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: images.length,
                images: images.map(image => ({
                  id: image.id,
                  createdAt: image.createdAt,
                  prompt: image.prompt,
                  resourceUri: `images://${image.id}`,
                  filepath: image.filepath,
                  mimeType: image.mimeType,
                  size: image.size
                }))
              }, null, 2)
            }
          ]
        };
    } catch (error) {
    log.error('Error listing images:', error);
        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error listing images: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
    }
    }

/\*\*

-   Tool for listing all generated videos
-
-   @returns The tool result
    \*/
    export async function listGeneratedVideos(): Promise<CallToolResult> {
    try {
    // Get all videos
    const videos = await veoClient.listVideos();
        // Return the result
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: videos.length,
                videos: videos.map(video => ({
                  id: video.id,
                  createdAt: video.createdAt,
                  prompt: video.prompt,
                  resourceUri: `videos://${video.id}`,
                  filepath: video.filepath,
                  videoUrl: video.videoUrl
                }))
              }, null, 2)
            }
          ]
        };
    } catch (error) {
    log.error('Error listing videos:', error);
        // Return the error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error listing videos: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
    }
    }

//example simple :
import time
from google import genai
from google.genai import types

client = genai.Client()

operation = client.models.generate_videos(
model="veo-2.0-generate-001",
prompt="Panning wide shot of a calico kitten sleeping in the sunshine",
config=types.GenerateVideosConfig(
person_generation="allow_adult",
aspect_ratio="16:9",  
 ),
)

while not operation.done:
time.sleep(20)
operation = client.operations.get(operation)

for n, generated_video in enumerate(operation.response.generated_videos):
client.files.download(file=generated_video.video)
generated_video.video.save(f"video{n}.mp4") # save the video
