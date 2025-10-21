# Image Generation MCP Server

**Đúng chuẩn MCP Protocol** - MCP server for image generation using Google Gemini and Imagen models.

## 🎯 Tính Chất MCP

Node này implement **đúng chuẩn MCP (Model Context Protocol)**:

✅ **MCP Server** riêng biệt ([image-gen-server.ts](image-gen-server.ts))
✅ **STDIO Transport** - giao tiếp qua standard input/output
✅ **tools/list RPC** - liệt kê các tools có sẵn
✅ **tools/call RPC** - thực thi tools
✅ **MCPToolkit wrapper** - tích hợp với Flowise

## 📊 Models Hỗ Trợ

| Model                             | Speed            | Quality         | Cost             | Use Case                       |
| --------------------------------- | ---------------- | --------------- | ---------------- | ------------------------------ |
| **gemini-2.5-flash-image** ⭐     | ⚡⚡⚡ Fast      | ⭐⭐⭐ Good     | 💰 FREE          | Recommended cho most use cases |
| **gemini-2.0-flash-image**        | ⚡⚡⚡ Fast      | ⭐⭐⭐ Good     | 💰 FREE          | Previous version               |
| **imagen-4.0-fast-generate-001**  | ⚡⚡⚡⚡ Fastest | ⭐⭐ Fair       | 💰💰 Paid        | Quick iterations               |
| **imagen-4.0-generate-001**       | ⚡⚡ Medium      | ⭐⭐⭐⭐ High   | 💰💰💰 Paid      | Professional work              |
| **imagen-4.0-ultra-generate-001** | ⚡ Slow          | ⭐⭐⭐⭐⭐ Best | 💰💰💰💰 Premium | Highest quality                |

### Model Details

#### Gemini Models (FREE)

-   **Free Tier**: 1500 requests/month
-   **Speed**: Very fast (~2-5 seconds)
-   **Quality**: Excellent for most use cases
-   **Best for**: General image generation, prototyping

#### Imagen 4.0 Models (PAID)

-   **Fast**: Best for rapid iterations and testing
-   **Generate**: Balanced speed and quality
-   **Ultra**: Maximum quality for production use

## 🚀 Setup

### 1. Get Google AI API Key

```bash
# Visit: https://aistudio.google.com/apikey
# Create API key and copy it
```

### 2. Add Credential in Flowise

1. Go to **Credentials** → Add **Google Generative AI**
2. Paste API key
3. Save

### 3. Build MCP Server

```bash
cd packages/components/nodes/mcp/ImageGen
npm install
npm run build
```

This compiles `image-gen-server.ts` → `dist/image-gen-server.js`

### 4. Use in Flowise

1. In **Agent Canvas V2**, click **Add Nodes**
2. Find **MCP** category
3. Select **Image Generation MCP**
4. Choose credential
5. Select tools:
    - `generate_image` - Single image
    - `generate_multiple_images` - Multiple variations

## 🛠️ Available MCP Tools

### Tool 1: `generate_image`

Generate a single image from a prompt.

**Parameters:**

-   `prompt` (required): Detailed description
-   `model` (optional): Model to use (default: gemini-2.5-flash-image)
-   `negative_prompt` (optional): What to avoid

**Example:**

```json
{
    "prompt": "A serene Japanese garden with cherry blossoms, koi pond, and traditional wooden bridge. Photorealistic, golden hour lighting, 85mm lens, bokeh background.",
    "model": "gemini-2.5-flash-image",
    "negative_prompt": "blurry, low quality, distorted, text"
}
```

### Tool 2: `generate_multiple_images`

Generate multiple variations from one prompt.

**Parameters:**

-   `prompt` (required): Detailed description
-   `count` (optional): Number of images (1-4, default: 2)
-   `model` (optional): Model to use
-   `negative_prompt` (optional): What to avoid

**Example:**

```json
{
    "prompt": "Modern minimalist logo for a tech startup",
    "count": 4,
    "model": "imagen-4.0-generate-001"
}
```

## 📝 Prompt Engineering Tips

### 1. Be Specific

```
❌ Bad: "a cat"
✅ Good: "A fluffy Persian cat sitting on a windowsill, looking outside at the rain. Soft natural lighting, shallow depth of field, cozy atmosphere."
```

### 2. Include Style Keywords

-   **Photography**: photorealistic, DSLR, 85mm lens, bokeh, golden hour
-   **Art**: oil painting, watercolor, digital art, concept art
-   **Design**: minimalist, modern, vintage, retro, futuristic

### 3. Specify Composition

-   Close-up, wide angle, bird's eye view, low angle
-   Rule of thirds, centered, symmetrical
-   Foreground, background elements

### 4. Use Negative Prompts

```
negative_prompt: "blurry, low quality, distorted, oversaturated, text, watermark, ugly, deformed"
```

## 🔧 How MCP Works

```typescript
// 1. Flowise starts MCP server
node image-gen-server.js
  ↓
// 2. Server exposes tools via tools/list
{
  "tools": [
    {"name": "generate_image", ...},
    {"name": "generate_multiple_images", ...}
  ]
}
  ↓
// 3. Agent calls tool via tools/call
{
  "name": "generate_image",
  "arguments": {"prompt": "...", "model": "..."}
}
  ↓
// 4. Server calls Gemini API
const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({model: "..."})
const result = await model.generateContent(prompt)
  ↓
// 5. Returns base64 image data
{
  "content": [{
    "type": "text",
    "text": "{\"image\": {\"data\": \"base64...\", ...}}"
  }]
}
```

## 📦 Output Format

Mỗi tool trả về JSON với:

```typescript
{
  "success": true,
  "model": "gemini-2.5-flash-image",
  "prompt": "...",
  "negativePrompt": "...",
  "image": {
    "mimeType": "image/png",
    "data": "base64_encoded_data...",
    "dataUrl": "data:image/png;base64,...",
    "size": 245678  // bytes
  }
}
```

## 💡 Use Cases

### 1. Content Creation

```
"Professional product photography of a luxury smartwatch on marble surface..."
```

### 2. Concept Art

```
"Futuristic cyberpunk city street at night, neon signs, flying cars, rain..."
```

### 3. Marketing Materials

```
"Modern minimalist poster for a music festival, vibrant colors, geometric shapes..."
```

### 4. Character Design

```
"Fantasy RPG character concept: female elf warrior with silver hair and green eyes..."
```

## 🔒 Security

-   API key stored in environment variable (`GEMINI_API_KEY`)
-   Passed securely via MCPToolkit env config
-   No API key in logs or outputs
-   Server runs as isolated child process

## 📚 Resources

-   [MCP Protocol](https://modelcontextprotocol.io/)
-   [Google AI Studio](https://aistudio.google.com/)
-   [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
-   [Imagen Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY environment variable is required"

-   Check credential is set correctly in Flowise
-   Ensure Google Generative AI credential has valid API key

### Error: "No images were generated"

-   Prompt may be blocked by safety filters
-   Try rephrasing prompt or using negative prompts
-   Check API quota/limits

### Tool not showing in dropdown

-   Run `npm run build` in ImageGen folder
-   Restart Flowise server
-   Check browser console for errors

---

**Built with ❤️ using MCP Protocol**
