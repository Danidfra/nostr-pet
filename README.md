# Blobbi - Virtual Pet Lifecycle on Nostr

A decentralized virtual pet game built on the Nostr protocol implementing **NIP-BB: Blobbi Virtual Pet Lifecycle Events**. Each Nostr account can adopt and care for unique Blobbi pets that progress through distinct life stages with structured interaction tracking and permanent milestone records.

## 🌟 Features

### Core Lifecycle System
- **Three Life Stages**: Egg → Baby → Adult progression with unique care requirements
- **Structured Event System**: Four specialized Nostr event kinds for comprehensive pet management
- **Immutable Records**: Permanent biography and milestone tracking
- **Real-time State**: Addressable events for current pet status
- **Cross-client Compatibility**: Standardized events work across all Nostr applications

### Egg Stage (Days 1-4)
- **Incubation Period**: 4 full days minimum with consistent daily care
- **Care Point System**: Earn up to 10 care points daily through various interactions
- **Temperature Regulation**: Keep warmth above 70% to maintain health
- **Health Monitoring**: Maintain health above 50% to avoid penalties
- **Hatching Requirements**: 40+ care points across 4+ distinct care days

### Baby Stage (Post-Hatch)
- **Post-Hatch Phase**: 10 days of continued care for egg-hatched Blobbis
- **Standard Evolution**: 7 days + 150 care points + 50 interactions for direct adoptions
- **Enhanced Interactions**: Feeding, playing, cleaning, resting, and medical care
- **Social Development**: Emotional bonding and personality trait emergence

### Adult Stage
- **Final Evolution**: Fully developed Blobbi with established traits
- **Breeding Capability**: Cross-breeding with other adult Blobbis
- **Advanced Interactions**: Social features and complex care patterns
- **Legacy Building**: Contribute to genetic lineage and trait inheritance

## 🎮 Game Mechanics

### Care Actions & Effects

#### Egg Stage Actions
- **Warming** (`warming`): +5 health, 2 care points
- **Checking** (`checking`): +3 happiness, 1 care point  
- **Singing** (`singing`): +8 happiness, 2 care points
- **Talking** (`talking`): +6 happiness, 1 care point

#### Baby/Adult Actions
- **Feed** (`feed`): +30 hunger, +5 happiness
- **Play** (`play`): +25 happiness, skill development
- **Clean** (`clean`): +40 hygiene, +10 happiness
- **Rest** (`rest`): +35 energy, growth bonuses
- **Medicine** (`medicine`): +20 health, status recovery

### Stat Degradation (per hour)
- **Hunger**: -5 points
- **Happiness**: -3 points  
- **Hygiene**: -2 points
- **Energy**: -4 points (paused during sleep)
- **Health**: Stable (affected by other stats)

### Evolution Requirements

#### Egg → Baby (Hatching)
- ✅ 4+ days since adoption
- ✅ 40+ total care points
- ✅ 4+ distinct care days
- ✅ Health above 50%
- ✅ Maximum 10 care points per day

#### Baby → Adult
- **Post-hatch path**: 10 days + health maintenance
- **Standard path**: 7 days + 150 care score + 50 interactions + 70% happiness + 80% health

## 🔧 Nostr Event System

### Event Kinds Overview

| Kind | Type | Purpose | Mutability |
|------|------|---------|------------|
| `31124` | Addressable | Current Blobbi state | Replaceable |
| `14919` | Regular | Individual interactions | Immutable |
| `14920` | Regular | Breeding events | Immutable |
| `14921` | Regular | Lifecycle records | Immutable |

### Kind 31124: Current State (Addressable)

Tracks the real-time status of a Blobbi with replaceable updates.

```json
{
  "kind": 31124,
  "tags": [
    ["d", "blobbi-alasca"],
    ["stage", "baby"],
    ["generation", "2"],
    ["hunger", "60"],
    ["happiness", "80"],
    ["health", "85"],
    ["hygiene", "70"],
    ["energy", "65"],
    ["experience", "250"],
    ["care_streak", "4"],
    ["base_color", "#ffccaa"],
    ["personality", "curious"],
    ["trait", "fast_learner"]
  ],
  "content": "Alasca is a baby Blobbi."
}
```

### Kind 14919: Interaction Events (Regular)

Records individual care actions and their effects.

```json
{
  "kind": 14919,
  "tags": [
    ["blobbi_id", "blobbi-alasca"],
    ["action", "feed"],
    ["action_category", "nutrition"],
    ["stat_change", "hunger:+35"],
    ["item_used", "starberries"],
    ["experience_gained", "10"],
    ["care_points", "2"],
    ["blobbi_mood_after", "satisfied"]
  ],
  "content": "Blobbi ate delicious starberries and looks happier than ever!"
}
```

### Kind 14921: Lifecycle Records (Immutable)

Permanent milestones and biographical events.

#### Birth Record
```json
{
  "kind": 14921,
  "tags": [
    ["blobbi_id", "blobbi-alasca"],
    ["record_type", "birth"],
    ["generation", "1"],
    ["origin", "wild"],
    ["birth_location", "enchanted_grove"],
    ["weather_at_birth", "misty_morning"],
    ["shell_color", "#ccccff"],
    ["initial_trait", "warm"],
    ["initial_trait", "quiet"],
    ["rarity", "uncommon"]
  ],
  "content": "A mysterious Blobbi egg has been adopted from the wild!"
}
```

