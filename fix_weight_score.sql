-- 修复 weight_score 字段的精度问题
-- 当前字段是 DECIMAL(3, 2) 只能存储 0.00 到 9.99
-- 需要修改为 DECIMAL(5, 2) 来存储 0.00 到 999.99

USE aipe;

ALTER TABLE posture_issues
MODIFY COLUMN weight_score DECIMAL(5, 2) DEFAULT 10.00;

-- 验证修改
DESCRIBE posture_issues;
