# 🎬 How to Add Your Video to MYRA

## Quick Setup Guide

### 1. **Add Your Video File**
- Place your video file in: `src/assets/video/`
- Name it: `style-inspiration.mp4` (or update the path in code)
- Supported formats: `.mp4`, `.mov`, `.avi`

### 2. **Video Requirements**
- **Duration**: 10-30 seconds (perfect for looping)
- **Resolution**: 1080p or 720p
- **File Size**: Under 50MB for best performance
- **Aspect Ratio**: 16:9 or 4:3

### 3. **Current Status**
✅ **Code is ready** - just add your video file
✅ **Auto-play enabled** - starts automatically
✅ **Loop enabled** - plays continuously
✅ **Controls ready** - tap to play/pause

### 4. **If Your Video Has a Different Name**
Update this line in `src/screens/HomeScreen.tsx`:
```typescript
videoSource={require('../assets/video/YOUR_VIDEO_NAME.mp4')}
```

### 5. **Test It**
1. Add your video file
2. Save the code
3. The app will automatically reload
4. Your video should start playing in a loop!

## 🎯 **What You'll See**
- Video starts automatically when you open the app
- Plays in a continuous loop
- Tap to pause/play
- Premium fashion styling
- Smooth animations

## 🚨 **Troubleshooting**
- **Video not playing?** Check the file path and name
- **App crashes?** Make sure video file is in the right folder
- **Poor quality?** Try a smaller file size or lower resolution

**Ready to add your video!** 🚀
