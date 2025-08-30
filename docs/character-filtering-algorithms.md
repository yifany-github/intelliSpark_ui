# Character Filtering Algorithms Documentation

This document provides comprehensive documentation for the character filtering and sorting algorithms implemented in the ProductInsightAI application.

## Overview

The character grid supports 5 intelligent filtering options, each with unique sorting algorithms designed to provide meaningful character discovery experiences without requiring backend analytics data.

## Algorithm Specifications

### 🔥 Popular Filter

**Purpose**: Display characters based on overall popularity and engagement potential.

**Algorithm**:
```typescript
const getPopularityScore = (char: Character) => {
  // 1. Recency Bonus (0-3 points)
  const ageInDays = (Date.now() - new Date(char.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, (30 - ageInDays) * 0.1); // 30-day sliding bonus
  
  // 2. Mock Popularity Score
  const mockPopularity = char.id * 0.01; // Higher ID = newer character advantage
  
  // 3. Character Detail Quality
  const traitBonus = char.traits.length * 0.5; // +0.5 points per trait
  
  // 4. Backstory Quality
  const backstoryBonus = (char.backstory?.length || 0) * 0.001; // +0.001 per character
  
  return mockPopularity + traitBonus + backstoryBonus + recencyBonus;
};
```

**Scoring Factors**:
- **Recency Bonus**: 0-3 points (30-day decay curve)
- **Character ID**: 0.01 × ID (backward compatibility)
- **Trait Count**: 0.5 × number of traits
- **Backstory Length**: 0.001 × character count

**Use Case**: Default sorting that balances new content with quality indicators.

---

### 📈 Trending Filter

**Purpose**: Show characters with recent momentum and dynamic activity patterns.

**Algorithm**:
```typescript
const getTrendingScore = (char: Character) => {
  const now = Date.now();
  const createdTime = new Date(char.createdAt).getTime();
  const ageInHours = (now - createdTime) / (1000 * 60 * 60);
  
  // 1. Recency Multiplier (7-day decay)
  const recencyMultiplier = Math.max(0.1, 1 - (ageInHours / (24 * 7)));
  
  // 2. Content Quality Score
  const qualityScore = (
    (char.traits.length * 2) +                    // Rich traits
    ((char.backstory?.length || 0) / 100) +       // Detailed backstory
    ((char.description?.length || 0) / 50)        // Rich description
  );
  
  // 3. Daily Variation Factor (0.8x - 1.2x)
  const randomFactor = 0.8 + (Math.sin(char.id * 0.1 + Date.now() / 86400000) + 1) * 0.2;
  
  return qualityScore * recencyMultiplier * randomFactor;
};
```

**Key Features**:
- **Time Sensitivity**: Strong preference for content created within 7 days
- **Quality Weighting**: Higher-quality characters maintain trending status longer
- **Dynamic Variation**: Slight daily changes simulate real trending dynamics
- **Decay Function**: Linear decay over 1 week, minimum 10% score retention

**Use Case**: Discover fresh, high-quality characters with recent activity.

---

### 🆕 New Filter

**Purpose**: Simple chronological sorting of recently created characters.

**Algorithm**:
```typescript
// Simple time-based sorting
return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
```

**Features**:
- Pure chronological order (newest first)
- No quality or popularity factors
- Ideal for discovering latest additions

**Use Case**: Browse the most recently added characters regardless of other factors.

---

### 👥 Following Filter

**Purpose**: Simulate personalized recommendations based on user preferences.

**Algorithm**:
```typescript
const getFollowingScore = (char: Character) => {
  // 1. Preferred Trait Matching
  const preferredTraits = ['friendly', 'helpful', 'cute', 'intelligent', 'caring', 'funny'];
  const traitMatches = char.traits.filter(trait => 
    preferredTraits.some(preferred => 
      trait.toLowerCase().includes(preferred.toLowerCase())
    )
  ).length;
  
  // 2. Preference Score
  const preferenceScore = traitMatches * 3; // +3 points per matching trait
  
  // 3. Variety Factor
  const varietyScore = (char.id % 7) * 0.5; // Pseudo-random variety (0-3 points)
  
  return preferenceScore + varietyScore;
};
```

**Preferred Traits**:
- `friendly` - Social and approachable characters
- `helpful` - Supportive and assistive personalities
- `cute` - Endearing and charming characters
- `intelligent` - Smart and knowledgeable personalities
- `caring` - Nurturing and empathetic characters
- `funny` - Humorous and entertaining personalities

