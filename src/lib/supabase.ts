import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 使用单例模式确保只创建一个 Supabase 客户端实例
let supabaseInstance: any = null;

function createSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase 环境变量未配置，使用虚拟客户端')
    // 创建一个虚拟客户端以避免应用崩溃
    supabaseInstance = createClient('https://dummy.supabase.co', 'dummy-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  } else {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'football-ai-auth'
      }
    })
  }

  return supabaseInstance;
}

export const supabase = createSupabaseClient()

// 数据库类型定义
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface PlayerRecord {
  id: string
  user_id: string
  name: string
  total_matches: number
  first_analyzed: string
  last_analyzed: string
  avatar_url?: string
  average_performance: any
  improvements: string[]
  weaknesses: string[]
  created_at: string
  updated_at: string
}

export interface PerformanceRecord {
  id: string
  player_id: string
  match_id: string
  date: string
  opponent?: string
  overall: number
  speed: number
  passing: number
  positioning: number
  touches: number
  distance: number
  top_speed: number
  pass_accuracy: number
  dominant_foot_right: number
  dominant_foot_left: number
  created_at: string
}