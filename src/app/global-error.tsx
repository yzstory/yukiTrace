"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f4f6",
          color: "#1c1c1e",
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ background: "#fff", borderRadius: 24, padding: "32px 28px", maxWidth: 320, textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>应用出错了</h1>
          <p style={{ color: "#777", fontSize: 15, margin: "0 0 20px" }}>请重试；若反复出现，稍后再打开。</p>
          {error.digest && <p style={{ color: "#aaa", fontSize: 12, fontFamily: "monospace" }}>错误编号 {error.digest}</p>}
          <button
            onClick={reset}
            style={{ background: "#007aff", color: "#fff", border: 0, padding: "12px 22px", borderRadius: 12, fontWeight: 600, fontSize: 15 }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