#### Evolution Record
```json
{
  "kind": 14921,
  "tags": [
    ["blobbi_id", "blobbi-alasca"],
    ["record_type", "evolution"],
    ["evolution_stage", "adult"],
    ["evolution_reason", "Care requirements met"],
    ["evolved_from", "blobbi-alasca"]
  ],
  "content": "Alasca has evolved to adult stage! ✨"
}
```

### Kind 14920: Breeding Events (Regular)

Cross-breeding between adult Blobbis.

```json
{
  "kind": 14920,
  "tags": [
    ["parent_a", "blobbi-abc123"],
    ["parent_b", "blobbi-xyz456"],
    ["owner_a", "npub1abcd..."],
    ["owner_b", "npub1xyz..."],
    ["breed_time", "2025-05-30T18:42:00Z"],
    ["success", "true"],
    ["offspring_id", "blobbi-egg789"],
    ["generation", "2"],
    ["location", "crystal_meadow"]
  ],
  "content": "New life is forming ✨"
}
```

## 🏗️ Technical Architecture

### State Management Strategy
1. **Query Latest State**: Fetch most recent Kind 31124 for current status
2. **Process Interactions**: Apply Kind 14919 events since last state update
3. **Validate Evolution**: Check Kind 14921 records for eligibility
4. **Update State**: Publish new Kind 31124 when significant changes occur

### Data Flow
```
User Action → Interaction Event (14919) → State Calculation → State Update (31124)
                     ↓
Evolution Check → Record Event (14921) → State Update (31124)
```

### Query Patterns

#### Current Blobbi State
```javascript
const stateEvents = await nostr.query([{
  kinds: [31124],
  "#d": ["blobbi-{id}"],
  authors: ["{pubkey}"],
  limit: 1
}]);
```

#### Interaction History
```javascript
const interactions = await nostr.query([{
  kinds: [14919],
  "#blobbi_id": ["blobbi-{id}"],
  since: lastUpdate,
  limit: 50
}]);
```

#### Life Timeline
```javascript
const records = await nostr.query([{
  kinds: [14921],
  "#blobbi_id": ["blobbi-{id}"],
  "#record_type": ["birth", "evolution", "memory"]
}]);
```

## 🚀 Getting Started

### Development Setup
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run deploy
```

### Creating Your First Blobbi
```javascript
import { useBlobbiLifecycle } from '@/hooks/useBlobbiLifecycle';

function MyBlobbi() {
  const { performCare, evolve, createMemory } = useBlobbiLifecycle('blobbi-myid');
  
  // Perform care action
  await performCare({
    action: 'feed',
    itemUsed: 'starberries'
  });
  
  // Manual evolution (when eligible)
  await evolve({
    newStage: 'baby',
    evolutionReason: 'Hatching requirements met'
  });
  
  // Create special memory
  await createMemory({
    memoryTitle: 'First Flight',
    achievement: 'learned_to_fly'
  });
}
```

## 🔒 Security & Validation

### Event Integrity
- **Signature Verification**: All events undergo standard Nostr validation
- **Timestamp Bounds**: Events must be within reasonable time windows
- **Stat Validation**: Changes limited to prevent manipulation
- **Evolution Verification**: Requirements checked against interaction history

### Anti-Abuse Measures
- **Rate Limiting**: Minimum intervals between same-type interactions
- **Daily Caps**: Care points limited to prevent stat inflation
- **Breeding Consent**: Mutual agreement required for cross-breeding
- **Cooldown Periods**: Prevent rapid successive breeding attempts

## 🌐 Technology Stack

- **Frontend**: React 18.x with TypeScript
- **Styling**: TailwindCSS 3.x + shadcn/ui components
- **Build Tool**: Vite with optimized chunking
- **Nostr Integration**: Nostrify framework
- **State Management**: TanStack Query for caching
- **Routing**: React Router for navigation
- **Validation**: Comprehensive event validation system

## 🎯 Roadmap

### Phase 1: Core Implementation ✅
- [x] Four event kinds implementation
- [x] Lifecycle stage progression
- [x] Interaction tracking system
- [x] Evolution mechanics
- [x] Timeline integration

### Phase 2: Enhanced Features 🚧
- [ ] Advanced breeding genetics
- [ ] Trait inheritance system
- [ ] Achievement badges
- [ ] Social interaction features
- [ ] Community events

### Phase 3: Ecosystem 🔮
- [ ] Cross-client compatibility testing
- [ ] Mobile application
- [ ] Zaps/Lightning integration
- [ ] NFT trait marketplace
- [ ] Seasonal events system

## 📖 Documentation

- [Blobbi Lifecycle Events Specification](./docs/blobbi-lifecycle-events.md)
- [Event Validation Guide](./src/lib/blobbi-validation.ts)
- [Component Usage Examples](./src/components/blobbi/)
- [Hook Documentation](./src/hooks/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes following the event specification
4. Add comprehensive tests
5. Submit a pull request

## 📄 License

MIT License - Build amazing virtual pet experiences on Nostr!

---

*Blobbi pets live forever on the decentralized web. Adopt yours today and watch them grow through the magic of Nostr!* 🌟