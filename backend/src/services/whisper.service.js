const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Service for interacting with FasterWhisper API for audio transcription
 */
class WhisperService {
  constructor() {
    this.baseUrl = process.env.WHISPER_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.WHISPER_TIMEOUT || '300000'); // 5 minutes default for audio processing
  }

  /**
   * Transcribe an audio file with business context and technical keywords
   * @param {string} audioFilePath - Path to the audio file
   * @param {object} options - Transcription options
   * @param {string} options.businessContext - Business context to help the model
   * @param {string} options.technicalKeywords - Technical words and acronyms
   * @param {string} options.language - Language code (default: 'fr')
   * @returns {Promise<object>} - Transcription result with text and metadata
   */
  async transcribeAudio(audioFilePath, options = {}) {
    try {
      if (!fs.existsSync(audioFilePath)) {
        throw new Error('Fichier audio non trouvé');
      }

      const {
        businessContext = '',
        technicalKeywords = '',
        language = 'fr'
      } = options;

      // Build initial prompt from context and keywords
      const initialPrompt = this.buildInitialPrompt(businessContext, technicalKeywords);

      logger.info('Starting audio transcription', {
        filePath: audioFilePath,
        language,
        hasContext: !!businessContext,
        hasKeywords: !!technicalKeywords
      });

      // Prepare form data for multipart/form-data upload
      const formData = new FormData();
      formData.append('file', fs.createReadStream(audioFilePath));
      formData.append('language', language);
      
      if (initialPrompt) {
        formData.append('initial_prompt', initialPrompt);
      }

      // Call FasterWhisper API
      const response = await axios.post(
        `${this.baseUrl}/transcribe`,
        formData,
        {
          timeout: this.timeout,
          headers: {
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (!response.data || !response.data.text) {
        throw new Error('Réponse invalide du service Whisper');
      }

      logger.info('Audio transcription successful', {
        textLength: response.data.text.length,
        segments: response.data.segments?.length || 0
      });

      return {
        text: response.data.text,
        segments: response.data.segments || [],
        language: response.data.language || language,
        duration: response.data.duration || null
      };

    } catch (error) {
      logger.error('Error calling Whisper service', {
        error: error.message,
        stack: error.stack,
        url: this.baseUrl
      });

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Service Whisper non disponible. Vérifiez que le service est démarré.');
      }

      if (error.code === 'ETIMEDOUT') {
        throw new Error('Délai d\'attente dépassé pour le service Whisper. Le fichier audio est peut-être trop long.');
      }

      if (error.response?.status === 413) {
        throw new Error('Fichier audio trop volumineux pour le service Whisper.');
      }

      throw error;
    }
  }

  /**
   * Build initial prompt from business context and technical keywords
   * This helps the Whisper model better understand technical terminology
   * @param {string} businessContext - Business context
   * @param {string} technicalKeywords - Technical keywords/acronyms
   * @returns {string} - Initial prompt for Whisper
   */
  buildInitialPrompt(businessContext, technicalKeywords) {
    const parts = [];

    if (businessContext && businessContext.trim()) {
      parts.push(`Contexte: ${businessContext.trim()}`);
    }

    if (technicalKeywords && technicalKeywords.trim()) {
      parts.push(`Termes techniques: ${technicalKeywords.trim()}`);
    }

    return parts.join('. ');
  }

  /**
   * Check if Whisper service is available
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Whisper health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} - List of supported audio MIME types
   */
  getSupportedFormats() {
    return [
      'audio/mpeg',       // MP3
      'audio/mp3',        // MP3 (alternative)
      'audio/wav',        // WAV
      'audio/wave',       // WAV (alternative)
      'audio/x-wav',      // WAV (alternative)
      'audio/ogg',        // OGG
      'audio/flac',       // FLAC
      'audio/x-flac',     // FLAC (alternative)
      'audio/aac',        // AAC
      'audio/m4a',        // M4A
      'audio/x-m4a',      // M4A (alternative)
      'audio/webm',       // WEBM
      'audio/3gpp',       // 3GP
      'audio/amr',        // AMR
    ];
  }

  /**
   * Check if a MIME type is a supported audio format
   * @param {string} mimeType - MIME type to check
   * @returns {boolean}
   */
  isAudioFile(mimeType) {
    return this.getSupportedFormats().includes(mimeType);
  }
}

module.exports = new WhisperService();
