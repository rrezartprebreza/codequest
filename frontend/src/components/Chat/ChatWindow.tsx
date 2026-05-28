import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Check, Copy, RotateCcw, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { streamTutorMessage } from '../../services/api';

// ── Custom dark theme matching the app palette ──────────────────────────────
const codeTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': { color: '#B8D8F0', background: 'none', fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace', fontSize: 12, lineHeight: '1.65' },
  'pre[class*="language-"]':  { color: '#B8D8F0', background: 'transparent', margin: 0, padding: 0, overflow: 'auto' },
  comment:     { color: '#4A6580', fontStyle: 'italic' },
  prolog:      { color: '#4A6580' },
  doctype:     { color: '#4A6580' },
  cdata:       { color: '#4A6580' },
  punctuation: { color: '#6A8FAD' },
  property:    { color: '#4FBEFF' },
  tag:         { color: '#4FBEFF' },
  boolean:     { color: '#FF8895' },
  number:      { color: '#F5A623' },
  constant:    { color: '#4FBEFF' },
  symbol:      { color: '#4FBEFF' },
  deleted:     { color: '#FF5C72' },
  selector:    { color: '#12E8B0' },
  'attr-name': { color: '#12E8B0' },
  string:      { color: '#12E8B0' },
  char:        { color: '#12E8B0' },
  builtin:     { color: '#12E8B0' },
  inserted:    { color: '#12E8B0' },
  operator:    { color: '#C8D8EA' },
  entity:      { color: '#F5A623', cursor: 'help' },
  url:         { color: '#4FBEFF' },
  variable:    { color: '#C8D8EA' },
  atrule:      { color: '#4FBEFF' },
  'attr-value':{ color: '#12E8B0' },
  function:    { color: '#4FBEFF', fontWeight: '600' },
  'class-name':{ color: '#F5A623', fontWeight: '600' },
  keyword:     { color: '#FF8895', fontWeight: '600' },
  regex:       { color: '#F5A623' },
  important:   { color: '#FF5C72', fontWeight: 'bold' },
  bold:        { fontWeight: 'bold' },
  italic:      { fontStyle: 'italic' },
};

