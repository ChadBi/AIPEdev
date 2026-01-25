
# `app/services/`（业务层）

## `app/services/auth_service.py`

负责“登录这件事”全流程：

* 根据账号查用户（调用 db）
* 校验密码（调用 `core/security.py`）
* 签发 access token（JWT）
* 返回：token + 用户信息

这里还会写：

* `get_current_user()`：给路由依赖注入用（token→user）
* `check_permission(user, required_role)`：简单 RBAC

---

## `app/services/user_service.py`

用户相关业务规则：

* 创建用户时：密码 hash
* 更新用户：不允许随便改 role（或仅 admin 允许）
* 列表分页、按条件过滤（班级/专业/角色）

---

## `app/services/action_service.py`

动作模板的业务规则：

* 动作名唯一
* 标准动作数据的存储方式（JSON 存库 / 文件路径存库）
* 标准数据版本管理

---

## `app/services/score_service.py`

评分结果的业务规则（你们会经常改的地方）：

* `create_score(...)`：保存分数、错误关键点、检测时间
* `query_scores(filters, page)`：历史查询 + 统计
* `compute_score(...)`：如果评分逻辑在后端算，这里调用 `core/scoring/*`

