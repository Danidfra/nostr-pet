# 🪐 Nostr Event Kind 31125 — Blobbanaut Profile

## 🧬 Descrição

Este evento representa o **Blobbanaut**, ou seja, o dono dos Blobbis. Ele armazena informações sobre o dono, como suas moedas, quais Blobbis possui, nível de interação, conquistas, e outros atributos personalizados.

As informações são armazenadas exclusivamente via **tags** e o evento segue o padrão de eventos parametrizados (`NIP-33`), com a tag `"d"` identificando o dono.

---

| Tag                   | Description                                         | Required | Example                         |
|------------------------|-----------------------------------------------------|----------|---------------------------------|
| `d`                    | Unique ID for the Blobbanaut (for NIP-33 replaceable)| ✅ Yes   | `Blobbanaut-Loovi`             |
| `coins`                | Amount of in-game coins the user owns              | ❌ No    | `1250`                          |
| `has`                  | A Blobbi the user currently owns                   | ❌ No    | `blobbi:blue-bouncer`          |
| `pettingLevel`         | Interaction/care level with Blobbis                | ❌ No    | `12`                            |
| `lifetimeBlobbis`      | Total Blobbis adopted by the user over time        | ❌ No    | `17`                            |
| `favoriteBlobbi`       | The user's favorite Blobbi                         | ❌ No    | `blobbi:ghosty`                |
| `starterBlobbi`        | The first Blobbi the user received                 | ❌ No    | `blobbi:ghosty`                |
| `achievements`         | Unlocked achievements                              | ❌ No    | `friend-of-blobbi`             |
| `style`                | Aesthetic style selected by the user               | ❌ No    | `punk`                          |
| `background`           | Background/theme associated with the user          | ❌ No    | `space-station`                |
| `title`                | Custom title or role of the Blobbanaut             | ❌ No    | `Space Caretaker`              |

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
    ["title", "Space Caretaker"]
  ],
  "content": "",
  "sig": "<assinatura nostr>"
}