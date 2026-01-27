const path = require('path');
const fs = require('fs');
const { getDatabase, createServiceTables } = require('./db');
const { writeDefaultServiceFile, writeDefaultAiServiceFile } = require('./serviceFiles');
// Liens utiles:
// - Initialisation DB: ./db.js
// - Templates fichiers services: ./serviceFiles.js

/**
 * Récupère le service template par défaut (IA ou non).
 * @param {boolean} [isAI=false] - Vrai pour le template IA.
 * @returns {object} Service par défaut depuis la base.
 */
function getDefaultServiceTemplate(isAI = false) {
    // Ouvre la DB et s'assure que la table service existe.
    const db = getDatabase();

    const tableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='service';"
    ).get();
    if (!tableCheck) createServiceTables();

    const stmt = db.prepare('SELECT * FROM service WHERE name = ?');
    
    if (isAI) {
        var service = stmt.get('Default AI Service');
    } else {
        var service = stmt.get('Default Service');
    }

    if (!service) {
        // Recrée les tables au besoin puis re-tente la sélection.
        createServiceTables();
        
        console.log('Retrieved service from DB:', service);
        
        if (isAI) {
            var service = stmt.get('Default AI Service');
        } else {
            var service = stmt.get('Default Service');
        }

        if (!service) throw new Error("Default Service not created");
    }

    // Assure l'existence du fichier template sur disque.
    const servicePath = path.join(__dirname, '..', service.path);
    if (!fs.existsSync(servicePath)) {
        if (isAI) {
            writeDefaultAiServiceFile();
        } else {
            writeDefaultServiceFile();
        }
    }

    return service;
}

/**
 * Récupère tous les services enregistrés.
 * @returns {object[]} Liste des services.
 */
function getAllServices() {
    // Retourne la liste complète des services (utilisée par les routes).
    const db = getDatabase();

    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service';").get();

    if (!tableCheck) {
        createServiceTables();
    }

    const stmt = db.prepare('SELECT * FROM service');
    return stmt.all();
}

module.exports = { getDefaultServiceTemplate, getAllServices };