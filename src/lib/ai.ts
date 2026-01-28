import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Google Gemini client
export const googleGenAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""
);

// Unified chat completion interface
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIProvider = "openai" | "anthropic" | "google";

export async function generateChatResponse(
  messages: ChatMessage[],
  provider: AIProvider = "openai",
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const { maxTokens = 1024, temperature = 0.7 } = options || {};

  if (provider === "openai") {
    const model = options?.model || "gpt-3.5-turbo";
    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const model = options?.model || "claude-3-sonnet-20240229";
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: otherMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  if (provider === "google") {
    const modelName = options?.model || "gemini-flash-latest";
    const model = googleGenAI.getGenerativeModel({ model: modelName });
    
    // Gemini handles history differently, usually requires constructing a chat session
    // For simplicity, we'll format as a prompt or use chat session if applicable.
    // Here we'll map messages to Gemini format.
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));
    
    const lastMessage = messages[messages.length - 1];
    
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    return response.text();
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

// Streaming chat completion for real-time responses
export async function* streamChatResponse(
  messages: ChatMessage[],
  provider: AIProvider = "openai",
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): AsyncGenerator<string, void, unknown> {
  const { maxTokens = 1024, temperature = 0.7 } = options || {};

  if (provider === "openai") {
    const model = options?.model || "gpt-3.5-turbo";
    const stream = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
    return;
  }

  if (provider === "anthropic") {
    const model = options?.model || "claude-3-sonnet-20240229";
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const stream = await anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: otherMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  }

  if (provider === "google") {
    const modelName = options?.model || "gemini-flash-latest";
    const model = googleGenAI.getGenerativeModel({ model: modelName });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));
    
    const lastMessage = messages[messages.length - 1];
    
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    });

    const result = await chat.sendMessageStream(lastMessage.content);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) yield chunkText;
    }
    return;
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}
