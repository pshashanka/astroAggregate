'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function DocumentsPage() {
  const { isLoaded, userId } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'uploading', message: string }>({
    type: 'idle',
    message: ''
  });

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setStatus({ type: 'uploading', message: 'Uploading and processing...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ 
          type: 'success', 
          message: `Success! Processed ${data.chunks} chunks from ${data.filename}` 
        });
        toast.success(`Processed ${data.filename}`);
        setFile(null);
      } else {
        setStatus({ 
          type: 'error', 
          message: data.error || 'Upload failed' 
        });
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Upload failed' });
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  if (!isLoaded || !userId) {
    return <div className="flex items-center justify-center min-h-[50vh]">Loading...</div>;
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground mt-2">
          Add your PDFs or text files to train your AI assistant.
        </p>
      </div>

      <Card className="p-6 shadow-lg border-zinc-200 dark:border-zinc-800">
        <div className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2">
              Select a document (PDF or TXT)
            </label>
            <div className="flex items-center gap-4">
               <Input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setStatus({ type: 'idle', message: '' });
                }}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Document...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload and Process
              </>
            )}
          </Button>

          {status.message && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-900' :
              status.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900' :
              'bg-muted text-muted-foreground'
            }`}>
              {status.type === 'success' && <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />}
              {status.type === 'error' && <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />}
              {status.type === 'uploading' && <Loader2 className="h-5 w-5 mt-0.5 animate-spin flex-shrink-0" />}
              <p className="text-sm font-medium">{status.message}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="p-4 bg-muted/50 border-none">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                How it works
            </h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                    <span className="font-bold text-foreground">1.</span>
                    Upload a PDF or TXT file
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-foreground">2.</span>
                    AI chunks and embeds content
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-foreground">3.</span>
                    Data stored in vector database
                </li>
                <li className="flex gap-2">
                    <span className="font-bold text-foreground">4.</span>
                    Chat using context from files
                </li>
            </ol>
        </Card>
        
        <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-lg border-zinc-200 dark:border-zinc-800">
            <div className="text-center">
                <p className="text-sm font-medium">Ready to chat?</p>
                <Button variant="link" className="mt-1 h-auto p-0" asChild>
                    <a href="/chat">Go to Chat &rarr;</a>
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
