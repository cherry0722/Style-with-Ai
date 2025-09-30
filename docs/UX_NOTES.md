# Myra UX Design Notes

## Design Philosophy

Myra follows a **premium, minimalist design language** that prioritizes clarity, accessibility, and delightful micro-interactions. The app targets Gen Z, college students, and working professionals who value both functionality and aesthetic appeal.

## Visual Design System

### Color Palette
- **Primary**: `#1A1A1A` (Deep charcoal for text and primary actions)
- **Accent**: `#007AFF` (iOS blue for interactive elements)
- **Background**: `#FFFFFF` (Clean white backgrounds)
- **Gray Scale**: 9-step gray scale from `#F9FAFB` to `#111827`
- **Semantic Colors**: Success (`#10B981`), Warning (`#F59E0B`), Error (`#EF4444`)

### Typography
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)
- **Font Sizes**: 12px to 48px with consistent scale
- **Line Heights**: 1.25 (tight), 1.5 (normal), 1.75 (relaxed)

### Spacing System
- **Base Unit**: 4px
- **Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Consistent Margins**: 16px for screen edges, 12px for component spacing

### Border Radius
- **Small**: 6px (buttons, inputs)
- **Medium**: 8px (cards, modals)
- **Large**: 12px (main containers)
- **Extra Large**: 16px (feature cards)
- **Full**: 9999px (pills, badges)

## Micro-Interactions & Motion

### Animation Principles
- **Duration**: 200-400ms for most interactions
- **Easing**: `ease-out` for entrances, `ease-in` for exits
- **Scale**: Subtle scale transforms (0.95-1.05) for button presses
- **Opacity**: Smooth fade transitions for state changes

### Key Animations

#### Splash Screen
- **Logo Scale**: 0 → 1 over 800ms with `ease-out`
- **Logo Opacity**: 0 → 1 over 600ms
- **Text Slide**: 20px translateY → 0 over 600ms
- **Total Duration**: 1.8s maximum

#### Button Interactions
- **Press State**: Scale to 0.95 with 100ms duration
- **Haptic Feedback**: Light impact for most buttons, medium for primary actions
- **Color Transitions**: 200ms ease-in-out for state changes

#### List Animations
- **Item Entrance**: Staggered fade-in with 100ms delays
- **Pull to Refresh**: Native refresh control with custom styling
- **Loading States**: Skeleton screens with shimmer effect

#### Modal Presentations
- **Slide Up**: From bottom with 300ms duration
- **Backdrop**: Fade in with 200ms duration
- **Dismiss**: Reverse animation with 250ms duration

## Accessibility Features

### Visual Accessibility
- **High Contrast**: All text meets WCAG AA contrast ratios (4.5:1 minimum)
- **Dynamic Type**: Supports iOS Dynamic Type and Android font scaling
- **Color Independence**: Information conveyed through color is also available through text/icons

### Interaction Accessibility
- **Touch Targets**: Minimum 44px touch targets for all interactive elements
- **Focus Indicators**: Clear focus states for keyboard navigation
- **VoiceOver/TalkBack**: Comprehensive screen reader support

### Content Accessibility
- **Semantic Labels**: All interactive elements have descriptive accessibility labels
- **Role Descriptions**: Proper accessibility roles (button, link, heading, etc.)
- **Hints**: Contextual hints for complex interactions

## Component Design Patterns

### Cards
- **Elevation**: Subtle shadows (2-4px blur, 10-20% opacity)
- **Padding**: 16px internal padding
- **Border Radius**: 12px for main cards, 8px for smaller elements
- **Hover States**: Slight scale increase (1.02) with shadow enhancement

### Buttons
- **Primary**: Solid background with white text
- **Secondary**: Border with transparent background
- **Tertiary**: Text-only with accent color
- **Size Variants**: Small (32px), Medium (40px), Large (48px) height

### Input Fields
- **Border**: 1px solid with focus state color change
- **Padding**: 12px internal padding
- **Placeholder**: 60% opacity gray text
- **Error States**: Red border with error message below

### Navigation
- **Tab Bar**: 88px height with 8px bottom padding
- **Active State**: Accent color with subtle scale animation
- **Badge**: Red circular badge for unread counts
- **Icons**: 24px size with 2px stroke width

## Responsive Design

### Screen Sizes
- **iPhone SE**: 375x667 (compact)
- **iPhone 12**: 390x844 (standard)
- **iPhone 12 Pro Max**: 428x926 (large)
- **Android**: Various sizes with consistent scaling

### Layout Adaptations
- **Grid Systems**: Flexible grid that adapts to screen width
- **Text Scaling**: Responsive typography that scales with screen size
- **Touch Targets**: Consistent sizing across all devices

## Performance Considerations

### Animation Performance
- **Native Driver**: All animations use native driver for 60fps performance
- **Reduced Motion**: Respects system accessibility settings
- **Memory Management**: Proper cleanup of animation listeners

### Rendering Performance
- **FlatList**: Virtualized lists for large datasets
- **Image Optimization**: Proper image sizing and caching
- **Lazy Loading**: Components loaded only when needed

## User Experience Flows

### Onboarding
1. **Splash Screen**: 1.8s branded animation
2. **Location Permission**: Clear explanation of why location is needed
3. **Weather Setup**: Automatic weather detection with manual override
4. **First Outfit**: Guided first outfit creation

### Daily Usage
1. **Home Screen**: Weather, calendar, quick actions
2. **Outfit Planning**: Context-aware suggestions
3. **Calendar Integration**: Event-based outfit recommendations
4. **Notifications**: Timely reminders and suggestions

### Error Handling
- **Network Errors**: Clear messaging with retry options
- **Permission Denied**: Helpful guidance for enabling permissions
- **Empty States**: Encouraging messages with clear next steps
- **Loading States**: Skeleton screens and progress indicators

## Brand Guidelines

### Logo Usage
- **Primary Logo**: "M" in accent color circle
- **Full Brand**: "MYRA" with tagline "Your Personal Style Assistant"
- **Minimum Size**: 24px for app icons, 48px for splash screen

### Voice & Tone
- **Friendly**: Warm, approachable language
- **Helpful**: Clear, actionable guidance
- **Confident**: Assured recommendations and suggestions
- **Inclusive**: Gender-neutral, body-positive messaging

### Content Guidelines
- **Outfit Tips**: Specific, actionable advice
- **Weather Descriptions**: Clear, understandable language
- **Error Messages**: Helpful, not technical
- **Success Messages**: Celebratory but not overwhelming

## Future Enhancements

### Planned Features
- **Dark Mode**: Complete dark theme implementation
- **Custom Themes**: User-selectable color schemes
- **Advanced Animations**: More sophisticated micro-interactions
- **Gesture Navigation**: Swipe gestures for common actions
- **Voice Commands**: Voice-activated outfit planning

### Accessibility Improvements
- **Switch Control**: Full switch control support
- **Voice Control**: Voice navigation capabilities
- **Magnification**: Built-in zoom functionality
- **High Contrast**: Enhanced high contrast mode

---

*This document is living and will be updated as the design system evolves.*
