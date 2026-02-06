-- ====================================================
-- 迁移脚本：修改 assets 表的唯一约束
-- 从 UNIQUE(market, code) 改为 UNIQUE(user_id, market, code)
-- 目的：允许不同用户添加相同的基金
-- ====================================================

BEGIN;

-- 1. 删除旧的唯一约束
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_market_code_key;

-- 2. 添加新的唯一约束（包含 user_id）
ALTER TABLE assets ADD CONSTRAINT assets_user_market_code_key 
  UNIQUE (user_id, market, code);

COMMIT;

-- 验证约束
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'assets'::regclass 
  AND conname LIKE '%market%code%';

