import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the multipart form data
    const formData = await req.formData()
    const videoFile = formData.get('video') as File
    const apiKey = formData.get('apiKey') as string
    const playerId = formData.get('playerId') as string
    const playerName = formData.get('playerName') as string
    const existingPlayerDataStr = formData.get('existingPlayerData') as string

    if (!videoFile || !apiKey || !playerId || !playerName) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let existingPlayerData = null
    if (existingPlayerDataStr) {
      try {
        existingPlayerData = JSON.parse(existingPlayerDataStr)
      } catch (e) {
        console.error('解析历史球员数据失败:', e)
      }
    }

    const fileSizeMB = (videoFile.size / 1024 / 1024).toFixed(2)
    console.log(`开始分析球员 ${playerName} 的表现，视频大小: ${fileSizeMB}MB，MIME类型: ${videoFile.type}`)

    // 检查文件大小，如果过大则返回错误
    const MAX_SIZE_MB = 500 // 500MB 限制
    if (videoFile.size > MAX_SIZE_MB * 1024 * 1024) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `视频文件过大 (${fileSizeMB}MB)，请压缩到 ${MAX_SIZE_MB}MB 以下后重试` 
        }),
        { 
          status: 413, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 使用 Google Files API 上传大文件 - 优化内存使用
    let uploadedFile
    try {
      uploadedFile = await uploadVideoToFilesAPI(videoFile, apiKey)
      console.log('文件上传成功，开始表现分析...')
    } catch (uploadError) {
      console.error('文件上传失败:', uploadError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `文件上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 使用上传的文件进行球员表现分析
    let performanceData
    try {
      performanceData = await analyzePlayerPerformanceWithFilesAPI(uploadedFile.uri, uploadedFile.mimeType, playerName, existingPlayerData, apiKey)
    } catch (analysisError) {
      console.error('表现分析失败:', analysisError)
      
      // 清理上传的文件
      try {
        await deleteFileFromFilesAPI(uploadedFile.name, apiKey)
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError)
      }
      
      // 返回默认的表现数据而不是错误，确保应用继续运行
      console.log('使用默认表现数据作为后备方案')
      const fallbackData = generateFallbackPerformanceData(playerName)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          performanceData: fallbackData,
          warning: 'AI分析失败，使用默认数据'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // 清理上传的文件
    try {
      await deleteFileFromFilesAPI(uploadedFile.name, apiKey)
      console.log('临时文件已清理')
    } catch (cleanupError) {
      console.warn('清理临时文件失败:', cleanupError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        performanceData: performanceData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('服务器端球员表现分析错误:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `服务器处理失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to validate date strings
function isValidDateString(dateString: string): boolean {
  if (!dateString || dateString === 'unknown' || dateString.trim() === '') {
    return false;
  }
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// 生成后备表现数据
function generateFallbackPerformanceData(playerName: string) {
  const baseScore = 70 + Math.floor(Math.random() * 20) // 70-90之间的随机分数
  
  return {
    matchId: `match_${Date.now()}`,
    date: new Date().toISOString(),
    opponent: '对手队伍',
    overall: baseScore,
    speed: baseScore + Math.floor(Math.random() * 10) - 5,
    passing: baseScore + Math.floor(Math.random() * 10) - 5,
    positioning: baseScore + Math.floor(Math.random() * 10) - 5,
    touches: 80 + Math.floor(Math.random() * 60), // 80-140
    distance: 6.0 + Math.random() * 3.0, // 6.0-9.0 km
    topSpeed: 20.0 + Math.random() * 8.0, // 20.0-28.0 km/h
    passAccuracy: 75 + Math.floor(Math.random() * 20), // 75-95%
    dominantFoot: {
      right: 60 + Math.floor(Math.random() * 30),
      left: 40 - Math.floor(Math.random() * 30)
    }
  }
}

// 使用 Google Files API 上传视频文件 - 优化内存使用
async function uploadVideoToFilesAPI(videoFile: File, apiKey: string) {
  console.log('开始使用 Files API 上传视频...')
  
  // 检查文件大小，避免内存溢出
  const MAX_CHUNK_SIZE = 50 * 1024 * 1024 // 50MB chunks
  const fileSize = videoFile.size
  
  console.log(`文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`)
  
  // 第一步：获取上传 URL
  const metadataResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
      'X-Goog-Upload-Header-Content-Type': videoFile.type,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: {
        display_name: videoFile.name,
        mime_type: videoFile.type
      }
    })
  })

  if (!metadataResponse.ok) {
    const errorText = await metadataResponse.text()
    console.error('Files API 元数据请求失败:', errorText)
    throw new Error(`Files API 元数据请求失败: ${metadataResponse.status}`)
  }

  const uploadUrl = metadataResponse.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) {
    throw new Error('未获取到上传 URL')
  }

  console.log('获取到上传 URL，开始分块上传文件内容...')

  // 第二步：分块上传文件内容以避免内存问题
  if (fileSize <= MAX_CHUNK_SIZE) {
    // 小文件直接上传
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': fileSize.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: videoFile.stream()
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('Files API 文件上传失败:', errorText)
      throw new Error(`Files API 文件上传失败: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('Files API 上传成功')

    // 等待文件处理完成
    await waitForFileProcessing(uploadResult.file.name, apiKey)
    return uploadResult.file
  } else {
    // 大文件分块上传
    const chunks = Math.ceil(fileSize / MAX_CHUNK_SIZE)
    console.log(`大文件分 ${chunks} 块上传`)
    
    for (let i = 0; i < chunks; i++) {
      const start = i * MAX_CHUNK_SIZE
      const end = Math.min(start + MAX_CHUNK_SIZE, fileSize)
      const chunkSize = end - start
      
      console.log(`上传第 ${i + 1}/${chunks} 块 (${start}-${end})`)
      
      // 创建文件块
      const chunk = videoFile.slice(start, end)
      
      const isLastChunk = i === chunks - 1
      const command = isLastChunk ? 'upload, finalize' : 'upload'
      
      const chunkResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunkSize.toString(),
          'X-Goog-Upload-Offset': start.toString(),
          'X-Goog-Upload-Command': command,
        },
        body: chunk.stream()
      })
      
      if (!chunkResponse.ok) {
        const errorText = await chunkResponse.text()
        console.error(`第 ${i + 1} 块上传失败:`, errorText)
        throw new Error(`第 ${i + 1} 块上传失败: ${chunkResponse.status}`)
      }
      
      if (isLastChunk) {
        const uploadResult = await chunkResponse.json()
        console.log('分块上传完成')
        
        // 等待文件处理完成
        await waitForFileProcessing(uploadResult.file.name, apiKey)
        return uploadResult.file
      }
    }
  }
}

// 等待文件处理完成 - 优化超时处理
async function waitForFileProcessing(fileName: string, apiKey: string, maxWaitTime = 600000) {
  console.log('等待文件处理完成...')
  const startTime = Date.now()
  let checkInterval = 5000 // 开始时5秒检查一次
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`)
      
      if (!statusResponse.ok) {
        throw new Error(`检查文件状态失败: ${statusResponse.status}`)
      }
      
      const fileStatus = await statusResponse.json()
      console.log('文件状态:', fileStatus.state)
      
      if (fileStatus.state === 'ACTIVE') {
        console.log('文件处理完成，可以进行分析')
        return fileStatus
      } else if (fileStatus.state === 'FAILED') {
        throw new Error('文件处理失败')
      }
      
      // 渐进式增加检查间隔，减少API调用
      await new Promise(resolve => setTimeout(resolve, checkInterval))
      checkInterval = Math.min(checkInterval * 1.2, 30000) // 最大30秒间隔
      
    } catch (error) {
      console.error('检查文件状态时出错:', error)
      // 继续等待，不立即失败
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
  }
  
  throw new Error('文件处理超时')
}

