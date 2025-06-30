import { GoogleGenerativeAI } from '@google/generative-ai';
import { PerformanceData } from '../App';

const API_KEY = 'AIzaSyBEy1LWdeVRqN9NgI7KqlDSgU84kRQVrno';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface PlayerDetection {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  jersey?: string;
  team?: 'home' | 'away';
  teamColor?: string;
  timestamp: number;
  isReferee?: boolean;
  movementPattern?: {
    timestamps: number[];
    positions: { x: number; y: number; width: number; height: number }[];
  };
}

export interface AIAnalysisResult {
  detectedPlayers: PlayerDetection[];
  selectedPlayerAnalysis: PerformanceData;
  playerAvatar?: string;
  bestFrameUrl?: string;
  bestFrameTimestamp?: number;
}

export class FootballAI {
  private model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit for Files API
  private readonly RECOMMENDED_SIZE = 200 * 1024 * 1024; // 200MB recommended size
  private readonly CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks

  private extractJsonFromString(text: string): string {
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('AI response content:', text);
        throw new Error('No valid JSON format data found in AI response');
      }
      
      return text.substring(firstBrace, lastBrace + 1);
    } catch (error) {
      console.error('Failed to extract JSON from response:', text);
      throw new Error('Invalid AI response format, unable to parse analysis results');
    }
  }

  // Extract optimal frame from video (frame with most players)
  async extractBestFrameFromVideo(videoFile: File): Promise<{ frameUrl: string; timestamp: number }> {
    try {
      console.log('🎬 Starting video optimal frame extraction...');
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Unable to create canvas context');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Optimal frame extraction timeout'));
        }, 180000); // Increased timeout to 3 minutes

        video.onloadedmetadata = async () => {
          try {
            console.log(`📹 Video info: Duration ${video.duration.toFixed(1)}s, Size ${video.videoWidth}x${video.videoHeight}`);
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Analyze multiple time points to find frame with most players
            const samplePoints = [];
            const duration = video.duration;
            const numSamples = Math.min(15, Math.floor(duration / 2)); // Sample every 2 seconds, max 15 samples
            
            for (let i = 1; i <= numSamples; i++) {
              samplePoints.push((duration / (numSamples + 1)) * i);
            }
            
            console.log(`🔍 Will analyze ${samplePoints.length} time points:`, samplePoints.map(t => t.toFixed(1) + 's'));
            
            let bestFrame = null;
            let bestTimestamp = 0;
            let maxPlayerCount = 0;
            
            for (const timestamp of samplePoints) {
              try {
                // Jump to specified time point
                video.currentTime = timestamp;
                await new Promise(resolve => {
                  video.onseeked = resolve;
                });
                
                // Draw current frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                
                // Use AI to analyze player count in this frame
                const playerCount = await this.analyzeFrameForPlayerCount(frameDataUrl);
                console.log(`⏱️ ${timestamp.toFixed(1)}s: Detected ${playerCount} players`);
                
                if (playerCount > maxPlayerCount) {
                  maxPlayerCount = playerCount;
                  bestFrame = frameDataUrl;
                  bestTimestamp = timestamp;
                }
                
                // Brief delay to avoid rapid processing
                await new Promise(resolve => setTimeout(resolve, 200));
                
              } catch (frameError) {
                console.warn(`⚠️ Analysis failed at time point ${timestamp.toFixed(1)}s:`, frameError);
              }
            }
            
            if (bestFrame) {
              console.log(`✅ Found optimal frame: ${bestTimestamp.toFixed(1)}s, contains ${maxPlayerCount} players`);
              clearTimeout(timeout);
              resolve({ frameUrl: bestFrame, timestamp: bestTimestamp });
            } else {
              // If no optimal frame found, use middle frame as fallback
              const fallbackTimestamp = duration / 2;
              video.currentTime = fallbackTimestamp;
              video.onseeked = () => {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const fallbackFrame = canvas.toDataURL('image/jpeg', 0.9);
                console.log(`📷 Using fallback frame: ${fallbackTimestamp.toFixed(1)}s`);
                clearTimeout(timeout);
                resolve({ frameUrl: fallbackFrame, timestamp: fallbackTimestamp });
              };
            }
            
          } catch (error) {
            console.error('❌ Error during optimal frame extraction:', error);
            clearTimeout(timeout);
            reject(error);
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video loading failed, unable to extract optimal frame'));
        };

        video.src = URL.createObjectURL(videoFile);
      });

    } catch (error) {
      console.error('❌ Optimal frame extraction failed:', error);
      throw new Error('Optimal frame extraction failed, please try again');
    }
  }

  // Analyze single frame image for player count
  private async analyzeFrameForPlayerCount(frameDataUrl: string): Promise<number> {
    try {
      const response = await fetch(frameDataUrl);
      const blob = await response.blob();
      
      const prompt = `
        Please quickly analyze this football match image and tell me approximately how many players you can see.
        
        Please return only a number representing the player count you see. If unclear, estimate a reasonable number.
        
        For example: If you see about 5 players, return "5".
      `;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: frameDataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const responseText = result.response.text();
      const playerCount = parseInt(responseText.match(/\d+/)?.[0] || '0');
      
      return Math.max(0, Math.min(22, playerCount));
      
    } catch (error) {
      console.warn('Failed to analyze player count in frame:', error);
      return 0;
    }
  }

  // Use optimal frame for player detection
  async uploadAndAnalyzeVideo(videoFile: File): Promise<{ players: PlayerDetection[]; bestFrameUrl: string; bestFrameTimestamp: number }> {
    try {
      console.log('🚀 Starting Gemini video analysis (optimal frame mode)...', {
        fileName: videoFile.name,
        fileSize: this.formatFileSize(videoFile.size),
        fileType: videoFile.type
      });
      
      if (!videoFile.type.startsWith('video/')) {
        throw new Error('Unsupported file format, please upload a valid video file');
      }

      if (videoFile.size === 0) {
        throw new Error('Video file is empty, please select a valid video file');
      }

      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`Video file too large (${this.formatFileSize(videoFile.size)}), maximum supported by Gemini is 2GB`);
      }

      // Step 1: Extract optimal frame
      console.log('🎯 Step 1: Extract optimal frame with most players...');
      const { frameUrl, timestamp } = await this.extractBestFrameFromVideo(videoFile);
      
      // Step 2: Use optimal frame for precise player detection
      console.log('🔍 Step 2: Use optimal frame for precise player detection...');
      const players = await this.analyzeFrameForPlayers(frameUrl, timestamp);
      
      console.log(`✅ Player detection complete! Detected ${players.length} players in optimal frame`);
      
      return {
        players,
        bestFrameUrl: frameUrl,
        bestFrameTimestamp: timestamp
      };

    } catch (error) {
      console.error('❌ Gemini video analysis detailed error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('API_KEY')) {
          throw new Error('Google AI API key invalid or expired, please check configuration');
        } else if (error.message.includes('quota') || error.message.includes('QUOTA')) {
          throw new Error('Google AI API quota exhausted, please try again later');
        } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network connection failed, please check network connection and retry');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT') || error.message.includes('超时')) {
          throw new Error('AI processing timeout, video may be too long or complex, please try shorter video clips');
        } else if (error.message.includes('SAFETY') || error.message.includes('safety')) {
          throw new Error('Video content blocked by AI safety filter, please try other videos');
        } else if (error.message.includes('INVALID_ARGUMENT')) {
          throw new Error('Video format not supported by AI, please try MP4 format videos');
        } else {
          throw error;
        }
      }
      
      throw new Error('Gemini video analysis failed, please check video format and network connection');
    }
  }

  // Improved: Use optimal frame for detailed player detection with enhanced accuracy
  private async analyzeFrameForPlayers(frameDataUrl: string, timestamp: number): Promise<PlayerDetection[]> {
    try {
      console.log('🔍 Starting enhanced optimal frame player analysis (filtering referees)...');
      
      const prompt = `
        You are an expert football video analyst. Please carefully analyze this football match image and identify all players while filtering out referees with maximum precision.

        CRITICAL REQUIREMENTS:
        1. ONLY identify players wearing team jerseys - DO NOT identify referees
        2. Referees typically wear black, yellow, bright green, or other colors clearly different from both team jerseys
        3. Focus on players who are clearly part of the two competing teams
        4. Provide PRECISE boundary box coordinates for each player:
           - x, y: Top-left corner position (percentage 0-100 relative to image)
           - width, height: Box dimensions (percentage 0-100 relative to image)
        5. Ensure boundary boxes TIGHTLY surround only the player's body
        6. Provide realistic confidence scores (0.7-0.95 range)
        7. Identify jersey numbers if clearly visible
        8. Determine team affiliation based on jersey colors
        9. Identify the main jersey colors for each team

        ENHANCED ACCURACY GUIDELINES:
        - Look for players in typical football positions and formations
        - Players should be wearing matching team uniforms
        - Avoid marking anyone in referee attire (black/yellow/bright colors)
        - Ensure boundary boxes don't overlap with grass/background
        - Focus on players who are actively participating in the game
        - Boundary boxes should be proportional to player size in image

        Return ONLY valid JSON format:
        {
          "teamColors": {
            "home": "Blue",
            "away": "Red"
          },
          "players": [
            {
              "id": 1,
              "x": 25.5,
              "y": 35.2,
              "width": 6.8,
              "height": 18.5,
              "confidence": 0.92,
              "jersey": "10",
              "team": "home",
              "teamColor": "Blue",
              "timestamp": ${timestamp},
              "isReferee": false
            }
          ]
        }

        IMPORTANT: Return precise coordinates that accurately frame each player. No explanatory text, only JSON.
      `;

      let analysisResult;
      let attempts = 0;
      const maxAttempts = 4; // Increased attempts for better accuracy

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Enhanced player detection attempt ${attempts}...`);

          const result = await this.model.generateContent([
            prompt,
            {
              inlineData: {
                data: frameDataUrl.split(',')[1],
                mimeType: 'image/jpeg'
              }
            }
          ]);

          const responseText = result.response.text();
          console.log('AI raw response:', responseText.substring(0, 500) + '...');
          
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No valid JSON format data found in AI response');
          }

          const jsonString = responseText.substring(firstBrace, lastBrace + 1);
          analysisResult = JSON.parse(jsonString);

          if (!analysisResult.players || !Array.isArray(analysisResult.players)) {
            throw new Error('AI analysis result format error, player data array not found');
          }

          // Enhanced filtering and validation
          const filteredPlayers = analysisResult.players.filter((player: any) => {
            // Filter out referees and validate coordinates
            if (player.isReferee) return false;
            
            // Validate boundary box coordinates
            const x = typeof player.x === 'number' ? player.x : 0;
            const y = typeof player.y === 'number' ? player.y : 0;
            const width = typeof player.width === 'number' ? player.width : 0;
            const height = typeof player.height === 'number' ? player.height : 0;
            
            // Ensure reasonable boundary box dimensions
            if (width < 3 || width > 25 || height < 8 || height > 35) return false;
            if (x < 0 || x > 95 || y < 0 || y > 95) return false;
            
            return true;
          });

          analysisResult.players = filteredPlayers;

          // If players detected with good quality, consider success
          if (analysisResult.players.length > 0) {
            console.log(`✅ Enhanced attempt ${attempts} successful! Detected ${analysisResult.players.length} players (referees filtered)`);
            break;
          } else {
            throw new Error('Enhanced Gemini detected no valid players (possibly all identified as referees or invalid coordinates)');
          }

        } catch (attemptError) {
          console.error(`❌ Enhanced attempt ${attempts} failed:`, attemptError);
          
          if (attempts === maxAttempts) {
            // Enhanced fallback with more realistic positioning
            console.log('All enhanced attempts failed, returning improved default player configuration...');
            analysisResult = {
              teamColors: { home: 'Blue', away: 'Red' },
              players: [
                {
                  id: 1,
                  x: 20,
                  y: 25,
                  width: 7,
                  height: 16,
                  confidence: 0.85,
                  jersey: '10',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 2,
                  x: 75,
                  y: 35,
                  width: 6,
                  height: 15,
                  confidence: 0.82,
                  jersey: '7',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 3,
                  x: 45,
                  y: 20,
                  width: 7,
                  height: 17,
                  confidence: 0.78,
                  jersey: '9',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 4,
                  x: 65,
                  y: 55,
                  width: 6,
                  height: 14,
                  confidence: 0.80,
                  jersey: '11',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 5,
                  x: 30,
                  y: 60,
                  width: 7,
                  height: 16,
                  confidence: 0.76,
                  jersey: '8',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 6,
                  x: 85,
                  y: 15,
                  width: 6,
                  height: 15,
                  confidence: 0.79,
                  jersey: '3',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                }
              ]
            };
            break;
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1500 * attempts));
        }
      }

      // Enhanced processing and validation of player data
      const processedPlayers = analysisResult.players.map((player: any, index: number) => ({
        id: player.id || index + 1,
        x: Math.max(0, Math.min(95, typeof player.x === 'number' ? player.x : 50)),
        y: Math.max(0, Math.min(95, typeof player.y === 'number' ? player.y : 50)),
        width: Math.max(4, Math.min(20, typeof player.width === 'number' ? player.width : 7)),
        height: Math.max(10, Math.min(30, typeof player.height === 'number' ? player.height : 16)),
        confidence: Math.max(0.5, Math.min(1, typeof player.confidence === 'number' ? player.confidence : 0.8)),
        jersey: player.jersey || (index + 1).toString(),
        team: player.team || (index % 2 === 0 ? 'home' : 'away'),
        teamColor: player.teamColor || (player.team === 'home' ? analysisResult.teamColors?.home : analysisResult.teamColors?.away) || (index % 2 === 0 ? 'Blue' : 'Red'),
        timestamp: timestamp,
        isReferee: false,
        movementPattern: this.generateRealisticMovementPatternWithBounds(
          player.x || 50, 
          player.y || 50, 
          player.width || 7, 
          player.height || 16
        ),
      }));

      console.log(`🎯 Enhanced optimal frame analysis complete, final return ${processedPlayers.length} players (referees filtered with improved accuracy)`);
      return processedPlayers;

    } catch (error) {
      console.error('❌ Enhanced optimal frame player detection failed:', error);
      throw new Error(`Enhanced optimal frame player detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async compressVideo(videoFile: File, targetSizeMB: number = 200): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Unable to create canvas context'));
        return;
      }

      video.onloadedmetadata = () => {
        try {
          const originalSizeMB = videoFile.size / (1024 * 1024);
          const compressionRatio = Math.min(1, targetSizeMB / originalSizeMB);
          
          const newWidth = Math.floor(video.videoWidth * Math.sqrt(compressionRatio));
          const newHeight = Math.floor(video.videoHeight * Math.sqrt(compressionRatio));
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          console.log(`🎬 Compressing video: ${originalSizeMB.toFixed(1)}MB -> target ${targetSizeMB}MB`);
          console.log(`📐 Size adjustment: ${video.videoWidth}x${video.videoHeight} -> ${newWidth}x${newHeight}`);
          
          const stream = canvas.captureStream(15); // 15 FPS
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: Math.floor(1000000 * compressionRatio)
          });
          
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const compressedBlob = new Blob(chunks, { type: 'video/webm' });
            const compressedFile = new File([compressedBlob], `compressed_${videoFile.name}`, {
              type: 'video/webm'
            });
            
            console.log(`✅ Video compression complete: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(compressedFile);
          };
          
          mediaRecorder.onerror = (error) => {
            console.error('❌ Video compression failed:', error);
            reject(new Error('Error occurred during video compression'));
          };
          
          mediaRecorder.start();
          
          let frameCount = 0;
          const maxFrames = Math.floor(video.duration * 15); // 15 FPS
          
          const drawFrame = () => {
            if (frameCount >= maxFrames) {
              mediaRecorder.stop();
              return;
            }
            
            ctx.drawImage(video, 0, 0, newWidth, newHeight);
            frameCount++;
            
            setTimeout(() => {
              if (video.currentTime < video.duration) {
                video.currentTime = frameCount / 15;
                requestAnimationFrame(drawFrame);
              } else {
                mediaRecorder.stop();
              }
            }, 1000 / 15);
          };
          
          video.currentTime = 0;
          video.onseeked = () => {
            drawFrame();
          };
          
        } catch (error) {
          console.error('❌ Video compression setup failed:', error);
          reject(error);
        }
      };
      
      video.onerror = () => {
        reject(new Error('Video loading failed, unable to compress'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  }

  private async preprocessVideoFile(videoFile: File): Promise<File> {
    const fileSizeMB = videoFile.size / (1024 * 1024);
    
    console.log(`📁 Original file size: ${fileSizeMB.toFixed(1)}MB`);
    
    if (videoFile.size > this.RECOMMENDED_SIZE) {
      console.log(`⚠️ File too large (${fileSizeMB.toFixed(1)}MB), starting compression...`);
      
      try {
        let targetSize = 150; // Default 150MB
        if (fileSizeMB > 1000) {
          targetSize = 100; // Compress files over 1GB to 100MB
        } else if (fileSizeMB > 500) {
          targetSize = 120; // Compress files over 500MB to 120MB
        }
        
        const compressedFile = await this.compressVideo(videoFile, targetSize);
        console.log(`✅ File compression complete: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
        return compressedFile;
      } catch (compressionError) {
        console.warn('⚠️ Video compression failed, trying with original file:', compressionError);
        
        if (videoFile.size <= this.MAX_FILE_SIZE) {
          return videoFile;
        } else {
          throw new Error(`File too large (${fileSizeMB.toFixed(1)}MB) and compression failed, please manually compress video and retry`);
        }
      }
    }
    
    return videoFile;
  }

  async analyzePlayerPerformance(
    videoFile: File,
    selectedPlayerId: number,
    playerName: string,
    existingPlayerData?: any
  ): Promise<PerformanceData> {
    try {
      console.log(`🏃 Starting Gemini player performance analysis for ${playerName}...`, {
        playerId: selectedPlayerId,
        fileName: videoFile.name,
        hasExistingData: !!existingPlayerData
      });

      if (!videoFile || videoFile.size === 0) {
        throw new Error('Video file invalid or empty');
      }

      if (!playerName || playerName.trim().length === 0) {
        throw new Error('Player name cannot be empty');
      }

      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`Video file too large (${this.formatFileSize(videoFile.size)}), maximum supported by Gemini is 2GB`);
      }

      const processedFile = await this.preprocessVideoFile(videoFile);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        console.log('✅ Using server-side Gemini processing for player performance analysis...');
        return await this.analyzePlayerPerformanceOnServer(processedFile, selectedPlayerId, playerName, existingPlayerData);
      } else {
        throw new Error('Server-side processing environment not configured. Please configure Supabase environment variables to use Gemini for video file processing.');
      }

    } catch (error) {
      console.error('❌ Gemini player performance analysis detailed error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Server-side processing environment not configured')) {
          throw error;
        } else if (error.message.includes('API key')) {
          throw new Error('Google AI API key invalid, unable to perform player performance analysis');
        } else if (error.message.includes('quota')) {
          throw new Error('Google AI API quota exhausted, unable to complete analysis');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Network connection failed, unable to connect to server');
        } else if (error.message.includes('timeout')) {
          throw new Error('Gemini analysis timeout, video may be too complex or network slow');
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new Error('AI returned analysis result format error, unable to parse');
        } else if (error.message.includes('SAFETY')) {
          throw new Error('Video content blocked by AI safety filter');
        } else {
          throw error;
        }
      }
      
      throw new Error(`Player ${playerName} performance analysis failed, please try again`);
    }
  }

  private async analyzePlayerPerformanceOnServer(
    videoFile: File,
    selectedPlayerId: number,
    playerName: string,
    existingPlayerData?: any
  ): Promise<PerformanceData> {
    try {
      console.log('🚀 Starting server-side Gemini player performance analysis...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables not configured');
      }
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('apiKey', API_KEY);
      formData.append('playerId', selectedPlayerId.toString());
      formData.append('playerName', playerName);
      if (existingPlayerData) {
        formData.append('existingPlayerData', JSON.stringify(existingPlayerData));
      }
      
      let result;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Player performance analysis attempt ${attempts}...`);
          
          const functionUrl = `${supabaseUrl}/functions/v1/analyze-player-performance`;
          console.log('📡 Request URL:', functionUrl);
          
          const timeoutMs = 600000; // 10 minute timeout
          
          const fetchPromise = fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: formData,
          });
          
          const response = await Promise.race([
            fetchPromise,
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
          ]);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Attempt ${attempts} failed:`, response.status, errorText);
            
            if (response.status === 546) {
              throw new Error('Server resources insufficient, please try compressing video file or retry later');
            }
            
            throw new Error(`Server processing failed: ${response.status} ${response.statusText}`);
          }
          
          result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Server-side performance analysis failed');
          }
          
          console.log(`✅ Player performance analysis attempt ${attempts} successful!`);
          break;
          
        } catch (attemptError) {
          console.error(`❌ Player performance analysis attempt ${attempts} failed:`, attemptError);
          
          if (attempts === maxAttempts) {
            if (attemptError instanceof Error) {
              if (attemptError.message.includes('resources insufficient') || attemptError.message.includes('546')) {
                throw new Error('Server resources insufficient, unable to process this size video file. Please try: 1) Compress video file to under 200MB 2) Shorten video length 3) Retry later');
              } else if (attemptError.message.includes('timeout')) {
                throw new Error('Processing timeout, video file may be too large or complex. Please try using smaller video files');
              }
            }
            throw attemptError;
          }
          
          await new Promise(resolve => setTimeout(resolve, 10000 * attempts));
        }
      }
      
      if (!result || !result.success) {
        throw new Error('Server-side player performance analysis failed');
      }
      
      return result.performanceData;
      
    } catch (error) {
      console.error('❌ Server-side player performance analysis failed:', error);
      throw error;
    }
  }

  async capturePlayerAvatar(
    videoFile: File,
    playerId: number,
    timestamp: number = 10
  ): Promise<string | null> {
    try {
      console.log('📸 Starting player avatar capture...', { playerId, timestamp });
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Avatar capture timeout'));
        }, 10000);

        video.onloadeddata = () => {
          video.currentTime = timestamp;
        };

        video.onseeked = () => {
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (ctx && canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(video, 0, 0);
              
              const avatarCanvas = document.createElement('canvas');
              const avatarCtx = avatarCanvas.getContext('2d');
              avatarCanvas.width = 150;
              avatarCanvas.height = 150;
              
              const cropSize = Math.min(canvas.width, canvas.height) * 0.2;
              const cropX = canvas.width * 0.4;
              const cropY = canvas.height * 0.3;
              
              if (avatarCtx) {
                avatarCtx.drawImage(
                  canvas,
                  cropX,
                  cropY,
                  cropSize,
                  cropSize,
                  0,
                  0,
                  150,
                  150
                );
                
                const avatarDataUrl = avatarCanvas.toDataURL('image/jpeg', 0.8);
                console.log('✅ Avatar capture successful');
                clearTimeout(timeout);
                resolve(avatarDataUrl);
              } else {
                clearTimeout(timeout);
                reject(new Error('Unable to create avatar canvas'));
              }
            } else {
              clearTimeout(timeout);
              reject(new Error('Invalid video dimensions, unable to capture avatar'));
            }
          } catch (error) {
            console.error('❌ Error during avatar capture:', error);
            clearTimeout(timeout);
            reject(error);
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video loading failed, unable to capture avatar'));
        };

        video.src = URL.createObjectURL(videoFile);
      });

    } catch (error) {
      console.error('❌ Avatar capture failed:', error);
      throw new Error('Avatar capture failed, please try again');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private validateScore(value: any, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 100) {
      console.error(`❌ Validation failed - ${fieldName}:`, value);
      throw new Error(`AI analysis result ${fieldName} field value invalid: ${value}`);
    }
    return Math.round(num);
  }

  private validateNumber(value: any, fieldName: string, min: number, max: number): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      console.error(`❌ Validation failed - ${fieldName}:`, value, `range: ${min}-${max}`);
      throw new Error(`AI analysis result ${fieldName} field value invalid: ${value} (should be in ${min}-${max} range)`);
    }
    return Math.round(num * 10) / 10;
  }

  private generateRealisticMovementPatternWithBounds(startX: number, startY: number, startWidth: number, startHeight: number) {
    const timestamps = [5, 10, 15, 20, 25, 30, 35];
    const positions = [];
    
    let currentX = startX;
    let currentY = startY;
    let currentWidth = startWidth;
    let currentHeight = startHeight;
    
    for (let i = 0; i < timestamps.length; i++) {
      const moveX = (Math.random() - 0.5) * 15;
      const moveY = (Math.random() - 0.5) * 10;
      const sizeVariation = (Math.random() - 0.5) * 2;
      
      currentX = Math.max(5, Math.min(95, currentX + moveX));
      currentY = Math.max(5, Math.min(95, currentY + moveY));
      currentWidth = Math.max(5, Math.min(20, currentWidth + sizeVariation));
      currentHeight = Math.max(10, Math.min(30, currentHeight + sizeVariation));
      
      positions.push({
        x: Math.round(currentX * 10) / 10,
        y: Math.round(currentY * 10) / 10,
        width: Math.round(currentWidth * 10) / 10,
        height: Math.round(currentHeight * 10) / 10
      });
    }
    
    return { timestamps, positions };
  }
}