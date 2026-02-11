import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generateEmbedding, upsertVectors } from '@/lib/vector-db';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60; // Increase timeout for processing larger files

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.warn('Processing file:', file.name);

    // 1. Extract text from file
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (file.name.endsWith('.pdf')) {
      try {
        const data = await pdf(buffer);
        text = data.text;
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return NextResponse.json({ error: 'Failed to parse PDF file' }, { status: 400 });
      }
    } else if (file.name.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Only PDF and TXT files supported' }, { status: 400 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text found in document' }, { status: 400 });
    }

    console.warn('Extracted text length:', text.length);

    // 2. Split into chunks
    const chunks = splitIntoChunks(text, 1000); // Increased chunk size slightly
    console.warn('Created chunks:', chunks.length);

    // 3. Generate embeddings and store in Pinecone
    const documentId = uuidv4();
    const vectors = [];

    // Process chunks in batches to avoid overwhelming APIs if needed, 
    // but here we'll do them sequentially as in the original request for simplicity
    // and to match the progress logging expectation in the UI (though UI doesn't see logs).
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);

        vectors.push({
            id: `${documentId}-chunk-${i}`,
            values: embedding,
            metadata: {
                userId,
                documentId,
                filename: file.name,
                text: chunk,
                chunkIndex: i,
                timestamp: Date.now(),
            },
        });
        
        // Progress log for server-side monitoring
        if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
            console.warn(`Processed chunk ${i + 1}/${chunks.length}`);
        }
    }

    // Batch upsert to Pinecone
    await upsertVectors(vectors);

    return NextResponse.json({ 
      success: true,
      filename: file.name,
      chunks: chunks.length,
      documentId
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Upload error:', error.message);
      return NextResponse.json({ 
        error: error.message || 'Upload failed' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// Helper function to split text into chunks
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  
  // Clean up text
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // Simple chunking by character count with some overlap logic could be added,
  // but let's stick to the requested approach with minor improvements.
  const paragraphs = cleanedText.split(/(?<=[.!?])\s+/); // Split by sentence endings
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph + ' ';
    } else {
      currentChunk += paragraph + ' ';
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Filter out very small chunks
  return chunks.filter(chunk => chunk.length > 20);
}
