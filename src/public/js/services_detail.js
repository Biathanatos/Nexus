/**
 * Lance le service côté client et prépare la soumission du formulaire.
 * Vue associée: ../views/pages/services/detail.ejs
 * Route associée: ../routes/services.routes.js (GET /services/:id/:is_ai)
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  // UI injectée par le script service (voir: routes/services.routes.js -> /:id/client.js).
  if (typeof globalThis.ui === "function") globalThis.ui();

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
  const tags = [];
  if (!inputs || inputs.length === 0) return null;

  if (inputs.length === 1) {
    tags.push(inputs[0].value.trim());
  } else {
    inputs.forEach(input => tags.push(input.value.trim()));
  }
  return tags;
}