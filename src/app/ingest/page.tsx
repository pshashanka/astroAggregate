"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function IngestPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text to ingest");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to ingest text");
      }

      toast.success("Knowledge successfully ingested!");
      setText("");
    } catch (error) {
      console.error("Ingestion error:", error);
      toast.error("An error occurred during ingestion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <Card className="w-full max-w-2xl border-zinc-200 dark:border-zinc-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Knowledge Ingestion</CardTitle>
          <CardDescription>
            Add information to Pinecone to enhance the AI's retrieval context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="flex min-h-[200px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-black dark:ring-offset-black dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
            placeholder="Enter knowledge content here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            This text will be embedded and stored in your vector database.
          </p>
          <Button onClick={handleIngest} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ingesting...
              </>
            ) : (
              "Ingest Knowledge"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
