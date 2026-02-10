# Video Generation MCP

Generate videos using **Google Veo 2.0** (up to 10 seconds).

## 🚀 Quick Setup

1. Get API key from [Google AI Studio](https://ai.google.dev/)
2. In Flowise:
    - Add **[PrivOS] Video Generation MCP** node
    - Connect Google AI credential
    - Select model: `Veo 2.0 Generate`
    - Select actions: `generate_video_from_text`

## 📝 Usage

### Text to Video

**Action:** `generate_video_from_text`

**Prompt example:**

```
Drone shot flying over tropical beach at sunset,
gentle waves, palm trees, warm orange sky, cinematic
```

**Parameters:**

-   Duration: `5` seconds (1-10)
-   Aspect Ratio: `16:9` (or `9:16`, `1:1`)

### Image to Video

**Action:** `generate_video_from_image`

**Parameters:**

-   Image URL: `https://example.com/image.jpg`
-   Prompt: `Camera slowly zooms in, keeping everything in focus`
-   Duration: `3` seconds

## 🎬 Prompt Tips

**Good prompt:**

```
Aerial drone shot flying over medieval castle at dawn,
mist rising from moat, golden sunlight on stone walls,
camera slowly ascending, cinematic
```

**Include:**

-   Camera movement (drone shot, pan left, zoom in)
-   Subject (castle, person, ocean)
-   Lighting (dawn, golden hour, soft light)
-   Style (cinematic, documentary)

## 🔧 Troubleshooting

**Error: "Request timed out"**
→ Video takes 60-240s to generate, timeout is 300s (5 min)

**Error: "Invalid API key"**
→ Check API key in credentials, verify Veo 2.0 access

**Low quality output**
→ Use detailed prompts with camera movement + lighting

## 📊 Specs

| Feature         | Details         |
| --------------- | --------------- |
| Max Duration    | 10 seconds      |
| Aspect Ratios   | 16:9, 9:16, 1:1 |
| Generation Time | 60-240 seconds  |
| Quality         | 720p-1080p      |
| Cost            | Pay-per-use     |
