/**
 * Lance le service côté client et prépare la soumission du formulaire.
 * Vue associée: ../views/pages/services/detail.ejs
 * Route associée: ../routes/services.routes.js (GET /services/:id/:is_ai)
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', async () => {
  // UI injectée par le script service (voir: routes/services.routes.js -> /:id/client.js).
  if (typeof globalThis.ui === "function") await globalThis.ui();

  const form = document.querySelector('form');
  if (!form) return;

  /**
   * Transmet les entrées utilisateur au service.
   * @param {SubmitEvent} e
   * @returns {Promise<void>}
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputs = form.querySelectorAll('input, textarea, select');
    const formatedInputs = formatInput(inputs);

    if (typeof globalThis.start === "function") {
      await globalThis.start(formatedInputs);
    }
  });
});

/**
 * Normalise les champs de formulaire en tableau de valeurs.
 * @param {NodeListOf<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} inputs
 * @returns {string[]|null}
 */
function formatInput(inputs) {
  if (!inputs || inputs.length === 0) return null;

  // Cas 1: un seul input type=file
  if (inputs.length === 1 && inputs[0].type === 'file') {
    const files = inputs[0].files;
    return files ? Array.from(files) : [];
  }

  // Cas général, si tu l’utilises ailleurs
  const values = [];
  inputs.forEach(input => {
    if (input.type === 'file') {
      if (input.files) values.push(...input.files);
    } else {
      values.push(input.value.trim());
    }
  });
  return values;
}