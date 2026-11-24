'use client';

import { FormEvent, useEffect, useRef, useState, useTransition } from 'react';

type Role = 'user' | 'assistant';
type Message = { role: Role; content: string };
type ChatResult = {
  reply: string;
  model: string;
  latencyMs: number;
  mock: boolean;
  stopReason: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function Icon({ name, size = 20 }: { name: 'plus' | 'message' | 'search' | 'settings' | 'send' | 'stop' | 'sparkles'; size?: number }) {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L7.6 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 6.4 14H6v-2.6h.4A1.7 1.7 0 0 0 8 10.4a1.7 1.7 0 0 0-.3-1.9L7.6 8l1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 12.4 5v-.2H15V5a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14H21a1.7 1.7 0 0 0-1.6 1z" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
    sparkles: <><path d="m12 3-1.2 3.2L7.5 7.5l3.3 1.3L12 12l1.2-3.2 3.3-1.3-3.3-1.3z" /><path d="m19 13-.7 1.8-1.8.7 1.8.7.7 1.8.7-1.8 1.8-.7-1.8-.7z" /><path d="m5 13-.5 1.5L3 15l1.5.5L5 17l.5-1.5L7 15l-1.5-.5z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/chat/models`)
      .then((response) => response.json())
      .then((data: { models: string[]; default: string }) => {
        setModels(data.models);
        setSelectedModel(data.default);
      })
      .catch(() => setModels(['gemini-3.5-flash-lite']));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    setInput('');
    setSidebarOpen(false);
    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const response = await fetch(`${API_URL}/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextHistory, model: selectedModel }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? 'The request failed');

        const result = data as ChatResult;
        setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        setMessages((current) => [...current, { role: 'assistant', content: `Couldn’t complete that request: ${message}` }]);
      }
    });
  };

  const newChat = () => {
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Icon name="sparkles" size={18} /></div>
          <span>Atlas</span>
        </div>

        <button className="new-chat" type="button" onClick={newChat}>
          <Icon name="plus" size={18} />
          <span>New chat</span>
        </button>

        <nav className="nav-section" aria-label="Chat navigation">
          <button type="button" className="nav-item active">
            <Icon name="message" size={17} />
            <span>Chat</span>
          </button>
          <button type="button" className="nav-item">
            <Icon name="search" size={17} />
            <span>Search</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="nav-item">
            <Icon name="settings" size={17} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <div className="avatar">A</div>
            <div><strong>Alex Morgan</strong><span>Free plan</span></div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <section className="chat-area">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <span /><span /><span />
          </button>
          <div className="model-picker">
            <span className="status-dot" />
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              aria-label="Choose model"
            >
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
          <button className="icon-button" type="button" aria-label="More options">•••</button>
        </header>

        <div className="conversation">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="hero-mark"><Icon name="sparkles" size={28} /></div>
              <h1>How can I help you today?</h1>
              <p>Ask a question, explore an idea, or start with a prompt.</p>
              <div className="prompt-grid">
                {['Explain a complex topic', 'Help me write an email', 'Brainstorm project ideas'].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                    <span>{prompt}</span>
                    <b>→</b>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.role === 'assistant' && <div className="assistant-avatar"><Icon name="sparkles" size={16} /></div>}
                  <div className="bubble">{message.content}</div>
                </article>
              ))}
              {isPending && (
                <article className="message assistant">
                  <div className="assistant-avatar"><Icon name="sparkles" size={16} /></div>
                  <div className="bubble typing"><i /><i /><i /></div>
                </article>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Message Atlas..."
              rows={1}
              aria-label="Message"
            />
            <button className="send-button" type="submit" disabled={!input.trim() || isPending} aria-label={isPending ? 'Generating' : 'Send message'}>
              {isPending ? <Icon name="stop" size={17} /> : <Icon name="send" size={17} />}
            </button>
          </form>
          <p>Atlas can make mistakes. Check important information.</p>
        </div>
      </section>
    </main>
  );
}
