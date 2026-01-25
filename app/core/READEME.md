# `app/core/`（工具与基础能力）

## `app/core/config.py`

统一读取配置：

* 从 `.config` 读取 DB_URL、JWT_SECRET、TOKEN_EXPIRE 等
* 给出默认值 + 缺失时报错

---

## `app/core/security.py`

安全相关工具函数（集中管理，别散落各处）：

* `hash_password(plain) -> str`
* `verify_password(plain, hashed) -> bool`
* `create_access_token(payload) -> str`
* `decode_access_token(token) -> payload`

---

