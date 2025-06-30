import { supabase, PlayerRecord, PerformanceRecord } from '../lib/supabase';
import { PerformanceData, PlayerRecord as AppPlayerRecord } from '../App';

export class DatabaseService {
  // 获取当前用户的所有球员
  async getUserPlayers(userId: string): Promise<AppPlayerRecord[]> {
    try {
      console.log('🔍 获取用户球员数据:', userId);
      
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('数据库查询超时')), 10000); // 10秒超时
      });

      const queryPromise = supabase
        .from('players')
        .select(`
          *,
          performances (*)
        `)
        .eq('user_id', userId)
        .order('last_analyzed', { ascending: false });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error('❌ 获取球员数据失败:', error);
        // 如果是权限错误，返回空数组而不是抛出错误
        if (error.code === 'PGRST116' || error.message.includes('permission')) {
          console.warn('⚠️ 数据库权限问题，返回空数组');
          return [];
        }
        throw new Error(`获取球员数据失败: ${error.message}`);
      }

      console.log('✅ 成功获取球员数据:', data?.length || 0, '名球员');
      
      // 转换数据格式
      return (data || []).map(player => this.convertToAppPlayerRecord(player));
    } catch (error) {
      console.error('❌ 数据库查询错误:', error);
      // 返回空数组而不是抛出错误，避免应用崩溃
      return [];
    }
  }

  // 保存或更新球员记录
  async savePlayerRecord(userId: string, playerData: AppPlayerRecord): Promise<AppPlayerRecord> {
    try {
      console.log('💾 保存球员记录:', playerData.name);
      
      // 验证必要字段
      if (!userId || !playerData.name) {
        throw new Error('用户ID和球员姓名不能为空');
      }

      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('保存操作超时')), 15000); // 15秒超时
      });

      // 检查球员是否已存在
      const searchPromise = supabase
        .from('players')
        .select('*')
        .eq('user_id', userId)
        .eq('name', playerData.name)
        .maybeSingle(); // 使用 maybeSingle 避免多条记录错误

      const { data: existingPlayer, error: searchError } = await Promise.race([searchPromise, timeoutPromise]);

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ 查询现有球员失败:', searchError);
        throw new Error(`查询球员失败: ${searchError.message}`);
      }

      const playerRecord = {
        name: playerData.name,
        total_matches: playerData.totalMatches || 1,
        last_analyzed: playerData.lastAnalyzed || new Date().toISOString(),
        avatar_url: playerData.avatar || null,
        average_performance: playerData.averagePerformance || {},
        improvements: playerData.improvements || [],
        weaknesses: playerData.weaknesses || [],
        updated_at: new Date().toISOString()
      };

      if (existingPlayer) {
        // 更新现有球员
        console.log('🔄 更新现有球员:', existingPlayer.id);
        
        const updatePromise = supabase
          .from('players')
          .update(playerRecord)
          .eq('id', existingPlayer.id)
          .select()
          .single();

        const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

        if (error) {
          console.error('❌ 更新球员失败:', error);
          throw new Error(`更新球员失败: ${error.message}`);
        }
        
        console.log('✅ 球员更新成功');
        return this.convertToAppPlayerRecord(data);
      } else {
        // 创建新球员
        console.log('➕ 创建新球员');
        
        const newPlayerRecord = {
          user_id: userId,
          first_analyzed: playerData.firstAnalyzed || new Date().toISOString(),
          ...playerRecord
        };

        const insertPromise = supabase
          .from('players')
          .insert(newPlayerRecord)
          .select()
          .single();

        const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

        if (error) {
          console.error('❌ 创建球员失败:', error);
          throw new Error(`创建球员失败: ${error.message}`);
        }
        
        console.log('✅ 球员创建成功:', data.id);
        return this.convertToAppPlayerRecord(data);
      }
    } catch (error) {
      console.error('❌ 保存球员记录失败:', error);
      throw error;
    }
  }

  // 保存表现记录
  async savePerformanceRecord(playerId: string, performanceData: PerformanceData): Promise<void> {
    try {
      console.log('💾 保存表现记录:', playerId);
      
      // 验证必要字段
      if (!playerId || !performanceData) {
        throw new Error('球员ID和表现数据不能为空');
      }

      const performanceRecord = {
        player_id: playerId,
        match_id: performanceData.matchId || `match_${Date.now()}`,
        date: performanceData.date || new Date().toISOString(),
        opponent: performanceData.opponent || '对手队伍',
        overall: Math.max(0, Math.min(100, performanceData.overall || 75)),
        speed: Math.max(0, Math.min(100, performanceData.speed || 80)),
        passing: Math.max(0, Math.min(100, performanceData.passing || 78)),
        positioning: Math.max(0, Math.min(100, performanceData.positioning || 82)),
        touches: Math.max(0, performanceData.touches || 120),
        distance: Math.max(0, performanceData.distance || 7.5),
        top_speed: Math.max(0, performanceData.topSpeed || 22.5),
        pass_accuracy: Math.max(0, Math.min(100, performanceData.passAccuracy || 85)),
        dominant_foot_right: Math.max(0, Math.min(100, performanceData.dominantFoot?.right || 65)),
        dominant_foot_left: Math.max(0, Math.min(100, performanceData.dominantFoot?.left || 35))
      };

      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('保存表现记录超时')), 10000);
      });

      const insertPromise = supabase
        .from('performances')
        .insert(performanceRecord);

      const { error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) {
        console.error('❌ 保存表现记录失败:', error);
        throw new Error(`保存表现记录失败: ${error.message}`);
      }
      
      console.log('✅ 表现记录保存成功');
    } catch (error) {
      console.error('❌ 保存表现记录失败:', error);
      throw error;
    }
  }

  // 获取球员的所有表现记录
  async getPlayerPerformances(playerId: string): Promise<PerformanceData[]> {
    try {
      console.log('🔍 获取球员表现记录:', playerId);
      
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('获取表现记录超时')), 8000);
      });

      const queryPromise = supabase
        .from('performances')
        .select('*')
        .eq('player_id', playerId)
        .order('date', { ascending: false });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error('❌ 获取表现记录失败:', error);
        return []; // 返回空数组而不是抛出错误
      }

      console.log('✅ 成功获取表现记录:', data?.length || 0, '条记录');

      return (data || []).map(perf => ({
        matchId: perf.match_id,
        date: perf.date,
        opponent: perf.opponent,
        overall: perf.overall,
        speed: perf.speed,
        passing: perf.passing,
        positioning: perf.positioning,
        touches: perf.touches,
        distance: perf.distance,
        topSpeed: perf.top_speed,
        passAccuracy: perf.pass_accuracy,
        dominantFoot: {
          right: perf.dominant_foot_right,
          left: perf.dominant_foot_left
        }
      }));
    } catch (error) {
      console.error('❌ 获取表现记录失败:', error);
      return []; // 返回空数组而不是抛出错误
    }
  }

  // 删除球员记录
  async deletePlayer(playerId: string): Promise<void> {
    try {
      console.log('🗑️ 删除球员记录:', playerId);
      
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('删除操作超时')), 10000);
      });

      // 先删除相关的表现记录
      const deletePerfPromise = supabase
        .from('performances')
        .delete()
        .eq('player_id', playerId);

      const { error: perfError } = await Promise.race([deletePerfPromise, timeoutPromise]);

      if (perfError) {
        console.warn('⚠️ 删除表现记录时出现警告:', perfError);
      }

      // 再删除球员记录
      const deletePlayerPromise = supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      const { error } = await Promise.race([deletePlayerPromise, timeoutPromise]);

      if (error) {
        console.error('❌ 删除球员失败:', error);
        throw new Error(`删除球员失败: ${error.message}`);
      }
      
      console.log('✅ 球员删除成功');
    } catch (error) {
      console.error('❌ 删除球员失败:', error);
      throw error;
    }
  }

  // 转换数据库记录为应用格式
  private convertToAppPlayerRecord(dbPlayer: any): AppPlayerRecord {
    try {
      const performances = dbPlayer.performances || [];
      
      return {
        id: dbPlayer.id,
        name: dbPlayer.name || '未知球员',
        totalMatches: dbPlayer.total_matches || 0,
        firstAnalyzed: dbPlayer.first_analyzed || new Date().toISOString(),
        lastAnalyzed: dbPlayer.last_analyzed || new Date().toISOString(),
        avatar: dbPlayer.avatar_url || undefined,
        averagePerformance: dbPlayer.average_performance || {
          matchId: 'average',
          date: '',
          overall: 75,
          speed: 80,
          passing: 78,
          positioning: 82,
          touches: 120,
          distance: 7.5,
          topSpeed: 22.5,
          passAccuracy: 85,
          dominantFoot: { right: 65, left: 35 }
        },
        improvements: dbPlayer.improvements || [],
        weaknesses: dbPlayer.weaknesses || [],
        performanceHistory: performances.map((perf: any) => ({
          matchId: perf.match_id || `match_${Date.now()}`,
          date: perf.date || new Date().toISOString(),
          opponent: perf.opponent || '对手队伍',
          overall: perf.overall || 75,
          speed: perf.speed || 80,
          passing: perf.passing || 78,
          positioning: perf.positioning || 82,
          touches: perf.touches || 120,
          distance: perf.distance || 7.5,
          topSpeed: perf.top_speed || 22.5,
          passAccuracy: perf.pass_accuracy || 85,
          dominantFoot: {
            right: perf.dominant_foot_right || 65,
            left: perf.dominant_foot_left || 35
          }
        }))
      };
    } catch (error) {
      console.error('❌ 转换球员记录失败:', error);
      // 返回一个默认的球员记录
      return {
        id: dbPlayer.id || 'unknown',
        name: dbPlayer.name || '未知球员',
        totalMatches: 0,
        firstAnalyzed: new Date().toISOString(),
        lastAnalyzed: new Date().toISOString(),
        averagePerformance: {
          matchId: 'average',
          date: '',
          overall: 75,
          speed: 80,
          passing: 78,
          positioning: 82,
          touches: 120,
          distance: 7.5,
          topSpeed: 22.5,
          passAccuracy: 85,
          dominantFoot: { right: 65, left: 35 }
        },
        improvements: [],
        weaknesses: [],
        performanceHistory: []
      };
    }
  }

  // 简化的数据库连接测试
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 测试数据库连接...');
      
      // 添加超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('连接测试超时')), 5000); // 5秒超时
      });

      const testPromise = supabase
        .from('players')
        .select('id')
        .limit(1)
        .maybeSingle();

      const { error } = await Promise.race([testPromise, timeoutPromise]);

      if (error && error.code !== 'PGRST116') {
        console.error('❌ 数据库连接测试失败:', error);
        return false;
      }
      
      console.log('✅ 数据库连接正常');
      return true;
    } catch (error) {
      console.error('❌ 数据库连接测试异常:', error);
      return false;
    }
  }

  // 新增：快速健康检查，不依赖具体表
  async quickHealthCheck(): Promise<boolean> {
    try {
      console.log('⚡ 快速健康检查...');
      
      // 使用更简单的查询
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ 健康检查失败:', error);
        return false;
      }
      
      console.log('✅ 健康检查通过');
      return true;
    } catch (error) {
      console.error('❌ 健康检查异常:', error);
      return false;
    }
  }
}

export const databaseService = new DatabaseService();