# 🧃 Blobbi Items & Stat Change Logic

Este documento descreve como deve ser o comportamento dos itens utilizados em ações (`14919`) e como eles afetam os status do Blobbi ao gerar o evento `31124`.

## ✅ Ajustes na Lógica de Ações

Atualmente, o código define mudanças fixas para cada ação:

```ts
const defaultStatChanges: Record<string, [string, number]> = {
  feed: ['hunger', 30],
  clean: ['hygiene', 40],
  rest: ['energy', 35],
  warm: ['egg_temperature', 5],
  medicine: ['health', 20],
  check: ['happiness', 3],
  sing: ['happiness', 8],
  talk: ['happiness', 6],
};
```

No entanto, isso não é suficiente para ações como **feed**, **clean** e **medicine**, pois os efeitos dependem do item utilizado. Por isso, a lógica deve ser atualizada para:

- **Verificar o item sendo usado na ação** (ex: 🍔 Burger).
- **Aplicar os efeitos específicos daquele item**.
- **Permitir múltiplos `["stat_change", "stat:+value"]` por evento**.
- **Aceitar também `stat:-value`** (ex: energia ou felicidade negativa).

---

## 🍽️ Items & Effects

### 🍎 Food Items

Os itens de comida não afetam a higiene. Aumentam a energia levemente.

| Icon | Name       | Price | Effects                                    |
|------|------------|-------|--------------------------------------------|
| 🍎   | Apple      | 10    | hunger +15, hygiene -2, energy +5         |
| 🍔   | Burger     | 25    | hunger +40, happiness +10, hygiene -8, energy +8 |
| 🎂   | Cake       | 50    | hunger +20, happiness +30, hygiene -10, energy +10 |
| 🍕   | Pizza      | 35    | hunger +35, happiness +15, hygiene -9, energy +10 |
| 🍣   | Sushi      | 45    | hunger +30, health +10, hygiene -6, energy +7 |

---

### 🧸 Toys

Itens de brinquedo aumentam felicidade e reduzem energia. Apenas a **Ball** reduz higiene.

| Icon  | Name            | Price | Effects                            |
|-------|-----------------|-------|------------------------------------|
| ⚽    | Ball            | 30    | happiness +25, energy -10, hygiene -5 |
| 🧸    | Teddy Bear      | 60    | happiness +40, energy -15          |
| 🧱    | Building Blocks | 40    | happiness +30, energy -10          |
| 🧩    | Puzzle          | 50    | happiness +35, energy -15          |

---

### 💊 Medicine

Itens de medicina têm um boost na saúde, mas alguns itens reduzem felicidade ou energia.

| Icon  | Name          | Price | Effects                                 |
|-------|---------------|-------|-----------------------------------------|
| 💊    | Vitamins      | 40    | health +20                              |
| 💉    | Super Medicine| 100   | health +50, energy +20, happiness -10   |
| 🩹    | Bandage       | 20    | health +15                              |
| 🧪    | Health Elixir | 150   | health +80, happiness +20, energy +10   |

---

### 🛁 Hygiene Items

Itens de higiene não afetam outros status.

| Icon  | Name            | Price | Effects                             |
|-------|-----------------|-------|-------------------------------------|
| 🧼    | Soap            | 15    | hygiene +30                         |
| 🧴    | Shampoo         | 25    | hygiene +50, happiness +10          |
| 🛁    | Bubble Bath     | 40    | hygiene +60, happiness +20          |
| 🏖️    | Soft Towel      | 20    | hygiene +25, happiness +5           |

---

## ✅ Implementation Notes

- **Remover o `defaultStatChanges`** para ações dependentes de item e, em vez disso, usar um **lookup** baseado no item selecionado.
- Cada ação que utiliza um item (ex: **feed**, **medicine**, **clean**, **play**) deve ler os efeitos específicos daquele item e gerar múltiplas tags como `["stat_change", "stat:+value"]` ou `["stat_change", "stat:-value"]`.
- **Ações que não dependem de item** (ex: **rest**, **warm**, **check**, **sing**, **talk**) podem continuar usando valores fixos, se aplicável.
- **Não criar novos arquivos**: modificar os arquivos existentes onde o evento **14919** é tratado e onde o evento **31124** é gerado.
- **Garantir que, após o clique no botão da UI** (quer seja Blobbi egg, baby ou adult), o sistema envie o evento **14919** e imediatamente gere/atualize o **31124** com todos os `stat_change` apropriados para aquele item.
- Para cada `stat_change`, adicionar uma tag separada no evento **14919** e refletir os valores atualizados no evento **31124**.

### Exemplo de Tags para o Evento 14919 (quando o usuário dá um Burger):

```json
"tags": [
  ["d", "user123"],
  ["action", "feed"],
  ["item", "Burger"],
  ["stat_change", "hunger:+40"],
  ["stat_change", "happiness:+10"],
  ["stat_change", "energy:+8"]
]
```

O evento correspondente 31124 (Blobbi status) deve incluir algo como:

```json
"tags": [
  ["d", "Blobbi-XYZ"],
  ["hunger", "20"],           // valor recalculado
  ["happiness", "75"],        // valor recalculado
  ["energy", "50"],           // valor recalculado
  ["health", "100"],
  ["hygiene", "90"]
]
```

#### Observação:
Os valores exatos de status (20, 75, 50, etc.) devem ser calculados pela lógica interna da aplicação, levando em conta o estado anterior do Blobbi e os efeitos aplicados pelo item.