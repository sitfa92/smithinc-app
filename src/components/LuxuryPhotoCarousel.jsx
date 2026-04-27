import React from "react";

export default function LuxuryPhotoCarousel({
  files = [],
  title = "Uploaded digitals",
  showDelete = false,
  onDelete,
  onDownload,
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [files]);

  if (!files.length) return null;

  const safeIndex = Math.min(activeIndex, files.length - 1);
  const active = files[safeIndex];

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + files.length) % files.length);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % files.length);
  };

  return (
    <div
      style={{
        border: "1px solid #e8e4dc",
        borderRadius: 14,
        padding: 14,
        background: "linear-gradient(180deg, #f9f7f2 0%, #f2eee5 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#777" }}>
          {title} ({files.length})
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {safeIndex + 1} / {files.length}
        </div>
      </div>

      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #ddd7cb", background: "#111" }}>
        <a href={active.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", aspectRatio: "4/5" }}>
          <img
            src={active.url}
            alt={active.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </a>

        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(17,17,17,0.55)",
                color: "#fff",
                borderRadius: 999,
                width: 36,
                height: 36,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {"<"}
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(17,17,17,0.55)",
                color: "#fff",
                borderRadius: 999,
                width: 36,
                height: 36,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {">"}
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
        {files.map((file, index) => (
          <button
            key={file.path || file.url}
            type="button"
            onClick={() => setActiveIndex(index)}
            title={file.name}
            style={{
              border: index === safeIndex ? "2px solid #111" : "1px solid #dcd5c8",
              borderRadius: 8,
              overflow: "hidden",
              width: 56,
              height: 72,
              background: "#fff",
              padding: 0,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            <img src={file.url} alt={file.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }} title={active.name}>
          {active.name}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(active)}
              style={{
                padding: "6px 11px",
                fontSize: 11,
                borderRadius: 7,
                border: "1px solid #d6d0c4",
                background: "#fff",
                color: "#4a4a4a",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Download
            </button>
          )}
          {showDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(active)}
              style={{
                padding: "6px 11px",
                fontSize: 11,
                borderRadius: 7,
                border: "1px solid rgba(155,28,28,0.3)",
                background: "#fff",
                color: "#9b1c1c",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}