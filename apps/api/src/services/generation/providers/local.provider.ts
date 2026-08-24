import { getLLMSettings } from "../../../config/llm.js";
import { OpenAICompatibleProvider } from "./openai-compatible.provider.js";

/**
 * Connects to a local OpenAI-compatible server such as Ollama, LM Studio, or
 * vLLM. The server must expose /chat/completions and optionally SSE streaming.
 */
export class LocalLLMProvider extends OpenAICompatibleProvider {
  constructor() {
    super(getLLMSettings("local"));
  }
}