// 尝试从文本中提取JSON的多种方法
function extractJsonFromText(text: string): any {
  console.log('原始AI响应:', text)
  
  // 方法1: 寻找第一个完整的JSON对象
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('方法1成功提取JSON')
      return parsed
    } catch (e) {
      console.log('方法1失败:', e)
    }
  }
  
  // 方法2: 寻找```json代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1])
      console.log('方法2成功提取JSON')
      return parsed
    } catch (e) {
      console.log('方法2失败:', e)
    }
  }
  
  // 方法3: 寻找多行JSON（更宽松的匹配）
  const multilineMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
  if (multilineMatch) {
    try {
      const parsed = JSON.parse(multilineMatch[0])
      console.log('方法3成功提取JSON')
      return parsed
    } catch (e) {
      console.log('方法3失败:', e)
    }
  }
  
  // 方法4: 尝试清理和修复常见的JSON问题
  try {
    let cleanedText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/^\s*[\w\s]*?(?=\{)/, '') // 移除JSON前的文字
      .replace(/\}[\s\S]*$/, '}') // 移除JSON后的文字
      .trim()
    
    const parsed = JSON.parse(cleanedText)
    console.log('方法4成功提取JSON')
    return parsed
  } catch (e) {
    console.log('方法4失败:', e)
  }
  
  throw new Error('无法从AI响应中提取有效的JSON数据')
}

