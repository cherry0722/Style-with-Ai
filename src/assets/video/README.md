# Style Inspiration Video

## How to Add Your Video

1. **Place your video file** in this directory (`src/assets/video/`)
   - Supported formats: `.mp4`, `.mov`, `.avi`
   - Recommended: `.mp4` for best compatibility
   - Suggested name: `style-inspiration.mp4`

2. **Update HomeScreen.tsx**
   - Comment out the `TestVideoPlayer` component
   - Uncomment the `StyleInspirationVideo` component
   - Update the video source path:
   ```typescript
   <StyleInspirationVideo 
     videoSource={require('../assets/video/your-video-name.mp4')}
   />
   ```

3. **Video Requirements**
   - **Duration**: 10-30 seconds recommended for loop
   - **Resolution**: 1080p or 720p for best quality
   - **Aspect Ratio**: 16:9 or 4:3 works well
   - **File Size**: Keep under 50MB for app performance

4. **Features**
   - ✅ **Auto-play**: Video starts automatically
   - ✅ **Loop**: Video plays continuously
   - ✅ **Controls**: Tap to play/pause
   - ✅ **Responsive**: Adapts to different screen sizes
   - ✅ **Fashion Styling**: Matches app's aesthetic

## Current Status
- Using `TestVideoPlayer` for demonstration
- Ready to switch to real video when provided