# Video Codec Compatibility Issue - H.265/HEVC

**Date:** January 13, 2026  
**Status:** 🔴 Critical - Affects Video Playback  
**Impact:** Videos encoded with H.265/HEVC codec fail to play in most browsers

---

## Problem Discovery

A video segment (`480p_0.ts`) from our pinned HLS structure cannot play in the Snapie Video Player. FFprobe analysis revealed the segment uses **HEVC (H.265)** codec instead of H.264.

### FFprobe Output
```
codec_name=hevc
codec_long_name=H.265 / HEVC (High Efficiency Video Coding)
width=1280
height=720
```

---

## Root Cause

### Browser Compatibility Matrix

| Browser | H.264/AVC | H.265/HEVC |
|---------|-----------|------------|
| Chrome  | ✅ Full   | ❌ None    |
| Firefox | ✅ Full   | ❌ None    |
| Edge    | ✅ Full   | ❌ None    |
| Safari  | ✅ Full   | ⚠️ Apple devices only* |

**\* Safari HEVC support:** macOS 10.13+, iOS 11+ only

### Why This Matters

- **93%+ of users** are on Chrome/Firefox/Edge
- HEVC offers better compression but **zero browser support** for HLS
- Video.js (our player) correctly follows browser limitations
- **This is not a player bug** - browsers simply don't support HEVC in HLS streams

---

## Current Encoder Problem

### The Bypass Issue

Our encoder currently **bypasses re-encoding for low-resolution videos**, assuming they're already optimized. This causes issues when:

1. User uploads low-res video (e.g., 720p or lower)
2. Video is encoded with HEVC/H.265 (common in modern phones)
3. Encoder sees low resolution → **skips re-encoding**
4. Video published with HEVC codec → **fails to play in browsers**

### Example Scenario
```
User uploads: 720p HEVC video from iPhone
Encoder logic: "Resolution is already 720p, skip encoding"
Result: Video stored as HEVC → unplayable in 93%+ browsers
```

---

## Required Fix

### Encoder Pipeline Update

**Current Logic:**
```
if (resolution <= 720p) {
  skip_encoding();
}
```

**Required Logic:**
```
if (resolution <= 720p AND codec == 'h264') {
  skip_encoding();
} else {
  transcode_to_h264();
}
```

### Implementation Steps

1. **Add codec probe** before encoding decision
   ```bash
   ffprobe -v error -select_streams v:0 -show_entries stream=codec_name \
   -of default=noprint_wrappers=1:nokey=1 input.mp4
   ```

2. **Check codec compatibility**
   - ✅ Allowed: `h264`, `avc1`
   - ❌ Force re-encode: `hevc`, `hvc1`, `vp8`, `vp9`, `av1`

3. **Always transcode to H.264 if non-compatible codec detected**
   ```bash
   ffmpeg -i input.mp4 -c:v libx264 -preset fast \
   -c:a aac -b:a 128k output.mp4
   ```

---

## Validation Checklist

Before skipping encoding, verify:

- [ ] Resolution is acceptable (≤ target resolution)
- [ ] **Codec is H.264/AVC** ← NEW REQUIREMENT
- [ ] Audio is AAC
- [ ] Container is MP4 or TS
- [ ] No unusual encoding parameters

---

## Detection Script (Recommended)

Add to encoder pipeline:

```bash
#!/bin/bash
VIDEO_CODEC=$(ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name \
  -of default=noprint_wrappers=1:nokey=1 "$1")

if [[ "$VIDEO_CODEC" != "h264" ]]; then
  echo "INCOMPATIBLE_CODEC: $VIDEO_CODEC - forcing re-encode"
  exit 1  # Trigger re-encoding
fi
```

---

## Testing

### Videos to Test
1. **HEVC from iPhone** (most common case)
2. **VP9 from YouTube downloads**
3. **AV1 from modern encoders**
4. **Legacy H.264** (should skip encoding)

### Expected Results
- H.264 videos: bypass encoding ✅
- All others: transcode to H.264 ✅

---

## References

- [Browser Codec Support - MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs)
- [HLS Specification - Apple](https://developer.apple.com/documentation/http_live_streaming)
- FFprobe documentation: `man ffprobe`

---

## Contact

For questions about this issue:
- Player team: Snapie Video Player repository
- Encoder team: Video processing pipeline
