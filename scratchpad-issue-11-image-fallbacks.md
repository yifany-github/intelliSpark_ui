# Scratchpad: GitHub Issue #11 - Improve Image Rendering with Proper Fallbacks and Error Handling

**Issue Link:** https://github.com/YongBoYu1/intelliSpark_ui/issues/11

## Problem Analysis

The application currently lacks proper image fallback handling and error states. Users see broken images when images fail to load, leading to poor visual experience.

## Current State

### Files with Image Rendering Issues:
1. **SceneCard.tsx:23-29** - Uses plain `<img>` with no error handling
2. **CharacterListItem.tsx:17-25** - Uses plain `<img>` with no error handling  
3. **CharacterDetails.tsx:39-47** - Uses plain `<img>` with no error handling
4. **ChatBubble.tsx:51-59** - Uses plain `<img>` with no error handling

### Common Issues:
- No `onError` callbacks on `<img>` tags
- No loading states while images load
- Available Radix UI Avatar component is unused
- Fallback is just gradient backgrounds, no proper content
- No accessibility considerations

## Solution Plan

### 1. Create Reusable ImageWithFallback Component

```tsx
// client/src/components/ui/ImageWithFallback.tsx
const ImageWithFallback = ({ 
  src, 
  alt, 
  fallbackText, 
  className,
  size = "default" 
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  return (
    <Avatar className={className}>
      {!hasError && (
        <AvatarImage 
          src={src} 
          alt={alt}
          onError={() => setHasError(true)}
          onLoad={() => setIsLoading(false)}
        />
      )}
      <AvatarFallback>
        {isLoading ? <Spinner /> : fallbackText}
      </AvatarFallback>
    </Avatar>
  );
};
```

### 2. Update Components to Use ImageWithFallback

- **SceneCard**: Replace `<img>` with `<ImageWithFallback>` using scene name initials
- **CharacterListItem**: Replace `<img>` with `<ImageWithFallback>` using character name initials
- **CharacterDetails**: Replace `<img>` with `<ImageWithFallback>` using character name initials
- **ChatBubble**: Replace `<img>` with `<ImageWithFallback>` using character name initials

### 3. Features to Implement

- **Error Handling**: `onError` callback to show fallback
- **Loading States**: Show spinner while loading
- **Accessibility**: Proper alt text and ARIA labels
- **Fallback Content**: Character/scene name initials
- **Responsive Sizing**: Different sizes for different contexts

### 4. Testing Strategy

- Test with valid image URLs
- Test with invalid image URLs (404s)
- Test with slow loading images
- Test accessibility with screen readers
- Test responsive behavior on different screen sizes

## Implementation Steps

1. ✅ Create scratchpad and plan
2. ⏳ Create new branch for the issue
3. ⏳ Create ImageWithFallback component
4. ⏳ Update SceneCard.tsx
5. ⏳ Update CharacterListItem.tsx  
6. ⏳ Update CharacterDetails.tsx
7. ⏳ Update ChatBubble.tsx
8. ⏳ Test changes with puppeteer
9. ⏳ Run full test suite
10. ⏳ Create PR for review

## Notes

- Use Radix UI Avatar components for proper fallback handling
- Implement consistent loading states across all components
- Ensure accessibility with proper alt text
- Keep fallback content meaningful (initials, not generic text)
- Consider performance impact of loading states