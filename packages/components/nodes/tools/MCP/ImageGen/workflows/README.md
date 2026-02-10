# ComfyUI Workflow Templates

This directory contains workflow JSON templates for different model types.

## Workflow Files

-   **flux.json** - FLUX Schnell/Dev models (UNetLoader + DualCLIPLoader + VAELoader)
-   **sdxl.json** - Stable Diffusion XL models (CheckpointLoaderSimple or split loaders)
-   **sd15.json** - Stable Diffusion 1.5 models (CheckpointLoaderSimple)
-   **custom.json** - Generic template for custom models

## Model Detection

The MCP server automatically detects model type based on filename patterns:

-   `flux*` → flux.json
-   `sd_xl*` or `sdxl*` → sdxl.json
-   `v1-5*` or `sd-v1-5*` → sd15.json
-   Others → custom.json (or specify manually)

## Adding New Templates

1. Create workflow in ComfyUI UI
2. Export as "Save (API format)"
3. Save to this directory as `{model-type}.json`
4. Use placeholder variables:
    - `{{PROMPT}}` - User prompt
    - `{{NEGATIVE_PROMPT}}` - Negative prompt
    - `{{MODEL}}` - Model filename
    - `{{IMAGE_SIZE}}` - Image dimensions
    - `{{STEPS}}` - Sampling steps
    - `{{GUIDANCE}}` - Guidance scale
    - `{{SEED}}` - Random seed

## Template Structure

Each template must have these node IDs:

-   Positive prompt node (ID: "6" or "positive_prompt")
-   Negative prompt node (ID: "7" or "negative_prompt")
-   SaveImage node (ID: "9" or "save_image")
-   Model loader node (various IDs depending on type)
