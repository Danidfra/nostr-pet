# Logic to check cooldown on app first load

## Goal
When the user opens the app (even in an incognito tab), check if there is an active cooldown for a specific action based on the `kind 31124` event. This cooldown should be calculated from the Unix timestamp stored in the tag `last_<action_type>` in the event.

---

## Implementation steps

### 1. Get event kind 31124

- There is already a request fetching the event of type `31124`.
- Upon receiving the event, extract tags of the form `last_<action_type>` that contain Unix timestamps.

### 2. Extract the timestamp from the correct tag

- Assuming the action type is available (e.g. `"login"`, `"post"`, etc).
- Find in the tags array the tag that starts with `last_<action_type>`.
- Example:
  ```js
  const tagName = `last_${actionType}`; // e.g. last_login
  const tag = event.tags.find(t => t[0] === tagName);
  const lastTimestamp = tag ? parseInt(tag[1], 10) : 0;
  ```

### 3. Calculate remaining cooldown

- Assume cooldown is a fixed value in seconds, e.g. `cooldownDuration`.
- Get current timestamp:
  ```js
  const now = Math.floor(Date.now() / 1000);
  ```
- Calculate remaining time:
  ```js
  const remaining = Math.max(0, cooldownDuration - (now - lastTimestamp));
  ```

### 4. Store and use cooldown

- If `remaining > 0`, cooldown is still active.
- Use this info to block actions or show countdown in the app.

---

## JS function example:

```js
function getCooldownRemaining(event, actionType, cooldownDuration) {
  if (!event || !event.tags) return 0;
  const tagName = `last_${actionType}`;
  const tag = event.tags.find(t => t[0] === tagName);
  const lastTimestamp = tag ? parseInt(tag[1], 10) : 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, cooldownDuration - (now - lastTimestamp));
}
```

---

## Considerations

- This logic should run **at app initialization**, right after receiving the `kind 31124` event.
- If no tag or timestamp is found, consider no cooldown active.
- Make sure `cooldownDuration` is set according to your app rules per action type.

---

If you want, I can help you build the full code in React or any other framework you use!
