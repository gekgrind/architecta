export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/plain"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function formatAsMarkdown(title: string, body: string) {
  return `# ${title}\n\n${body}`;
}
