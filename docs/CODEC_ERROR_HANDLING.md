# Codec Error Handling - H.265/HEVC Detection

**Date:** January 20, 2026  
**Status:** ✅ Implemented  
**Issue:** Videos encoded with H.265/HEVC fail with MEDIA_ERR_DECODE (code 3)

---

## Problem Summary

Some videos fail to play with the error:
```
VIDEOJS: ERROR: (CODE:3 MEDIA_ERR_DECODE) 
The media playback was aborted due to a corruption problem 
or because the media used features your browser did not support.
```

This is **NOT a player bug** - it's a codec compatibility issue where videos are encoded with H.265/HEVC, which web browsers don't support.

---

## Root Cause

### Browser HEVC Support Matrix

| Browser | H.264 Support | H.265/HEVC Support |
|---------|---------------|-------------------|
| Chrome  | ✅ Full       | ❌ None          |
| Firefox | ✅ Full       | ❌ None          |
| Edge    | ✅ Full       | ❌ None          |
| Safari  | ✅ Full       | ⚠️ Apple only*   |

**\* Safari:** macOS 10.13+ and iOS 11+ only

**93%+ of users cannot play HEVC videos in web browsers.**

---

## Why This Happens

The encoder pipeline currently bypasses re-encoding for low-resolution videos:

```
User uploads: 720p H.265 video (e.g., from iPhone)
Encoder logic: "Already 720p, skip encoding"
Result: Video published with HEVC → fails in 93%+ browsers
```

---

## Implementation Details

### Error Detection

The player now detects `MEDIA_ERR_DECODE (code 3)` errors and displays a user-friendly overlay:

```javascript
player.on('error', function(error) {
  const playerError = player.error();
  
  // Check for MEDIA_ERR_DECODE (code 3) - usually HEVC/codec issue
  if (playerError && playerError.code === 3) {
    console.error('🔴 CODEC ERROR: Video uses incompatible codec (likely H.265/HEVC)');
    showCodecError();
    updatePlayerState('Codec Error - Video Incompatible');
    return;
  }
  // ... other error handling
});
```

### User-Facing Error Message

The error overlay includes:

1. **Clear explanation** - Video uses incompatible codec
2. **Why it happens** - Browser doesn't support HEVC
3. **What to do** - Creator must re-encode to H.264
4. **Technical details** - Error code, required format, current format

---

## Solution for Video Creators

Videos must be **re-encoded to H.264/AVC** format:

```bash
ffmpeg -i input.mp4 -c:v libx264 -preset fast -c:a aac -b:a 128k output.mp4
```

---

## Long-Term Fix Required

### Update Encoder Pipeline

**Current Logic:**
```javascript
if (resolution <= 720p) {
  skip_encoding();
}
```

**Required Logic:**
```javascript
if (resolution <= 720p AND codec == 'h264') {
  skip_encoding();
} else {
  transcode_to_h264();
}
```

### Implementation Steps

1. **Probe video codec** before encoding decision:
   ```bash
   ffprobe -v error -select_streams v:0 \
     -show_entries stream=codec_name \
     -of default=noprint_wrappers=1:nokey=1 input.mp4
   ```

2. **Check codec compatibility:**
   - ✅ Allow: `h264`, `avc1`
   - ❌ Re-encode: `hevc`, `hvc1`, `vp8`, `vp9`, `av1`

3. **Always transcode incompatible codecs to H.264**

---

## Files Modified

- [src/main.js](../src/main.js) - Added codec error detection and `showCodecError()` function
- [src/styles.css](../src/styles.css) - Added `.vjs-codec-error-overlay` styling

---

## Related Documentation

- [CODEC_COMPATIBILITY_ISSUE.md](CODEC_COMPATIBILITY_ISSUE.md) - Original codec issue analysis
- [Browser codec support reference](https://caniuse.com/hevc)

---

## Testing

To test the error overlay, try loading a video known to have HEVC encoding. The player will:

1. Attempt to load the video
2. Receive MEDIA_ERR_DECODE from the browser
3. Detect error code 3
4. Display the codec error overlay with helpful information

---

## Future Improvements

1. **Automatic format detection** - Probe M3U8 playlists for codec info before attempting playback
2. **Early warning system** - Display codec warning before attempting to load incompatible videos
3. **Encoder validation** - Prevent HEVC videos from being published without H.264 fallback
