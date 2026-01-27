// Template de service par défaut
export async function ui() {
  const root = document.getElementById("service-content");
  if (!root) throw new Error("#service-content introuvable");

  // Contenu HTML du service permettant d'afficher le service et/ou d'interagir avec lui
  root.innerHTML = `
    <p>Ceci est un template de service par défaut, Il affichera simplement le texte entrer dans cette input.<br> Vous pouvez modifier ce code pour créer votre propre service.</p>
    <p>Les entrées utilisateur sont accessibles via la fonction <code>start(input)</code>, où <code>input</code> est une valeur d'un input ou un tableau de valeurs des inputs selon le nombre d'entrées définies dans le formulaire.</p>
    <p>Ils sont accessible dans l'ordre où ils apparaissent dans le formulaire.</p>
    <br>
    <p>Voici un exemple de formulaire simple :</p>
    <form id="service-form" name="service-form" autoComplete="on">
      <div class="form-box">
        <label for="name">Entrez votre nom :</label>
        <input id="name" name="name" required>
        <label for="age">Entrez votre âge :</label>
        <input id="age" name="age" type="number" required>
      </div>
      <div class="form-box">
        <label for="bio">Parlez-nous de vous :</label>
        <textarea id="bio" name="bio" rows="4" cols="50" required></textarea>
        <label for="color">Choisissez vo(s)tre couleur(s) préférée(s) :</label>
        <select id="color" name="color" required>
          <option value="rouge">Rouge</option>
          <option value="vert">Vert</option>
          <option value="bleu">Bleu</option>
        </select>
      </div>
      <button type="submit">Exécuter</button>
    </form>
  `;
}

// point d'entrée
export async function start(userInputs = '') {
  await main(userInputs);
}

// Logique principale du service
async function main(inputs) {
    // Implémenter la logique spécifique du service ici
    const root = document.getElementById("service-content");


    // Exemple simple : afficher un message avec l'entrée utilisateur
    if (document.getElementById("service-output")) {
        document.getElementById("service-output").remove();
    }

    const inputArray = [];
    
    inputs.forEach(input => {
        inputArray.push(input.value);
    });

    const p = document.createElement("p");
    p.id = "service-output";
    p.innerHTML = `Voici la liste des inputs : <strong>${inputArray}</strong>, le type de l'input est : <strong>${typeof inputArray}</strong>, il est composé de <strong>${Array.isArray(inputArray) ? inputArray.length : '1'}</strong> élément(s).`;
    root.appendChild(p);
}

// Gestion des fichiers de dépendances


// Pont vers le monde "non-module"
globalThis.ui = ui;
globalThis.start = start;