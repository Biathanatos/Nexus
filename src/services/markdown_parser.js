import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

export async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  root.innerHTML = `
    <div id="markdown-viewer">
      <div>
        <label for="md-input">Markdown</label>
        <textarea id="md-input" rows="30"></textarea>
      </div>
      <div>
        <label>Preview</label>
        <div id="md-preview"></div>
      </div>
    </div>
  `;

  const textarea = document.getElementById("md-input");

  const handleChange = async () => {
    const text = textarea.value;
    await start(text);
  };

  textarea.addEventListener("input", handleChange);

  textarea.value = `# Markdown Viewer\n\nBienvenue dans le viewer markdown avec **marked**.\n\n## Features\n\n- Support complet du markdown\n- Preview en temps réel\n- Titres, listes, code, images, liens\n\n### Code inline\n\nTu peux faire du \`code inline\` ou des blocs:\n\n\`\`\`javascript\nconst hello = () => console.log('Hello!');\n\`\`\`\n\n**Bold** et *italic* marchent bien.\n\n> Les blockquotes aussi!\n\n[Lien vers Google](https://google.com)`;
  await handleChange();
}

export async function start(userInputs) {
  await main(userInputs);
}

function renderPreview(html) {
  const preview = document.getElementById("md-preview");
  if (!preview) return;
  preview.innerHTML = html;
}

async function main(input) {
  const text = (input) || "";
  const html = await marked.parse(text);
  renderPreview(html);
}

globalThis.ui = ui;
globalThis.start = start;