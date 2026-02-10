# Image Generation MCP

Generate images using **Google Gemini/Imagen** (paid) or **Self-Hosted ComfyUI** (free).

## Quick Setup

### Option 1: Paid API (Google)

1. Get API key from [Google AI Studio](https://ai.google.dev/)
2. In Flowise:
    - Add **Image Generation** node
    - Select Provider: **Paid API (Google)**
    - Connect Google AI credential
    - Select actions: `generate_image`

### Option 2: Self-Hosted (ComfyUI)

**Install ComfyUI (Mac M1):**

```bash
# Clone & install
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python3 -m venv venv
source venv/bin/activate
pip install torch torchvision torchaudio -r requirements.txt

# Download FLUX model
cd models/checkpoints/
wget https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux_dev.safetensors

# Start server
cd ~/ComfyUI
source venv/bin/activate
python main.py --listen 0.0.0.0 --port 8188
```

**Expose via Ngrok (optional):**

```bash
brew install ngrok
ngrok http 8188
# Copy HTTPS URL: https://abc123.ngrok-free.app
```

**In Flowise:**

1. Add **Image Generation** node
2. Select Provider: **Self-Hosted (ComfyUI)**
3. Set **ComfyUI Server URL**:
    - Local: `http://localhost:8188`
    - Ngrok: `https://your-url.ngrok-free.app`
4. Select actions: `generate_image`

## Usage

**Prompt example:**

```
A cat sitting on a windowsill, looking at rain,
warm lighting, cozy, photorealistic, 4k
```

**Multiple images:**

-   Action: `generate_multiple_images`
-   Count: `4`

## Custom Workflows

Add your own ComfyUI workflows in `workflows/` folder:

```bash
# In ComfyUI: Settings → Enable Dev Mode → Save (API Format)
cp my_workflow.json packages/components/nodes/tools/MCP/ImageGen/workflows/
cd packages/components
npm run build
```

## Troubleshooting

**Error: "Value not in list: ckpt_name"**
→ Edit `workflows/flux.json`, change `ckpt_name` to match your model name

**Error: "Connection refused"**
→ Check ComfyUI is running: `python main.py --listen 0.0.0.0 --port 8188`

**Timeout (300s)**
→ Image generation takes 30-120s, timeout is 5 minutes
