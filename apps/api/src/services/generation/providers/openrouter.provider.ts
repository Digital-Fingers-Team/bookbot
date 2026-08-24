import { getLLMSettings } from "../../../config/llm.js";
import { OpenAICompatibleProvider } from "./openai-compatible.provider.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super(getLLMSettings("openrouter"));
  }
}
