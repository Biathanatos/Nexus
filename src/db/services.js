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

async function createServicesInDB(files, paths, serviceName, serviceDescription, serviceIsAI, aiInputSchema, slug, serviceTags) {
    console.log(aiInputSchema);
    // Enregistre le service en DB (table: service).
    const db = getDatabase();
    let serviceId;

    try {
        // Vérifie la correspondance entre fichiers et chemins.
        if ((files?.length || 0) !== paths?.length) {
            // Remonter l'erreur.
            return { status: 400, message: 'Mismatch between number of files and paths.' };
        }

        try {
            // Démarre une transaction.
            db.exec('BEGIN');

            // Vérifie l'existence des tables.
            const serviceTableCheck = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'service\';').get();
            const dependenciesTableCheck = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'dependencies\';').get();

            // Crée les tables au besoin.
            if (serviceTableCheck === undefined || dependenciesTableCheck === undefined) {
                createServiceTables();
            }

            // Insère le service principal.
            const stmt = db.prepare('INSERT INTO service (name, description, path, data_directory, serviceIsAI, ai_input_schema) VALUES (?, ?, ?, ?, ?, ?)');
            const sInfo = stmt.run(serviceName, serviceDescription, `services/${slug}/${slug}.js`, `services/${slug}/data`, serviceIsAI ? 1 : 0, aiInputSchema || null);

            // Récupère l'id du service créé.
            serviceId = sInfo.lastInsertRowid;

            if (typeof serviceTags === 'string') {
                serviceTags = serviceTags
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean);
            }

            // Gestion des tags (tables: tags / service_tags).
            if (serviceTags && Array.isArray(serviceTags)) {
                // Normalise et insère les tags, puis crée les liaisons.
                const insertTagStmt = db.prepare('INSERT INTO tags(tag) VALUES (?) ON CONFLICT(tag) DO NOTHING');
                const link = db.prepare('INSERT INTO service_tags(service_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE tag = ?)) ON CONFLICT DO NOTHING');
                
                // Pour chaque tag fourni, trim et ignore les tags vides.
                for (const raw of serviceTags) {
                    const tag = String(raw).trim();
                    if (!tag) continue;

                    insertTagStmt.run(tag);
                    link.run(serviceId, tag);
                }
            }

            // Gestion des dépendances.

            // Prépare l'insertion des dépendances (table: dependencies).
            const depStmt = db.prepare('INSERT INTO dependencies (name, hash, size) VALUES (?, ?, ?)');
            // Prépare la liaison dépendance <-> service (table: service_dependencies).
            const linkStmt = db.prepare('INSERT INTO service_dependencies (dependency_id, service_id) VALUES (?, ?)');

            for (let i = 0; i < (files?.length || 0); i++) {
                // Construction du chemin complet en conservant la structure relative.
                // Récupère le fichier et son chemin relatif.
                const file = files[i];
                // Création du hash.
                const fileHash = await sha256(file.buffer);
                // Enregistre la dépendance en DB (table: dependencies / service_files).
                const depInfo = depStmt.run(file.originalname, fileHash, file.size);
                const dependencyId = depInfo.lastInsertRowid;
                // Lie la dépendance au service (table: service_dependencies).
                const linkInfo = linkStmt.run(dependencyId, serviceId);

                // Vérifie que les insertions se sont bien passées.
                if (linkInfo.changes === 0) {
                    throw new Error('Failed to link dependency to service.');
                } else if (depInfo.changes === 0) {
                    throw new Error('Failed to insert dependency record.');
                }
            };
            // Valide la transaction.
            db.exec('COMMIT');
        } catch (error) {
            // En cas d'erreur, annule la transaction.
            db.exec('ROLLBACK');
            // Ecrit l'erreur dans la console.
            console.error('Error during service creation in DB:', error);
            // Remonter l'erreur.
            return { status: 500, message: 'Error during service creation in DB: ' + error.message }
        }
        // Si tout s'est bien passé, retourne l'id du service créé.
        return { status: 200, serviceId: serviceId };
    } catch (error) {
        // Ecrit l'erreur dans la console.
        console.error('Unexpected error during service creation:', error);
        // Remonter l'erreur.
        return { status: 500, message: 'Unexpected error during service creation: ' + error.message }
    }
}

async function createServicesFiles(files, paths, serviceDir, slug, serviceScript) {
    // Écrit les fichiers sur disque.
    try {
        // Chemin d'écriture du fichier service dans src/services/.
        const serviceFilePath = path.join(serviceDir, `${slug}.js`);
        // Crée le dossier du service si nécessaire.
        await fs.promises.mkdir(path.dirname(serviceFilePath), { recursive: true });
        // Écrit le fichier service principal.
        await fs.promises.writeFile(serviceFilePath, serviceScript);
        // Crée le dossier data/ pour le service.
        await fs.promises.mkdir(path.join(serviceDir, 'data'), { recursive: true });
        // Crée le dossier dependencies/ pour le service.
        await fs.promises.mkdir(path.join(serviceDir, 'dependencies'), { recursive: true });

        // Gère les fichiers de dépendances.
        for (let i = 0; i < (files?.length || 0); i++) {
            // Construction du chemin complet en conservant la structure relative.
            // Récupère le fichier et son chemin relatif.
            const file = files[i];
            const relativePath = paths[i];
            // Chemin complet sécurisé.
            const fullPath = safeJoin(path.join(serviceDir, 'dependencies'), relativePath);
            // Récupère le dossier parent.
            const dirPath = path.dirname(fullPath);
            // Crée le dossier parent si nécessaire.
            await fs.promises.mkdir(dirPath, { recursive: true });
            // Écrit le fichier.
            await fs.promises.writeFile(fullPath, file.buffer);
        }
        // Si tout s'est bien passé, retourne le statut 200.
        return { status: 200 };
    } catch (error) {
        // En cas d'erreur, supprime le dossier du service créé partiellement.
        await fs.promises.rm(serviceDir, { recursive: true, force: true });
        // Ecrit l'erreur dans la console.
        console.error('Error writing service files:', error);
        // Remonter l'erreur.
        return { status: 500, message: 'Error writing service files: ' + error.message };
    }
}

function removeService(serviceId) {
    const db = getDatabase();
    // Supprime un service et ses dépendances.
    db.exec('BEGIN');

    try {
        if (serviceId) {
            // Récupère les dépendances liées au service.
            const depIds = db.prepare('SELECT dependency_id FROM service_dependencies WHERE service_id = ?').all(serviceId).map(row => row.dependency_id);
            
            // Nettoie les enregistrements liés.
            db.prepare('DELETE FROM service_dependencies WHERE service_id = ?').run(serviceId);
            db.prepare('DELETE FROM service_tags WHERE service_id = ?').run(serviceId);

            // Supprime le service lui-même.
            db.prepare('DELETE FROM service WHERE id = ?').run(serviceId);
            
            // Supprime les dépendances orphelines.
            for (const depId of depIds) {
                db.prepare('DELETE FROM dependencies WHERE id = ? AND NOT EXISTS (SELECT 1 FROM service_dependencies WHERE dependency_id = ?)').run(depId, depId);
            }
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { getDefaultServiceTemplate, getAllServices, createServicesInDB, createServicesFiles, removeService };