# 🐣 Blobbi Adoption Record Specification

When a Blobbi is adopted, a new event of kind `14921` must be created with the following structure and default values.

---

## 🏷️ Tags

| Key   | Description                                 | Required | Example           |
|--------|---------------------------------------------|----------|--------------------|
| `d`    | Unique identifier in format `blobbi-{pet_name}` | ✅ Yes   | `blobbi-Fluffy`    |

🛑 **Important**: All tags listed here must be present in the event.  
For fields that are optional or may not have a value yet, use `null`, `none`, or an empty string (`""`) as the value — but never omit the tag.

---

## 📄 Content Fields

| Field                 | Description                                                       | Required | Initial Value / Notes                       |
|----------------------|-------------------------------------------------------------------|----------|---------------------------------------------|
| `stage`              | Current life stage                                                | ✅ Yes   | `"egg"`                                     |
| `breeding_ready`     | Indicates if ready to breed                                       | ✅ Yes   | `false`                                     |
| `generation`         | Generation number                                                 | ✅ Yes   | `1`                                         |
| `hunger`             | Hunger level (0–100)                                              | ✅ Yes   | `100` (does not decrease while egg)         |
| `happiness`          | Happiness level (0–100)                                           | ✅ Yes   | `100`                                       |
| `health`             | Health level (0–100)                                              | ✅ Yes   | `100`                                       |
| `hygiene`            | Hygiene level (0–100)                                             | ✅ Yes   | `100`                                       |
| `energy`             | Energy level (0–100)                                              | ✅ Yes   | `100` (does not decrease while egg)         |
| `experience`         | Experience points (0–100)                                         | ✅ Yes   | `0`                                         |
| `care_streak`        | Days in a row the Blobbi was cared for (0–100)                    | ✅ Yes   | `0`                                         |
| `base_color`         | Primary color of the Blobbi                                       | ✅ Yes   | Randomized                                  |
| `secondary_color`    | Secondary color (if any)                                          | ✅ Yes   | Randomized or `null`/`""`                   |
| `pattern`            | Visual pattern (if any)                                           | ✅ Yes   | Randomized or `null`/`""`                   |
| `special_mark`       | Special symbol or mark (if any)                                   | ✅ Yes   | Randomized or `null`/`""`                   |
| `title`              | Unique or rare title (if any)                                     | ✅ Yes   | Randomized or `null`/`""`                   |
| `size`               | Size classification (e.g., small, medium, large) (if any)         | ✅ Yes   | Randomized or `null`/`""`                   |
| `incubation_time`    | Total incubation time in seconds                                  | ✅ Yes   | `345600` (4 days)                           |
| `incubation_progress`| Incubation progress (0–100)                                       | ✅ Yes   | `0`                                         |
| `egg_temperature`    | Current temperature of the egg (0–100)                            | ✅ Yes   | `100`                                       |
| `egg_status`         | State of the egg (e.g., stable, cracking)                         | ✅ Yes   | `"stable"`                                  |
| `shell_integrity`    | Egg shell durability (0–100)                                      | ✅ Yes   | `100`                                       |

---

## 📝 Notes

- 🔄 **All fields must be present in the event**. Optional values must be declared as `null`, `none`, or `""` if not defined yet — but never omitted.
- Optional attributes like `secondary_color`, `pattern`, `title`, etc., should be randomized during adoption. If not applicable, they must still be included as empty/null.
- While in the `egg` stage:
  - `hunger` and `energy` **must not decrease**.
  - No care actions are required to maintain stats.
- The `d` tag must always follow the pattern `blobbi-{pet_name}`, using the chosen name at adoption.
- This record should be parsed by clients or agents to fully initialize and manage the Blobbi lifecycle.