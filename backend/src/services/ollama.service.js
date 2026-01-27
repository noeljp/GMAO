const axios = require('axios');
const logger = require('../config/logger');

/**
 * Service for interacting with Ollama LLM for description reformulation
 */
class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '30000');
  }

  /**
   * Reformulate a technician's description with context
   * @param {string} originalDescription - The original description from the technician
   * @param {object} context - Context information (asset, type, etc.)
   * @returns {Promise<string>} - Reformulated description
   */
  async reformulateDescription(originalDescription, context = {}) {
    try {
      if (!originalDescription || originalDescription.trim() === '') {
        throw new Error('Description originale vide');
      }

      // Build context prompt
      let contextPrompt = '';
      if (context.actif) {
        contextPrompt += `\nInformations sur l'actif:\n`;
        if (context.actif.code_interne) {
          contextPrompt += `- Code: ${context.actif.code_interne}\n`;
        }
        if (context.actif.description) {
          contextPrompt += `- Description: ${context.actif.description}\n`;
        }
        if (context.actif.type) {
          contextPrompt += `- Type: ${context.actif.type}\n`;
        }
        if (context.actif.localisation) {
          contextPrompt += `- Localisation: ${context.actif.localisation}\n`;
        }
      }

      if (context.type_intervention) {
        contextPrompt += `\nType d'intervention: ${context.type_intervention}\n`;
      }

      if (context.priorite) {
        contextPrompt += `Priorité: ${context.priorite}\n`;
      }

      const prompt = `Tu es un assistant technique pour un système GMAO (Gestion de Maintenance Assistée par Ordinateur). 
Tu dois reformuler les descriptions techniques fournies par les techniciens pour les rendre plus claires, professionnelles et structurées, tout en conservant toutes les informations importantes.

${contextPrompt}

Description originale du technicien:
"${originalDescription}"

Reformule cette description de manière claire et professionnelle. La reformulation doit:
- Être concise mais complète
- Utiliser un vocabulaire technique approprié
- Structurer l'information de manière logique
- Conserver tous les détails importants
- Ne contenir QUE la description reformulée, sans préambule ni conclusion

Description reformulée:`;

      logger.info('Calling Ollama API for reformulation', {
        model: this.model,
        promptLength: prompt.length
      });

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40
          }
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.response) {
        throw new Error('Réponse invalide du service Ollama');
      }

      const reformulated = response.data.response.trim();
      
      logger.info('Ollama reformulation successful', {
        originalLength: originalDescription.length,
        reformulatedLength: reformulated.length
      });

      return reformulated;
    } catch (error) {
      logger.error('Error calling Ollama service', {
        error: error.message,
        stack: error.stack,
        url: this.baseUrl
      });

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Service Ollama non disponible. Vérifiez que le service est démarré.');
      }

      if (error.code === 'ETIMEDOUT') {
        throw new Error('Délai d\'attente dépassé pour le service Ollama');
      }

      throw error;
    }
  }

  /**
   * Check if Ollama service is available
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Ollama health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get available models from Ollama
   * @returns {Promise<Array>}
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.data.models || [];
    } catch (error) {
      logger.error('Error fetching Ollama models', { error: error.message });
      return [];
    }
  }
}

module.exports = new OllamaService();