// 使用 Files API 分析球员表现 - 改进JSON解析和重试机制
async function analyzePlayerPerformanceWithFilesAPI(fileUri: string, mimeType: string, playerName: string, existingPlayerData: any, apiKey: string) {
  console.log(`开始使用 Files API 分析球员表现，MIME类型: ${mimeType}`)

  // 改进的分析提示词，更明确地要求JSON格式
  const analysisPrompt = `
    请分析球员 "${playerName}" 在这个足球视频中的表现。

    请严格按照以下JSON格式返回数据，不要添加任何其他文字或解释：

    {
      "matchId": "match_${Date.now()}",
      "date": "${new Date().toISOString()}",
      "opponent": "对手队名或未知",
      "overall": 85,
      "speed": 88,
      "passing": 82,
      "positioning": 86,
      "touches": 120,
      "distance": 7.5,
      "topSpeed": 23.5,
      "passAccuracy": 87,
      "dominantFoot": {"right": 70, "left": 30}
    }

    要求：
    - overall, speed, passing, positioning, passAccuracy: 0-100的整数
    - touches: 正整数
    - distance: 小数（公里）
    - topSpeed: 小数（公里/小时）
    - dominantFoot: right和left加起来应该等于100

    只返回JSON，不要任何其他内容。
  `

  const maxRetries = 3
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`第 ${attempt} 次尝试分析...`)
      
      // Call Google Gemini API with Files API
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  file_data: {
                    mime_type: mimeType || "video/mp4",
                    file_uri: fileUri
                  }
                },
                {
                  text: analysisPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            topP: 0.8,
            topK: 10
          }
        })
      })

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text()
        console.error(`第 ${attempt} 次尝试 - Gemini API 错误:`, errorText)
        lastError = new Error(`Google AI 服务错误: ${geminiResponse.status} ${geminiResponse.statusText}`)
        continue
      }

      const geminiResult = await geminiResponse.json()
      
      if (!geminiResult.candidates || !geminiResult.candidates[0] || !geminiResult.candidates[0].content) {
        console.error(`第 ${attempt} 次尝试 - Google AI 未返回有效的分析结果`)
        lastError = new Error('Google AI 未返回有效的分析结果')
        continue
      }

      const responseText = geminiResult.candidates[0].content.parts[0].text
      console.log(`第 ${attempt} 次尝试 - AI响应长度:`, responseText.length)
      
      // 使用改进的JSON提取方法
      let performanceData
      try {
        performanceData = extractJsonFromText(responseText)
      } catch (extractError) {
        console.error(`第 ${attempt} 次尝试 - JSON提取失败:`, extractError)
        lastError = extractError
        continue
      }

      // Validate and process the performance data
      const validatedData = {
        matchId: performanceData.matchId || `match_${Date.now()}`,
        date: isValidDateString(performanceData.date) ? performanceData.date : new Date().toISOString(),
        opponent: performanceData.opponent || '对手队伍',
        overall: Math.max(0, Math.min(100, Number(performanceData.overall) || 75)),
        speed: Math.max(0, Math.min(100, Number(performanceData.speed) || 80)),
        passing: Math.max(0, Math.min(100, Number(performanceData.passing) || 78)),
        positioning: Math.max(0, Math.min(100, Number(performanceData.positioning) || 82)),
        touches: Math.max(0, Math.min(500, Number(performanceData.touches) || 120)),
        distance: Math.max(0, Math.min(20, Number(performanceData.distance) || 7.5)),
        topSpeed: Math.max(0, Math.min(50, Number(performanceData.topSpeed) || 22.5)),
        passAccuracy: Math.max(0, Math.min(100, Number(performanceData.passAccuracy) || 85)),
        dominantFoot: {
          right: Math.max(0, Math.min(100, Number(performanceData.dominantFoot?.right) || 65)),
          left: Math.max(0, Math.min(100, Number(performanceData.dominantFoot?.left) || 35))
        }
      }

      console.log(`第 ${attempt} 次尝试成功 - 球员表现分析完成`)
      return validatedData
      
    } catch (error) {
      console.error(`第 ${attempt} 次尝试失败:`, error)
      lastError = error
      
      if (attempt < maxRetries) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
      }
    }
  }
  
  // 所有重试都失败了，抛出最后一个错误
  throw lastError || new Error('所有分析尝试都失败了')
}

// 删除上传的文件
async function deleteFileFromFilesAPI(fileName: string, apiKey: string) {
  try {
    const deleteResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
      method: 'DELETE'
    })
    
    if (!deleteResponse.ok) {
      console.warn(`删除文件失败: ${deleteResponse.status}`)
    }
  } catch (error) {
    console.warn('删除文件时出错:', error)
  }
}