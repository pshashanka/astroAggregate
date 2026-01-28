import { Pinecone } from "@pinecone-database/pinecone";
import { openai } from "./ai";

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

// Get the default index
export function getVectorIndex(indexName?: string) {
  return pinecone.index(indexName || process.env.PINECONE_INDEX!);
}

// Generate embeddings using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// Upsert vectors to Pinecone
export async function upsertVectors(
  vectors: {
    id: string;
    values: number[];
    metadata?: Record<string, string | number | boolean>;
  }[],
  namespace?: string
) {
  const index = getVectorIndex();
  await index.namespace(namespace || "default").upsert(vectors);
}

// Query similar vectors
export async function querySimilarVectors(
  queryVector: number[],
  options?: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, string | number | boolean>;
    includeMetadata?: boolean;
  }
) {
  const { topK = 5, namespace = "default", filter, includeMetadata = true } = options || {};
  const index = getVectorIndex();

  return await index.namespace(namespace).query({
    vector: queryVector,
    topK,
    filter,
    includeMetadata,
  });
}

// Semantic search: Convert text to embedding and search
export async function semanticSearch(
  query: string,
  options?: {
    topK?: number;
    namespace?: string;
    filter?: Record<string, string | number | boolean>;
  }
) {
  const queryEmbedding = await generateEmbedding(query);
  return await querySimilarVectors(queryEmbedding, {
    ...options,
    includeMetadata: true,
  });
}

// Delete vectors by ID
export async function deleteVectors(ids: string[], namespace?: string) {
  const index = getVectorIndex();
  await index.namespace(namespace || "default").deleteMany(ids);
}
