# Blobbi - Virtual Pet on Nostr

A decentralized virtual pet game built on the Nostr protocol. Each Nostr account can have one unique Blobbi pet that lives forever on the decentralized network.

## Features

### Core Gameplay
- **Adopt a Blobbi**: Each Nostr account (npub) can have one unique virtual pet
- **Care System**: Feed, play, clean, and put your Blobbi to sleep
- **Stats Management**: Monitor hunger, happiness, energy, cleanliness, and health
- **Life Stages**: Watch your pet grow from baby → child → teen → adult
- **Hibernation**: Pets don't die but go into hibernation if neglected

### Progression & Rewards
- **Experience System**: Gain XP through interactions
- **Coin Economy**: Earn coins through good care and daily check-ins
- **Daily Check-ins**: Build streaks for bonus rewards
- **Shop System**: Buy food, toys, and medicine (coming soon)
- **Customization**: Change your Blobbi's color and patterns

### Social Features
- **Community Feed**: Discover and view other users' Blobbis
- **Rankings**: See the best-cared-for pets in the network
- **Profile Viewing**: Visit other players' pets via their pubkey

### Technical Features
- **Decentralized Storage**: Pet data stored on Nostr relays using custom event kinds
- **Permanent Ownership**: Your pet is permanently linked to your Nostr pubkey
- **Real-time Updates**: Stats decay over time based on last interaction
- **Cross-relay Compatibility**: Works with any Nostr relay

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

### Deployment
```bash
npm run deploy
```

## Game Mechanics

### Stat Decay Rates (per hour)
- Hunger: -0.5 points
- Happiness: -0.3 points
- Energy: -0.4 points (increases when sleeping)
- Cleanliness: -0.2 points
- Health: -0.1 points (faster if other stats are low)

### Action Effects
- **Feed**: +30 hunger, +5 happiness
- **Play**: +25 happiness, -15 energy, -5 cleanliness
- **Clean**: +40 cleanliness, +10 happiness
- **Sleep**: +50 energy, +5 happiness
- **Medicine**: +30 health, -5 happiness

### Life Stage Progression
- Baby: 0-3 days
- Child: 3-7 days
- Teen: 7-14 days
- Adult: 14+ days

## Nostr Integration

### Custom Event Kinds
- `30078`: Blobbi pet data (replaceable event)
- `30079`: Daily check-in data (replaceable event)

### Event Structure
```json
{
  "kind": 30078,
  "content": "{...blobbi data...}",
  "tags": [
    ["d", "owner_pubkey"],
    ["title", "pet_name"],
    ["summary", "status_description"]
  ]
}
```

## Technology Stack
- **Frontend**: React 18.x with TypeScript
- **Styling**: TailwindCSS 3.x
- **UI Components**: shadcn/ui
- **Build Tool**: Vite
- **Nostr Integration**: Nostrify
- **State Management**: TanStack Query
- **Routing**: React Router

## Future Enhancements
- Pet accessories and outfits
- Mini-games between pets
- Achievement/badge system
- Zaps/Nuts token integration
- Pet breeding mechanics
- Seasonal events
- Push notifications via Nostr DMs