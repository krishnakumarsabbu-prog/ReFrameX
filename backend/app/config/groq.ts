import { Groq } from 'groq-sdk';

// ReFrameX Groq configuration for M2O Intelligence evaluation
export const groqConfig = {
  apiKey: "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",
  defaultModel: "llama-3.3-70b-versatile",
  fastModel: "llama-3.1-8b-instant",
};

export const GROQ_API_KEY = groqConfig.apiKey;

// Initialize Groq client instance
export const groqClient = new Groq({
  apiKey: groqConfig.apiKey,
  dangerouslyAllowBrowser: true,
});