// ── Syntax-highlighted code block with copy button ──────────────────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  const displayLang = lang && lang !== 'text' && lang !== 'plaintext' ? lang : '';
  return (
    <div
      className="my-3 overflow-hidden rounded-xl"
      style={{ background: 'rgba(3,8,20,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3D5670]">
          {displayLang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] font-semibold transition-colors"
          style={{ color: copied ? '#12E8B0' : '#3D5670' }}
        >
          {copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
        </button>
      </div>
      {/* code */}
      <div className="overflow-x-auto p-3">
        <SyntaxHighlighter
          language={displayLang || 'text'}
          style={codeTheme}
          PreTag="div"
          customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: 12, lineHeight: '1.65' }}
          codeTagProps={{ style: { fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace' } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const QUICK_PROMPTS = [
  { label: 'Hint',         prompt: 'Give me one short hint only. Do not reveal the full solution.' },
  { label: 'Explain',      prompt: 'Explain the concept behind this bug pattern with a tiny unrelated example.' },
  { label: 'Coach me',     prompt: 'Guide me Socratically. Ask one diagnostic question at a time and wait for my answer.' },
  { label: 'Example',      prompt: 'Show a minimal example of the same bug pattern without solving my exact code.' },
  { label: 'Review fix',   prompt: 'Review my current approach and point out the smallest next change to try.' },
  { label: 'Practice',     prompt: 'Give me one similar practice task. Do not include the answer until I ask.' },
];

const DEFAULT_MESSAGES: Message[] = [
  {
    id: 'seed-1',
    role: 'assistant',
    content: 'Before changing code, what is the smallest input where this loop should stop?',
  },
  {
    id: 'seed-2',
    role: 'user',
    content: 'Maybe an array with 3 items. It should check indexes 0, 1, and 2.',
  },
  {
    id: 'seed-3',
    role: 'assistant',
    content: 'Good. Now compare that to the loop condition. Which value does the counter have when it reaches the last valid index, and what happens on the next step?',
  },
];

interface ChatWindowProps {
  sessionId: string;
  queuedPrompt?: string;
  onQueuedPromptSent?: () => void;
}

export default function ChatWindow({ sessionId, queuedPrompt = '', onQueuedPromptSent }: ChatWindowProps) {
  const storageKey = `codequest_chat_${sessionId}`;
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return DEFAULT_MESSAGES;
    try {
      const parsed = JSON.parse(saved) as Message[];
      return parsed.length ? parsed : DEFAULT_MESSAGES;
    } catch { return DEFAULT_MESSAGES; }
  });
  const [input, setInput]               = useState('');
  const [streaming, setStreaming]       = useState(false);
  const [lastFailedPrompt, setLastFailed] = useState('');
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef     = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const serializable = messages.filter(m => !m.streaming).slice(-24);
    sessionStorage.setItem(storageKey, JSON.stringify(serializable));
  }, [messages, storageKey]);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = (draft?: string) => {
    const text = (draft ?? input).trim();
    if (!text || streaming) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const userId = `${Date.now()}-user`;
    const aiId   = `${Date.now()}-assistant`;
    setMessages(prev => [...prev,
      { id: userId, role: 'user', content: text },
      { id: aiId,   role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setLastFailed('');
    setStreaming(true);
    void streamTutorMessage(sessionId, text,
      chunk  => setMessages(prev => prev.map(m => m.id !== aiId ? m : { ...m, content: m.content + chunk })),
      ()     => { abortRef.current = null; setMessages(prev => prev.map(m => m.id !== aiId ? m : { ...m, streaming: false })); setLastFailed(''); setStreaming(false); },
      error  => { abortRef.current = null; setMessages(prev => prev.map(m => m.id !== aiId ? m : { ...m, content: error.message || 'Stream failed. Try again.', streaming: false })); setLastFailed(text); setStreaming(false); },
      controller.signal
    );
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages(DEFAULT_MESSAGES);
    setLastFailed('');
    setStreaming(false);
    sessionStorage.removeItem(storageKey);
  };

  useEffect(() => {
    if (!queuedPrompt.trim() || streaming) return;
    send(queuedPrompt);
    onQueuedPromptSent?.();
  }, [queuedPrompt, streaming]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[24px]"
      style={{
        background: 'linear-gradient(160deg, rgba(12,22,40,0.97) 0%, rgba(8,15,30,0.96) 100%)',
        border: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 8px 24px rgba(3,8,16,0.4)',
      }}
    >
      {/* ── Header ── */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#12E8B0]"
            style={{ background: 'rgba(18,232,176,0.08)', border: '1px solid rgba(18,232,176,0.14)' }}
          >
            <Bot size={14} />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight tracking-[-0.02em] text-[#EBF3FC]">AI Coach</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: streaming ? '#12E8B0' : '#536D84' }}>
              {streaming ? '● Live' : 'Socratic · contextual'}
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          title="Clear chat"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#536D84] transition-all hover:bg-white/[0.05] hover:text-[#8BA4BC]"
        >
          <RotateCcw size={12} />
        </button>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {messages.map(message => (
          <div key={message.id} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[11px] font-bold"
              style={message.role === 'assistant'
                ? { background: 'rgba(18,232,176,0.08)', border: '1px solid rgba(18,232,176,0.12)', color: '#12E8B0' }
                : { background: 'rgba(79,190,255,0.08)', border: '1px solid rgba(79,190,255,0.12)', color: '#4FBEFF' }
              }
            >
              {message.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
            </div>

            {/* Bubble */}
            <div
              className="relative max-w-[90%] rounded-2xl px-3.5 py-3 text-[13px] leading-7 break-words"
              style={message.role === 'assistant'
                ? {
                    background: 'rgba(14,24,44,0.90)',
                    border: '1px solid rgba(255,255,255,0.055)',
                    borderTopLeftRadius: 6,
                    boxShadow: '0 4px 12px rgba(3,8,16,0.3)',
                    color: '#C8D8EA',
                  }
                : {
                    background: 'linear-gradient(160deg, rgba(22,50,88,0.95) 0%, rgba(16,38,68,0.92) 100%)',
                    border: '1px solid rgba(79,190,255,0.15)',
                    borderTopRightRadius: 6,
                    boxShadow: '0 4px 12px rgba(3,8,16,0.3)',
                    color: '#D8EEFF',
                  }
              }
            >
              {message.role === 'assistant' && !message.streaming ? (
                <MarkdownMessage content={message.content} />
              ) : message.streaming && !message.content ? (
                <span className="inline-flex items-center gap-1 py-1">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="h-1.5 w-1.5 rounded-full bg-[#12E8B0] animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              ) : (
                <span className="block">
                  <MarkdownMessage content={message.content} />
                  {message.streaming && (
                    <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#12E8B0] align-middle" />
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts ── */}
      <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto border-t border-white/[0.05] px-4 py-2.5 [scrollbar-width:none] [-webkit-scrollbar-display:none]">
        {QUICK_PROMPTS.map(item => (
          <button
            key={item.label}
            onClick={() => send(item.prompt)}
            disabled={streaming}
            className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#536D84] transition-all hover:bg-white/[0.05] hover:text-[#8BA4BC] disabled:opacity-40"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Error/retry bar ── */}
      {lastFailedPrompt && !streaming && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#F5A623]/20 bg-[#F5A623]/[0.07] px-4 py-2">
          <AlertCircle size={12} className="text-[#F5A623]" />
          <span className="text-[12px] text-[#D4A84B]">Stream failed</span>
          <button onClick={() => send(lastFailedPrompt)}
            className="rounded-md border border-[#F5A623]/25 bg-[#F5A623]/[0.10] px-2.5 py-1 text-[11px] font-semibold text-[#F5A623] transition-colors hover:bg-[#F5A623]/20">
            Retry
          </button>
          <button onClick={() => send(`Short hint only (2 sentences max): ${lastFailedPrompt}`)}
            className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[#536D84] transition-colors hover:text-[#8BA4BC]">
            Shorter hint
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div className="flex flex-shrink-0 items-end gap-2 border-t border-white/[0.05] p-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          disabled={streaming}
          placeholder="Ask your coach… (Enter to send)"
          className="max-h-28 flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed text-[#C8D8EA] outline-none transition-all placeholder:text-[#384E63] disabled:opacity-60"
          style={{
            background: 'rgba(6,12,24,0.60)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(18,232,176,0.25)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(18,232,176,0.10)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#030C16] transition-all duration-150 hover:-translate-y-px active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-35"
          style={{
            background: input.trim() && !streaming
              ? 'linear-gradient(135deg, #12E8B0 0%, #0EC897 100%)'
              : 'rgba(18,232,176,0.15)',
            color: input.trim() && !streaming ? '#030C16' : '#12E8B0',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // ── Block code: pre wraps code[language-xxx] ──
        pre: ({ children }) => {
          const child = Array.isArray(children) ? children[0] : children;
          if (child && typeof child === 'object' && 'props' in (child as object)) {
            const el = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
            const lang = (el.props.className ?? '').replace('language-', '').trim() || 'text';
            const code = String(el.props.children ?? '').replace(/\n$/, '');
            return <CodeBlock lang={lang} code={code} />;
          }
          // fallback
          return (
            <div className="my-3 overflow-x-auto rounded-xl p-3 text-[12px] leading-relaxed"
              style={{ background: 'rgba(3,8,20,0.85)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace', color: '#B8D8F0' }}>
              {children}
            </div>
          );
        },
        // ── Inline code — passthrough for block, styled for inline ──
        code: ({ className, children }) => {
          if (className?.includes('language-')) {
            // Inside a <pre> — pass through so pre handler controls rendering
            return <code className={className}>{children}</code>;
          }
          return (
            <code className="rounded-md px-1.5 py-0.5 font-mono text-[12px] text-[#12E8B0]"
              style={{ background: 'rgba(18,232,176,0.08)', border: '1px solid rgba(18,232,176,0.10)' }}>
              {children}
            </code>
          );
        },
        // ── Text elements ──
        p:          ({ children }) => <p className="mb-2.5 leading-[1.75] last:mb-0">{children}</p>,
        strong:     ({ children }) => <strong className="font-semibold text-[#EBF3FC]">{children}</strong>,
        em:         ({ children }) => <em className="italic text-[#A8C4DC]">{children}</em>,
        // ── Lists ──
        ul:         ({ children }) => <ul className="mb-2.5 ml-4 list-disc space-y-1.5 last:mb-0">{children}</ul>,
        ol:         ({ children }) => <ol className="mb-2.5 ml-4 list-decimal space-y-1.5 last:mb-0">{children}</ol>,
        li:         ({ children }) => <li className="leading-[1.7] text-[#C0D4E8] marker:text-[#12E8B0]">{children}</li>,
        // ── Headings ──
        h1: ({ children }) => (
          <h1 className="mb-2.5 mt-1 border-b border-white/[0.06] pb-1.5 text-[15px] font-bold tracking-tight text-[#EBF3FC]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-1 text-[14px] font-bold tracking-tight text-[#EBF3FC]">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-0.5 text-[13px] font-semibold" style={{ color: '#12E8B0' }}>{children}</h3>
        ),
        // ── Blockquote ──
        blockquote: ({ children }) => (
          <blockquote className="my-2.5 rounded-r-lg border-l-2 py-2 pl-3 pr-2 italic text-[#8BA4BC]"
            style={{ borderColor: '#12E8B0', background: 'rgba(18,232,176,0.05)' }}>
            {children}
          </blockquote>
        ),
        // ── Tables ──
        table: ({ children }) => (
          <div className="my-2.5 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <table className="min-w-full border-collapse text-left text-[12px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead style={{ background: 'rgba(255,255,255,0.04)', color: '#EBF3FC' }}>{children}</thead>,
        th:    ({ children }) => <th className="px-3 py-2 font-semibold" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{children}</th>,
        td:    ({ children }) => <td className="px-3 py-1.5 text-[#8BA4BC]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{children}</td>,
        // ── Misc ──
        a:  ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer"
            className="text-[#12E8B0] underline underline-offset-2 hover:text-[#0FC090] transition-colors">
            {children}
          </a>
        ),
        hr: () => <hr className="my-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
