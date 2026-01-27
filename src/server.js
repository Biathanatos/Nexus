const path = require('path');
const express = require('express');
const { getDatabase } = require('./db/db');
const cookieParser = require('cookie-parser');

// Initialise l'application Express et le port d'écoute principal.
const app = express();
const PORT = 3000;

// Configuration des vues EJS et du dossier public.
// Les templates sont dans: ./views (ex: views/pages/nexus.ejs).
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares globaux (JSON, cookies) et routes de l'application.
// Routes déclarées dans: ./routes/nexus.routes.js, ./routes/user.routes.js, ./routes/services.routes.js
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', require('./routes/nexus.routes.js'));
app.use('/user', require('./routes/user.routes.js'));
app.use('/services', require('./routes/services.routes.js'));

// Démarrage du serveur HTTP.
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));

/**
 * Arrête proprement le serveur et ferme la base SQLite.
 * @returns {void}
 */
function shutdown() {
    console.log('\nFermeture du serveur...');
    
    // Fermer la base de données
    try {
        const db = getDatabase();
        db.close();
        console.log('Connexion SQLite fermée avec succès.');
    } catch (err) {
        console.error('Erreur lors de la fermeture de la base de données:', err);
    }

    // Arrêter le processus Node
    process.exit(0);
}

// Intercepte les signaux pour fermer proprement l'application.
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);