## `app/schemas/`（接口入参出参定义，Pydantic）

### `app/schemas/auth.py`

* `LoginRequest`（账号、密码）
* `TokenResponse`（access_token、token_type、expires_in）
* `MeResponse`（当前用户信息）

### `app/schemas/users.py`

* `UserCreate`
* `UserUpdate`
* `UserOut`

### `app/schemas/actions.py`

* `ActionCreate`
* `ActionUpdate`
* `ActionOut`

### `app/schemas/scores.py`

* `ScoreCreate`（student_id, action_id, score, error_keypoints, detect_time）
* `ScoreOut`
* `ScoreQueryParams`（from/to/action_id/student_id/page/size）

> 规则：**所有 API 的 request/response 都必须有 schema**

---
