function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <b key={index}>{part.slice(2, -2)}</b>;
    }
    return part;
  });
}

export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="about-prose">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderBold(paragraph)}</p>
      ))}
    </div>
  );
}
