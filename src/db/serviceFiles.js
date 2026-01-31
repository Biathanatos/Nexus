const path = require('path');
const fs = require('fs');
// Liens utiles:
// - Utilisé par: ./db.js et ./services.js
// - Scripts générés: ../services/*.js (ne pas modifier manuellement ici)

/**
 * Écrit le fichier JS template de service standard si absent.
 * @returns {void}
 */
function writeDefaultServiceFile() {
    const SERVICES_PATH = path.join(__dirname, '..', 'services', 'default_service');
    const LIB_PATH = path.join(SERVICES_PATH, 'lib');
  // Garde-fou: évite d'écraser un template déjà présent.
    if (fs.existsSync(path.join(SERVICES_PATH, 'script_template.js'))) {
        return;
    }

    if (!fs.existsSync(LIB_PATH)) {
        fs.mkdirSync(LIB_PATH, { recursive: true });
    }
    
    fs.writeFileSync(path.join(SERVICES_PATH, 'script_template.js'), `// Template de service par défaut
async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // Rajouter une description de l'implémentation des services et de la manière de les créer
  root.innerHTML = \`
    <p>Template par défaut</p>
  \`;
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
`);
}

/**
 * Écrit le fichier JS template de service IA si absent.
 * @returns {void}
 */
function writeDefaultAiServiceFile() {
  const SERVICES_PATH = path.join(__dirname, '..', 'services', 'default_ai_service');
  const LIB_PATH = path.join(SERVICES_PATH, 'lib');
  // Garde-fou: évite d'écraser un template déjà présent.
  if (fs.existsSync(path.join(SERVICES_PATH, 'ai_script_template.js'))) {
      return;
  }

  if (!fs.existsSync(LIB_PATH)) {
      fs.mkdirSync(LIB_PATH, { recursive: true });
  }
    
  fs.writeFileSync(path.join(SERVICES_PATH, 'ai_script_template.js'), `// Template de service IA par défaut
async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // Rajouter une description de l'implémentation des services et de la manière de les créer
  root.innerHTML = \`
    <p>Template par défaut</p>
  \`;
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
`);
}

module.exports = { writeDefaultServiceFile, writeDefaultAiServiceFile };