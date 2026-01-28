'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Bot, User, Loader2, Settings2 } from "lucide-react";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Provider = "openai" | "anthropic" | "google";

export function ChatPlayground() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>("google"); // Default to Google for free tier
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          provider: provider,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("You must be logged in to chat.");
        } else {
          toast.error("Failed to send message.");
        }
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const { content } = JSON.parse(data);
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                lastMsg.content += content;
                return newMessages;
              });
            } catch (e) {
              console.error("Error parsing JSON chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col shadow-lg">
      <CardHeader className="border-b flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-primary" />
          AI Chat
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI GPT</SelectItem>
              <SelectItem value="anthropic">Anthropic Claude</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 relative bg-slate-50 dark:bg-slate-900/50">
        <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
              <Bot className="w-12 h-12" />
              <p className="text-sm">Start a conversation with {provider === 'google' ? 'Gemini' : provider}...</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`p-2 rounded-full shrink-0 w-8 h-8 flex items-center justify-center ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-white border text-primary dark:bg-slate-800"
                }`}
              >
                {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none px-4"
                    : "bg-white dark:bg-slate-800 text-foreground border rounded-tl-none px-4"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
             <div className="flex items-start gap-3">
               <div className="p-2 rounded-full shrink-0 bg-white border dark:bg-slate-800 w-8 h-8 flex items-center justify-center">
                 <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
               </div>
               <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-foreground text-sm border rounded-tl-none">
                 <span className="animate-pulse">Writing...</span>
               </div>
             </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 border-t bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2 w-full items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${provider}...`}
            disabled={isLoading}
            className="flex-1 rounded-full px-4"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-full shrink-0 w-10 h-10">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
