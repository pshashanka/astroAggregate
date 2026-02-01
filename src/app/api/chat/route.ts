import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamChatResponse, type ChatMessage, type AIProvider } from "@/lib/ai";
import { semanticSearch } from "@/lib/vector-db";

export const runtime = "nodejs";
export const maxDuration = 60; // Streaming timeout

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { messages, provider = "openai", model } = body as {
      messages: ChatMessage[];
      provider?: AIProvider;
      model?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // 1. RAG: Retrieve context from Pinecone
    const enhancedMessages = [...messages];
    try {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        const searchResults = await semanticSearch(lastMessage.content, {
          topK: 3,
        });

        const context = searchResults.matches
          ?.map((match) => match.metadata?.text as string | undefined)
          .filter(Boolean)
          .join("\n---\n");

        if (context) {
          const systemMsgIdx = enhancedMessages.findIndex(m => m.role === "system");
          const contextPrompt = `\n\nUse the following retrieved context to help answer the user's question. If the context is irrelevant, ignore it.\n\nCONTEXT:\n${context}`;
          
          if (systemMsgIdx !== -1) {
            enhancedMessages[systemMsgIdx] = {
              ...enhancedMessages[systemMsgIdx],
              content: enhancedMessages[systemMsgIdx].content + contextPrompt
            };
          } else {
            enhancedMessages.unshift({
              role: "system",
              content: `You are a helpful assistant.${contextPrompt}`
            });
          }
        }
      }
    } catch (error) {
      console.error("RAG retrieval error:", error);
      // Continue without context if retrieval fails
    }

    // 2. Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChatResponse(enhancedMessages, provider, { model })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
