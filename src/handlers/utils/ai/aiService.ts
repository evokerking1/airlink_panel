

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import logger from '../../logger';

const prisma = new PrismaClient();

interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}


export const getAISettings = async () => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        aiEnabled: true,
        aiEndpoint: true,
        aiApiKey: true,
      } as any,
    });

    return settings;
  } catch (error) {
    logger.error('Error fetching AI settings:', error);
    throw error;
  }
};


export const isAIEnabled = async (): Promise<boolean> => {
  try {
    const settings = await getAISettings();
    return settings?.aiEnabled || false;
  } catch (error) {
    logger.error('Error checking if AI is enabled:', error);
    return false;
  }
};


export const sendAIRequest = async (
  prompt: string,
  options: Record<string, any> = {}
): Promise<AIResponse> => {
  try {
    const settings = await getAISettings();

    if (!settings || !settings.aiEnabled) {
      return {
        success: false,
        error: 'AI integration is not enabled',
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (settings.aiApiKey) {
      headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
    }

    const payload: Record<string, any> = {
      prompt,
      ...options,
    };
    if ((settings as any).aiModel) {
      payload.model = (settings as any).aiModel;
    }

    const response = await axios.post(
      settings.aiEndpoint,
      payload,
      {
        headers,
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    logger.error('Error sending AI request:', error);
    return {
      success: false,
      error: error.message || 'Failed to communicate with AI service',
    };
  }
};


export const generateAIResponse = async (prompt: string): Promise<string> => {
  try {
    const response = await sendAIRequest(prompt);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate AI response');
    }

    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message?.content ||
             response.data.choices[0].text ||
             'No response generated';
    } else if (response.data.response) {
      return response.data.response;
    } else if (typeof response.data === 'string') {
      return response.data;
    } else {
      return JSON.stringify(response.data);
    }
  } catch (error: any) {
    logger.error('Error generating AI response:', error);
    throw error;
  }
};


export const fetchAvailableModels = async (): Promise<string[] | null> => {
  try {
    const settings = await getAISettings();

    if (!settings || !settings.aiEnabled) {
      return null;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (settings.aiApiKey) {
      headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
    }

    try {
      const modelsEndpoint = `${(settings as any).aiEndpoint.replace(/\/+$/, '')}/models`;

      const response = await axios.get(modelsEndpoint, { headers });

      if (response.data && response.status === 200) {
        if (response.data.data && Array.isArray(response.data.data)) {
          return response.data.data.map((model: any) => model.id);
        } else if (Array.isArray(response.data)) {
          return response.data.map((model: any) => typeof model === 'string' ? model : model.id || model.name);
        } else if (response.data.models && Array.isArray(response.data.models)) {
          return response.data.models.map((model: any) => typeof model === 'string' ? model : model.id || model.name);
        }
      }

      if ((settings as any).aiEndpoint.includes('openai.com')) {
        return [
          'gpt-4o',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'gpt-4-vision-preview',
          'gpt-4-32k'
        ];
      }
      return null;
    } catch (error) {
      const endpointError = error as Error;
      logger.debug(`Failed to fetch models: ${endpointError.message}`);

      if ((settings as any).aiEndpoint.includes('openai.com')) {
        return [
          'gpt-4o',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'gpt-4-vision-preview',
          'gpt-4-32k'
        ];
      }
      return null;
    }
  } catch (error) {
    logger.error('Error fetching available models:', error);
    return null;
  }
};

export default {
  getAISettings,
  isAIEnabled,
  sendAIRequest,
  generateAIResponse,
  fetchAvailableModels,
};
