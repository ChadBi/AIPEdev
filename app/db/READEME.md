# `app/db/`（只管数据库）

## `app/db/session.py`

数据库连接与会话管理：

* `engine = create_engine(...)`
* `SessionLocal = sessionmaker(...)`
* `get_db()`：FastAPI 依赖（yield session）

> 这里不出现任何“业务 SQL”。

---

## `app/db/models.py`

ORM 表定义（SQLAlchemy）：

* `User`
* `Action`
* `ScoreResult`
* `RefreshToken`

写清楚：

* 字段类型
* 主键/外键
* 索引（`student_id + time` 这种历史查询常用索引）

---




