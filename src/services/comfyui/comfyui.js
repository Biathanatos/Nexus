const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;

let comfyWorkflowContent = null; // string JSON brut

async function ui() {
  const serviceName =
    document.getElementById("service-name").innerText || "ComfyUI";

  // Récupère la liste des workflows déjà enregistrés côté Nexus
  const filesRes = await fetch(`/services/files/${serviceName}`);
  const filesJson = filesRes.ok ? await filesRes.json() : { files: [] };
  const files = filesJson.files || [];
  console.log("Fichiers ComfyUI déjà chargés:", files);

  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // UI ComfyUI JSON loader
  root.innerHTML = `
    <section id="comfyui-json-loader">
      <h3>Charger un workflow ComfyUI (JSON)</h3>

      <!-- Sélection du fichier -->
      <form id="comfyui-json-form">
        <label for="comfy-json-file" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <svg width="64" height="64" viewBox="-1.6 -1.6 19.20 19.20" xmlns="http://www.w3.org/2000/svg" style="fill:var(--secondary-color);">
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
        <button type="submit">Charger le workflow vers le serveur</button>
      </form>

      <!-- Liste des fichiers déjà chargés avec la possibilité de choisir quel fichier utiliser -->
      <div id="comfy-files-list" style="margin-top:1em;">
        <h4>Fichiers JSON déjà chargés :</h4>
        <ul id="comfy-files-ul">
          ${
            files.length === 0
              ? "<li>Aucun fichier chargé.</li>"
              : files
                  .map(
                    (f) =>
                      `<li><button type="button" class="comfy-file-btn">${f}</button></li>`
                  )
                  .join("")
          }
        </ul>
      </div>

      <!-- Action d'utilisation -->
      <div style="margin-top:1em;">
        <button id="comfy-json-use" type="button" disabled>
          Utiliser ce workflow
        </button>
      </div>
    </section>
  `;

  const fileInput = document.getElementById("comfy-json-file");
  const pickedSpan = document.getElementById("comfy-json-picked");
  const useBtn = document.getElementById("comfy-json-use");
  const form = document.getElementById("comfyui-json-form");
  const filesUl = document.getElementById("comfy-files-ul");

  // Affiche le nom quand on choisit un fichier
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      pickedSpan.textContent = "Aucun fichier sélectionné";
      useBtn.disabled = true;
      return;
    }
    pickedSpan.textContent = file.name;
    useBtn.disabled = false;
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
      comfyWorkflowContent = await file.text();
      useBtn.disabled = false;

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

  // Choisir un workflow déjà stocké (GET /services/files/:serviceName/:fileName)
  if (filesUl) {
    filesUl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".comfy-file-btn");
      if (!btn) return;
      const fileName = btn.textContent.trim();

      try {
        const res = await fetch(
          `/services/files/${serviceName}/${encodeURIComponent(fileName)}`
        );
        if (!res.ok) {
          alert("Erreur lors du chargement du fichier.");
          return;
        }
        const text = await res.text();
        JSON.parse(text); // validation JSON rapide

        comfyWorkflowContent = text;
        useBtn.disabled = false;
        alert(`Workflow "${fileName}" chargé depuis le serveur.`);
      } catch (err) {
        console.error(err);
        alert("JSON invalide pour ce fichier.");
        comfyWorkflowContent = null;
        useBtn.disabled = true;
      }
    });
  }

  // Utiliser le workflow (appel proxy backend -> ComfyUI)
  useBtn.addEventListener("click", async () => {
    if (!comfyWorkflowContent) {
      alert("Aucun workflow chargé.");
      return;
    }

    const userPrompt = prompt(
      "Entrez le prompt à injecter dans le workflow ComfyUI :",
      ""
    );
    if (userPrompt == null) return;

    try {
      const res = await fetch("/api/services/comfyui/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt,
          workflowContent: comfyWorkflowContent // string JSON
        })
      });

      if (!res.ok) {
        alert("Erreur lors de l’appel à ComfyUI via le backend.");
        return;
      }

      const data = await res.json();
      console.log("Résultat ComfyUI (backend proxy):", data);
      // À adapter selon ce que ton endpoint /prompt retourne /
      // ce que tu renvoies depuis /api/services/comfyui/generate.
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de l’appel à ComfyUI.");
    }
  });
}

// point d'entrée
async function start(userInputs) {
  await main(userInputs);
}

// Ici, tout est piloté par l’UI + le bouton "Utiliser ce workflow"
async function main(input) {
  // template par défaut : rien à faire ici
}

// Pont vers le monde "non-module"
globalThis.ui = ui;
globalThis.start = start;