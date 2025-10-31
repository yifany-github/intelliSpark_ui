# API Contracts: System Prompt Optimization & Character State Management MVP

## Characters

### POST `/api/characters`
- **Purpose**: Create a character and immediately generate a cached opening line.
- **Request Body** (application/json):
  ```json
  {
    "name": "string",
    "description": "string",
    "tags": ["string"],
    "...": "existing fields"
  }
  ```
- **Response 201** (application/json):
  ```json
  {
    "id": 123,
    "name": "string",
    "description": "string",
    "opening_line": "string",
    "created_at": "2025-10-28T05:00:00Z",
    "updated_at": "2025-10-28T05:00:00Z",
    "...": "existing fields"
  }
  ```
- **Notes**:
  - `opening_line` is generated server-side; client never posts this value.
  - On Gemini failure, endpoint returns 503 with retry guidance (no partial save).

### PUT `/api/characters/{id}`
- **Purpose**: Update character metadata and refresh opening line when description changes materially.
- **Request Body**: same shape as POST; client does not send `opening_line`.
- **Response 200**:
  ```json
  {
    "id": 123,
    "opening_line": "string",
    "updated_at": "2025-10-28T06:30:00Z",
    "...": "existing fields"
  }
  ```
- **Notes**:
  - Include header `X-Opening-Line-Regenerated: true|false` to indicate reuse vs refresh (aids UI hinting/logging).

## Chat State

### GET `/api/chats/{id}/state`
- **Purpose**: Retrieve persisted state for QA/admin tooling; primarily used internally.
- **Response 200**:
  ```json
  {
    "chat_id": 456,
    "state": {
      "胸部": "乳头挺立，敏感",
      "下体": "湿润，阴唇微微肿胀",
      "衣服": "上衣已脱，裙子撩到腰间，内裤拉到一边",
      "姿势": "仰卧在床上，双腿张开",
      "情绪": "羞涩中带着渴望",
      "环境": "卧室，灯光昏暗"
    },
    "updated_at": "2025-10-28T07:15:00Z"
  }
  ```

### POST `/api/chats/{id}/state`
- **Purpose**: Allow service-to-service updates (e.g., separate worker extracting state deltas).
- **Request Body**:
  ```json
  {
    "state_update": {
      "衣服": "上衣已脱，裙子撩到腰间，内裤拉到一边",
      "情绪": "羞涩中带着渴望"
    }
  }
  ```
- **Response 200**:
  ```json
  {
    "chat_id": 456,
    "state": { "...merged state..." },
    "updated_at": "2025-10-28T07:16:30Z"
  }
  ```
- **Validation**:
  - Reject keys not in allowed set (`胸部`, `下体`, `衣服`, `姿势`, `情绪`, `环境`) with 400 error.
  - Empty `state_update` returns 400 to avoid no-op writes.

## Chat Messaging (existing – enriched)

### POST `/api/chats/{id}/messages`
- **Additions**:
  - Response metadata includes `state_snapshot` summarizing post-turn values for debugging.
  - When state extraction fails, endpoint returns 207-style payload with `state_error` block to trigger fallback handling.

```json
{
  "message": { "...existing fields..." },
  "ai_response": "string",
  "state_snapshot": {
    "衣服": "保持不变",
    "情绪": "羞涩中带着渴望"
  }
}
```
