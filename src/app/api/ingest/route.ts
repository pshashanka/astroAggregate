import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateEmbedding, upsertVectors } from "@/lib/vector-db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { text, metadata = {} } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      );
    }

    // Generate embedding
    const embedding = await generateEmbedding(text);

    // Upsert to Pinecone
    const vectorId = uuidv4();
    await upsertVectors([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          ...metadata,
          text, // Store the original text in metadata for retrieval
          userId,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      id: vectorId,
    });
  } catch (error) {
    console.error("Ingestion API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
