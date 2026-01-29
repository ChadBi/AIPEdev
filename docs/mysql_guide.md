# MySQL

## 1. 准备数据库

确保你的 MySQL 容器在跑，并且有一个库，例如 aipe。

## 2. 配置 .env

在项目根目录写入：

```text
DATABASE_URL=mysql+pymysql://root:123456@127.0.0.1:3306/aipe?charset=utf8mb4
```

