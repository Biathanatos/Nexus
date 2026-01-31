// Template de service par défaut
async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // Rajouter une description de l'implémentation des services et de la manière de les créer
  root.innerHTML = `
    <p>Template par défaut</p>
  `;
}

// point d'entrée
async function start(userInputs) {
  await main(userInputs);
}

async function main(input) {
    // Rien à faire ici pour le template par défaut
    // Implémenter la logique spécifique du service ici
}

// Pont vers le monde "non-module"
globalThis.ui = ui;
globalThis.start = start;
