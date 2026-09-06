"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * AI 回复的 Markdown 渲染：支持加粗、列表、表格（GFM）。
 * 样式贴着气泡走，不引入 typography 插件；表格在窄屏上横向滚动。
 */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        h1: ({ children }) => <p className="my-1.5 text-headline">{children}</p>,
        h2: ({ children }) => <p className="my-1.5 text-headline">{children}</p>,
        h3: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
        blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
        code: ({ children, className }) =>
          className ? (
            <code className="block overflow-x-auto rounded-lg bg-fill px-3 py-2 text-footnote">{children}</code>
          ) : (
            <code className="rounded bg-fill px-1 py-0.5 text-footnote">{children}</code>
          ),
        pre: ({ children }) => <pre className="my-1.5">{children}</pre>,
        hr: () => <hr className="my-2 border-border/60" />,
        table: ({ children }) => (
          <div className="no-scrollbar my-2 -mx-1 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-footnote">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="text-muted-foreground">{children}</thead>,
        th: ({ children }) => <th className="border-b border-border/60 px-2 py-1 text-left font-medium">{children}</th>,
        td: ({ children }) => <td className="border-b border-border/40 px-2 py-1 align-top tabular-nums">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