**Scoring**:
- **Trait Matches**: 3 points per preferred trait found
- **Variety Bonus**: 0-3 points (prevents monotony)

**Use Case**: Recommend characters likely to appeal to users seeking engaging, positive interactions.

---

### 👑 Editor's Choice Filter

**Purpose**: Showcase highest-quality, most complete character profiles.

**Algorithm**:
```typescript
const getEditorScore = (char: Character) => {
  // 1. Content Quality Thresholds
  const traitQuality = char.traits.length >= 3 ? char.traits.length * 2 : 0;
  const backstoryQuality = (char.backstory?.length || 0) >= 100 ? 
    Math.min((char.backstory?.length || 0) / 50, 20) : 0;
  const descriptionQuality = (char.description?.length || 0) >= 50 ? 
    Math.min((char.description?.length || 0) / 25, 15) : 0;
  
  // 2. Diversity Bonus
  const diversityBonus = new Set(char.traits.map(t => t.toLowerCase())).size * 1.5;
  
  // 3. Completeness Score
  const completenessScore = [
    char.name?.length > 2,           // Valid name
    char.backstory?.length > 50,     // Substantial backstory
    char.traits.length >= 2,         // Sufficient traits
    char.description?.length > 30,   // Descriptive content
    char.gender                      // Gender specification
  ].filter(Boolean).length * 2;
  
  return traitQuality + backstoryQuality + descriptionQuality + diversityBonus + completenessScore;
};
```

**Quality Thresholds**:
- **Minimum Traits**: 3+ for quality scoring
- **Minimum Backstory**: 100+ characters
- **Minimum Description**: 50+ characters

**Scoring Components**:
- **Trait Quality**: 2 points per trait (if ≥3 traits)
- **Backstory Quality**: 0.02 points per character (max 20 points)
- **Description Quality**: 0.04 points per character (max 15 points)
- **Diversity Bonus**: 1.5 points per unique trait
- **Completeness**: 2 points per completed field

**Use Case**: Curated selection of premium, well-crafted characters that exemplify quality standards.

---

## Performance Considerations

### Computational Complexity
- **All Algorithms**: O(n) where n = number of characters
- **Memory Usage**: Minimal additional memory overhead
- **Real-time Calculation**: Suitable for client-side sorting

### Optimization Strategies
1. **Caching**: Consider caching calculated scores for frequently accessed characters
2. **Lazy Evaluation**: Scores calculated only when filter is selected
3. **Incremental Updates**: Recalculate scores only for new/modified characters

## Implementation Notes

### Frontend Integration
- All algorithms implemented in `CharacterGrid.tsx`
- No backend modifications required
- Compatible with existing character data structure

### Extensibility
- Algorithm parameters easily adjustable via constants
- Ready for integration with real analytics data
- Modular design supports additional filtering options

### Data Dependencies
- **Required Fields**: `id`, `createdAt`, `traits`, `name`
- **Optional Fields**: `backstory`, `description`, `gender`
- **Future Fields**: `viewCount`, `likeCount`, `chatCount` (for real analytics)

## Testing and Validation

### Algorithm Testing
- Verify sorting consistency across multiple runs
- Test edge cases (empty fields, extreme values)
- Validate performance with large character sets

### User Experience Testing
- A/B test different algorithm parameters
- Monitor user engagement with filtered results
- Collect feedback on sorting relevance

## Migration Path to Real Analytics

### Phase 1: Data Collection
```sql
-- Add analytics columns
ALTER TABLE characters ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN like_count INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN chat_count INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN trending_score FLOAT DEFAULT 0.0;
```

### Phase 2: Algorithm Enhancement
- Replace mock popularity with real engagement metrics
- Implement server-side trending score calculation
- Add user-specific following system

### Phase 3: Performance Optimization
- Move sorting to backend with pagination
- Implement caching for expensive calculations
- Add real-time trending score updates

## Maintenance and Updates

### Regular Reviews
- Monthly algorithm performance assessment
- User feedback incorporation
- Parameter tuning based on usage patterns

### Version History
- v1.0: Initial mock algorithms implementation
- v1.1: Enhanced trending with daily variation
- v1.2: Improved editor's choice quality thresholds

---

*Last Updated: 2025-01-30*  
*Author: Development Team*  
*Status: Production Ready*