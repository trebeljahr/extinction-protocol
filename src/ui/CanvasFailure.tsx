type Props = { error: Error; reset: () => void };

// Fallback shown when the 3D canvas fails to mount — usually a transient
// asset-load (HDR / glTF) failure on first frame. The user gets a hard
// reload (cleanest path to re-fetch everything) plus a retry that just
// re-mounts the subtree, in case the failure was a one-off.
export const CanvasFailure = ({ error, reset }: Props) => (
  <div className="overlay" style={{ zIndex: 50 }}>
    <div className="overlay-card">
      <h1>Render Glitch</h1>
      <p
        style={{
          margin: "0 0 18px",
          color: "var(--color-fg-muted)",
          fontSize: "var(--fs-md)",
          maxWidth: 360,
        }}
      >
        The scene didn&rsquo;t mount. This is usually a transient asset-load failure — a fresh load
        almost always recovers.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button type="button" className="btn-ghost btn--sm" onClick={reset}>
          Try again
        </button>
      </div>
      {import.meta.env.DEV && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            textAlign: "left",
            background: "var(--color-surface-inset)",
            border: "1px solid var(--color-border-faint)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--fs-xs)",
            color: "var(--color-fg-faint)",
            maxWidth: 360,
            maxHeight: 160,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error.message}
        </pre>
      )}
    </div>
  </div>
);
