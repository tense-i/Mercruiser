declare module '@ai-sdk/openai' {
  export function createOpenAI(options?: {
    apiKey?: string;
    baseURL?: string;
    name?: string;
  }): {
    (modelId: string): any;
    chat(modelId: string): any;
  };
}
