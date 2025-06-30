/*
  # 创建用户和球员数据表

  1. 新建表
    - `players` - 存储球员基本信息和平均表现
    - `performances` - 存储每场比赛的详细表现数据

  2. 安全设置
    - 启用所有表的 RLS (Row Level Security)
    - 添加用户只能访问自己数据的策略

  3. 索引优化
    - 为常用查询字段添加索引
*/

-- 创建球员表
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  total_matches integer DEFAULT 0,
  first_analyzed timestamptz DEFAULT now(),
  last_analyzed timestamptz DEFAULT now(),
  avatar_url text,
  average_performance jsonb,
  improvements text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建表现记录表
CREATE TABLE IF NOT EXISTS performances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  match_id text NOT NULL,
  date timestamptz NOT NULL,
  opponent text,
  overall integer NOT NULL,
  speed integer NOT NULL,
  passing integer NOT NULL,
  positioning integer NOT NULL,
  touches integer NOT NULL,
  distance decimal NOT NULL,
  top_speed decimal NOT NULL,
  pass_accuracy integer NOT NULL,
  dominant_foot_right integer NOT NULL,
  dominant_foot_left integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 启用 RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;

-- 球员表的 RLS 策略
CREATE POLICY "用户只能查看自己的球员"
  ON players
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的球员"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的球员"
  ON players
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的球员"
  ON players
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 表现记录表的 RLS 策略
CREATE POLICY "用户只能查看自己球员的表现记录"
  ON performances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.id = performances.player_id 
      AND players.user_id = auth.uid()
    )
  );

CREATE POLICY "用户只能创建自己球员的表现记录"
  ON performances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.id = performances.player_id 
      AND players.user_id = auth.uid()
    )
  );

CREATE POLICY "用户只能更新自己球员的表现记录"
  ON performances
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.id = performances.player_id 
      AND players.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.id = performances.player_id 
      AND players.user_id = auth.uid()
    )
  );

CREATE POLICY "用户只能删除自己球员的表现记录"
  ON performances
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.id = performances.player_id 
      AND players.user_id = auth.uid()
    )
  );

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_last_analyzed ON players(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_performances_player_id ON performances(player_id);
CREATE INDEX IF NOT EXISTS idx_performances_date ON performances(date);

-- 创建更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为球员表添加自动更新时间戳的触发器
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();