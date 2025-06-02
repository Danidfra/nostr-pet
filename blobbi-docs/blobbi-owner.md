# 🪐 Nostr Event Kind 31125 — Blobbanaut Profile

## 🧬 Description

This event represents the **Blobbanaut**, i.e., the owner of the Blobbis. It stores information about the owner such as their coins, which Blobbis they own, interaction level, achievements, and other custom attributes.

The information is stored exclusively via **tags** and the event follows the parameterized event standard (`NIP-33`), with the `"d"` tag identifying the owner.

---

| Tag                    | Description                                         | Required | Example                         |
|------------------------|-----------------------------------------------------|----------|---------------------------------|
| `d`                    | Unique ID for the Blobbanaut (for NIP-33 replaceable)| ✅ Yes   | `Blobbanaut-Loovi`             |
| `coins`                | Amount of in-game coins the user owns              | ❌ No    | `1250`                           |
| `has`                  | A Blobbi the user currently owns                   | ❌ No    | `blobbi:blue-bouncer`            |
| `pettingLevel`         | Interaction/care level with Blobbis                | ❌ No    | `12`                             |
| `lifetimeBlobbis`      | Total Blobbis adopted by the user over time        | ❌ No    | `17`                             |
| `favoriteBlobbi`       | The user's favorite Blobbi                         | ❌ No    | `blobbi:ghosty`                  |
| `starterBlobbi`        | The first Blobbi the user received                 | ❌ No    | `blobbi:ghosty`                  |
| `achievements`         | Unlocked achievements                              | ❌ No    | `friend-of-blobbi`               |
| `style`                | Aesthetic style selected by the user               | ❌ No    | `punk`                           |
| `background`           | Background/theme associated with the user          | ❌ No    | `space-station`                  |
| `title`                | Custom title or role of the Blobbanaut             | ❌ No    | `Space Caretaker`                |
| `storage`              | List of all items the user currently owns          | ❌ No    | `apple:10`, `burger:5`, `ball:1` |
---

---

## 📎 Estrutura do Evento (exemplo)

```json
{
  "kind": 31125,
  "pubkey": "d2bed509aebadaa2d213081d446d329e0238791892364a7ea7241de890162ec6",
  "created_at": 1717000000,
  "tags": [
    ["d", "Blobbanaut-Loovi"],
    ["coins", "1250"],
    ["has", "blobbi:blue-bouncer"],
    ["has", "blobbi:lava-ling"],
    ["has", "blobbi:ghosty"],
    ["pettingLevel", "12"],
    ["lifetimeBlobbis", "17"],
    ["favoriteBlobbi", "blobbi-alasca"],
    ["starterBlobbi", "blobbi-ghosty"],
    ["achievements", "first-zap"],
    ["achievements", "friend-of-blobbi"],
    ["style", "punk"],
    ["title", "Space Caretaker"],
    ["storage", "apple:10"],
    ["storage", "burger:5"],
    ["storage", "ball:1"]
  ],
  "content": "",
  "sig": "<nostr signature>"
}
```