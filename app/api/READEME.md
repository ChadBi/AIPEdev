
# `app/api/`（路由层：收请求、校验、返回）

## `app/api/auth.py`

写所有鉴权接口：

* `POST /api/v1/auth/login`
* `POST /api/v1/auth/logout`（可选）
* `GET /api/v1/auth/me`
* `POST /api/v1/auth/refresh`（可选）

**只做：**

* 读取请求体（Pydantic schema）
* 调用 `services/auth_service.py`
* 把结果按统一格式返回

**不要做：**

* 不要自己写 SQL
* 不要在这里做密码校验细节（那是 service 的事）

---

# `app/api/users.py`

用户管理接口（给 admin/teacher 用）

* `GET /users`
* `POST /users`
* `GET /users/{id}`
* `PATCH /users/{id}`
* `DELETE /users/{id}`

调用：`services/user_service.py`（你们也可以先写在 action_service 里，但建议分开）

---

## `app/api/actions.py`

动作模板管理接口（标准动作数据）

* `GET /actions`
* `POST /actions`
* `GET /actions/{id}`
* `PATCH /actions/{id}`
* `DELETE /actions/{id}`（可选）
* `POST /actions/{id}/import`（导入标准）

调用：`services/action_service.py`

---

## `app/api/scores.py`

评分结果接口

* `POST /scores` 保存评分结果
* `GET /scores` 查询历史（按学生/动作/时间筛选、分页）
* `GET /scores/{id}` 单条详情（含错误关键点）

调用：`services/score_service.py`

