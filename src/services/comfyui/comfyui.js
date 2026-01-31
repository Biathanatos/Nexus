let state = null;

async function ui() {
  state = await main();

  const serviceName =
    document.getElementById("service-name").innerText || "ComfyUI";

  // Récupère la liste des workflows déjà enregistrés côté Nexus
  const filesRes = await fetch(`/services/files/${serviceName}`);
  const filesJson = filesRes.ok ? await filesRes.json() : { files: [] };
  const files = filesJson.files || [];
  console.log("Fichiers ComfyUI déjà chargés:", files);

  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // UI ComfyUI
  root.innerHTML = `
    <section id="comfyui-panel" class="comfyui-panel">
      <header class="comfyui-header">
        <h3>ComfyUI</h3>
        <p class="comfyui-subtitle">Charge un workflow, écris ton prompt et génère une image.</p>
      </header>

      <div class="comfyui-grid">
        <div class="comfyui-card">
          <h4>Workflow JSON</h4>
          <form id="comfyui-json-form" class="comfyui-form">
            <label for="comfy-json-file" class="comfyui-file-label">
              <svg width="48" height="48" viewBox="-1.6 -1.6 19.20 19.20" xmlns="http://www.w3.org/2000/svg" class="comfyui-icon">
                <path d="M0 1H6L9 4H16V14H0V1Z" />
              </svg>
              <span id="comfy-json-picked">Aucun fichier sélectionné</span>
            </label>
            <input
              type="file"
              id="comfy-json-file"
              name="file"
              accept=".json,application/json"
              hidden
              required
            />
            <button type="submit" class="comfyui-btn comfyui-btn-lg">Charger vers le serveur</button>
          </form>

          <div id="comfy-files-list" class="comfyui-files">
            <h4>Workflows disponibles</h4>
            <div class="comfyui-select-row">
              <select id="comfy-files-select" class="comfyui-select" ${
                files.length === 0 ? "disabled" : ""
              }>
                ${
                  files.length === 0
                    ? "<option>Aucun fichier disponible</option>"
                    : files
                        .map(
                          (f, index) =>
                            `<option value=\"${f}\" ${index === 0 ? "selected" : ""}>${f}</option>`
                        )
                        .join("")
                }
              </select>
              <button id="comfy-files-load" type="button" class="comfyui-btn" ${
                files.length === 0 ? "disabled" : ""
              }>
                Charger
              </button>
            </div>
          </div>
        </div>

        <div class="comfyui-card">
          <h4>Prompt</h4>
          <label class="comfyui-label" for="comfyui-prompt-input">Prompt utilisateur</label>
          <textarea id="comfyui-prompt-input" class="comfyui-textarea" rows="4" placeholder="Décris l'image à générer..."></textarea>

          <div class="comfyui-field">
            <label class="comfyui-label" for="comfyui-count-input">Nombre d’images</label>
            <input id="comfyui-count-input" class="comfyui-input" type="number" min="1" max="10" value="1" />
          </div>

          <div class="comfyui-actions">
            <button id="comfyui-generate-btn" class="comfyui-btn comfyui-btn-lg" type="button" disabled>
              Générer l'image
            </button>
            <button id="comfyui-clear-btn" class="comfyui-btn comfyui-btn-secondary comfyui-btn-lg" type="button">
              Effacer
            </button>
            <button id="comfyui-cancel-btn" class="comfyui-btn comfyui-btn-secondary comfyui-btn-lg" type="button" hidden>
              Annuler
            </button>
          </div>

          <div id="comfyui-status" class="comfyui-status" aria-live="polite"></div>
          <div id="comfyui-loading" class="comfyui-loading" hidden>
            <span class="comfyui-spinner" aria-hidden="true"></span>
            <span>Génération en cours...</span>
          </div>
        </div>
      </div>

      <div class="comfyui-card">
        <h4>Résultat</h4>
        <div class="comfyui-result">
          <img id="comfyui-image" class="comfyui-image" alt="Image générée" hidden />
          <p id="comfyui-image-placeholder" class="comfyui-placeholder">Aucune image générée pour l'instant.</p>
          <div id="comfyui-gallery" class="comfyui-gallery"></div>
        </div>
      </div>
    </section>
  `;

  const fileInput = document.getElementById("comfy-json-file");
  const pickedSpan = document.getElementById("comfy-json-picked");
  const form = document.getElementById("comfyui-json-form");
  const filesSelect = document.getElementById("comfy-files-select");
  const filesLoadBtn = document.getElementById("comfy-files-load");
  const promptInput = document.getElementById("comfyui-prompt-input");
  const countInput = document.getElementById("comfyui-count-input");
  const generateBtn = document.getElementById("comfyui-generate-btn");
  const clearBtn = document.getElementById("comfyui-clear-btn");
  const cancelBtn = document.getElementById("comfyui-cancel-btn");
  const statusEl = document.getElementById("comfyui-status");
  const loadingEl = document.getElementById("comfyui-loading");
  const imageEl = document.getElementById("comfyui-image");
  const imagePlaceholder = document.getElementById("comfyui-image-placeholder");
  const galleryEl = document.getElementById("comfyui-gallery");

  let pollState = { canceled: false };

  const setStatus = (message = "", variant = "") => {
    statusEl.textContent = message;
    statusEl.className = `comfyui-status ${variant ? `comfyui-status--${variant}` : ""}`.trim();
  };

  const setLoading = (isLoading) => {
    if (loadingEl) loadingEl.hidden = !isLoading;
    generateBtn.disabled = isLoading || !state.comfyWorkflowContent || !promptInput.value.trim();
    clearBtn.disabled = isLoading;
    if (cancelBtn) cancelBtn.hidden = !isLoading;
  };

  const setWorkflow = (content, name = null) => {
    state.comfyWorkflowContent = content;
    state.comfyWorkflowName = name;
    setStatus(name ? `Workflow chargé: ${name}` : "Workflow chargé.");
    generateBtn.disabled = !promptInput.value.trim();
  };

  const renderImage = (url) => {
    if (!url) return;
    imageEl.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    imageEl.hidden = false;
    if (imagePlaceholder) imagePlaceholder.hidden = true;
  };

  const appendImage = (url) => {
    if (!galleryEl || !url) return;
    const img = document.createElement("img");
    img.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    img.alt = "Image générée";
    img.className = "comfyui-gallery-image";
    galleryEl.appendChild(img);
  };

  setLoading(false);
  if (!files.length) {
    setStatus("Charge un workflow pour activer la génération.");
  }

  // Affiche le nom quand on choisit un fichier
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      pickedSpan.textContent = "Aucun fichier sélectionné";
      generateBtn.disabled = true;
      return;
    }
    pickedSpan.textContent = file.name;
    generateBtn.disabled = !promptInput.value.trim();
  });

  // Upload du workflow JSON vers Nexus (Multer: req.file.buffer)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];

    if (!file) {
      alert("Veuillez sélectionner un fichier JSON ComfyUI.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file, file.name);

    const result = await fetch(`/services/create/${serviceName}/${file.name}`, {
      method: "POST",
      body: fd
    });

    if (result.ok) {
      alert("Workflow chargé avec succès sur le serveur Nexus.");
      setWorkflow(await file.text(), file.name);

      // Ajoute le fichier à la liste sans reload
      if (!files.includes(file.name) && filesUl) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "comfy-file-btn";
        btn.textContent = file.name;
        li.appendChild(btn);
        filesUl.appendChild(li);
      }
    } else {
      alert("Erreur lors du chargement du workflow sur le serveur Nexus.");
    }
  });

  const loadSelectedWorkflow = async () => {
    const fileName = filesSelect?.value;
    if (!fileName) return;

    try {
      const res = await fetch(
        `/services/files/${serviceName}/${encodeURIComponent(fileName)}`
      );
      if (!res.ok) {
        alert("Erreur lors du chargement du fichier.");
        return;
      }
      const text = await res.text();
      JSON.parse(text);

      setWorkflow(text, fileName);
      alert(`Workflow "${fileName}" chargé depuis le serveur.`);
    } catch (err) {
      console.error(err);
      alert("JSON invalide pour ce fichier.");
      state.comfyWorkflowContent = null;
      generateBtn.disabled = true;
    }
  };

  filesLoadBtn?.addEventListener("click", loadSelectedWorkflow);
  filesSelect?.addEventListener("change", () => {
    setStatus("Workflow sélectionné, clique sur Charger.");
  });

  if (files.length > 0) {
    try {
      const firstFile = files[0];
      const res = await fetch(`/services/files/${serviceName}/${encodeURIComponent(firstFile)}`);
      if (res.ok) {
        const text = await res.text();
        JSON.parse(text);
        setWorkflow(text, firstFile);
      }
    } catch (err) {
      console.error("Auto-load workflow failed:", err);
    }
  }

  promptInput.addEventListener("input", () => {
    generateBtn.disabled = !state.comfyWorkflowContent || !promptInput.value.trim();
    if (!promptInput.value.trim()) {
      setStatus("Le prompt est requis pour générer une image.");
    } else if (state.comfyWorkflowContent) {
      setStatus("Prêt à générer.", "success");
    }
  });

  clearBtn.addEventListener("click", () => {
    promptInput.value = "";
    setStatus("");
    generateBtn.disabled = true;
  });

  cancelBtn.addEventListener("click", () => {
    pollState.canceled = true;
    setStatus("Génération annulée.", "warning");
    setLoading(false);
  });

  const pollStatus = async (promptId, { intervalMs = 2000, timeoutMs = 90000, maxErrors = 3 } = {}) => {
    const startedAt = Date.now();
    let errorCount = 0;

    while (Date.now() - startedAt < timeoutMs) {
      if (pollState.canceled) return { status: "canceled" };
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      try {
        const res = await fetch(`/api/services/comfyui/status?prompt_id=${encodeURIComponent(promptId)}`);
        if (res.status === 202) continue;
        if (!res.ok) throw new Error(`status_request_failed_${res.status}`);

        const data = await res.json();
        if (data?.url) return data;
      } catch (err) {
        console.error("ComfyUI status error:", err);
        errorCount += 1;
        if (errorCount >= maxErrors) {
          return { status: "error" };
        }
      }
    }

    return { status: "timeout" };
  };

  // Génération (appel proxy backend -> ComfyUI)
  generateBtn.addEventListener("click", async () => {
    if (!state.comfyWorkflowContent) {
      setStatus("Aucun workflow chargé.", "error");
      return;
    }

    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
      setStatus("Le prompt est requis.", "error");
      return;
    }

    const count = Math.min(Math.max(parseInt(countInput?.value || "1", 10), 1), 10);

    setStatus(`Génération 1/${count} en cours...`, "");
    setLoading(true);
    pollState = { canceled: false };
    if (galleryEl) galleryEl.innerHTML = "";
    if (imagePlaceholder) imagePlaceholder.hidden = true;

    try {
      for (let i = 0; i < count; i += 1) {
        if (pollState.canceled) {
          setStatus("Génération annulée.", "warning");
          break;
        }

        setStatus(`Génération ${i + 1}/${count} en cours...`, "");

        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), 30000);

        const res = await fetch("/api/services/comfyui/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt,
            workflowContent: state.comfyWorkflowContent
          }),
          signal: controller.signal
        });

        clearTimeout(requestTimeout);

        if (!res.ok) {
          setStatus("Erreur lors de l’appel à ComfyUI via le backend.", "error");
          break;
        }

        const data = await res.json();
        console.log("Résultat ComfyUI (backend proxy):", data);

        if (!data?.prompt_id) {
          setStatus("ComfyUI n'a pas retourné d'identifiant de prompt.", "error");
          break;
        }

        const result = await pollStatus(data.prompt_id, { intervalMs: 2000, timeoutMs: 90000, maxErrors: 3 });

        if (result?.url) {
          renderImage(result.url);
          appendImage(result.url);
        } else if (result?.status === "canceled") {
          setStatus("Génération annulée.", "warning");
          break;
        } else if (result?.status === "timeout") {
          setStatus("Génération trop longue. Réessaie ou simplifie le prompt.", "warning");
          break;
        } else if (result?.status === "error") {
          setStatus("Impossible d'obtenir le statut ComfyUI.", "error");
          break;
        } else {
          setStatus("Aucune image retournée pour ce workflow.", "warning");
          break;
        }
      }

      if (!pollState.canceled) {
        setStatus(`Génération terminée (${count} image${count > 1 ? "s" : ""}).`, "success");
      }
    } catch (err) {
      console.error(err);
      if (err?.name === "AbortError") {
        setStatus("La requête a expiré. Réessaie.", "error");
      } else {
        setStatus("Erreur réseau lors de l’appel à ComfyUI.", "error");
      }
    } finally {
      setLoading(false);
    }
  });
}

// point d'entrée
async function start(userInputs) {
  await main(userInputs);
}

// Ici, tout est piloté par l’UI + le bouton "Utiliser ce workflow"
async function main(input) {
  return {
    comfyWorkflowContent: null,
    comfyWorkflowName: null
  };
}

// Pont vers le monde "non-module"
globalThis.ui = ui;
globalThis.start = start;