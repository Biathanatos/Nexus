const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { writeDefaultServiceFile, writeDefaultAiServiceFile } = require('./serviceFiles');
// Liens utiles:
// - Accès services DB: ./services.js
// - Templates fichiers services: ./serviceFiles.js

// Emplacement de la base SQLite locale.
const DB_DIRECTORY = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIRECTORY, 'nexus.db');

// Dossier de scripts services (utilisé par serviceFiles.js).
const SERVICES_PATH = path.join(__dirname, '..', 'services');

// S'assure que les dossiers nécessaires existent.
fs.mkdirSync(DB_DIRECTORY, { recursive: true });
fs.mkdirSync(SERVICES_PATH, { recursive: true });

let database = null;

/**
 * Crée les tables liées aux utilisateurs et leur apparence.
 * @returns {void}
 */
function createUserTable() {
    // Crée les tables de référence avant les dépendances d'apparence.
    createToneReferenceTables();

    // Table users + userAppearance (profil utilisateur).
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS userAppearance (
            user_id INTEGER PRIMARY KEY,
            -- skin attributes
            skin_tone_id TEXT REFERENCES ref_skin_tones(id) ON DELETE RESTRICT,
            -- hair attributes
            hair_color TEXT,
            hair_style TEXT,
            hair_length TEXT,
            -- facial attributes
            facial_hair TEXT,
            -- eye attributes
            eye_color TEXT,
            eye_shape TEXT,
            -- body attributes
            body_type TEXT,
            height_cm TEXT,
            weight_kg TEXT,
            breast_size TEXT,
            waist_size TEXT,
            hip_size TEXT,
            -- clothing attributes
            outerwear TEXT,
            midwear TEXT,
            topwear TEXT,
            bottomwear TEXT,
            underwear TEXT,
            footwear TEXT,
            -- accessories
            eyewear TEXT,
            headwear TEXT,
            jewelry TEXT,
            piercings TEXT,
            tattoos TEXT,
            makeup_style TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
}

/**
 * Crée les tables liées aux assistants IA et à leur contexte.
 * @returns {void}
 */
function createAssistantTables() {
    // Tables principales des assistants + relations + mémoire.
    database.exec(`
        CREATE TABLE IF NOT EXISTS assistants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            surname TEXT,
            birthdate DATE,
            Ethnicity TEXT,
            gender TEXT,
            avatar_url TEXT,
            NSFW BOOLEAN DEFAULT 0,
            description TEXT,
            model_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assistantAppearance (
            assistant_id INTEGER PRIMARY KEY,
            -- skin attributes
            skin_tone TEXT,
            -- hair attributes
            hair_color TEXT,
            hair_style TEXT,
            hair_length TEXT,
            -- facial attributes
            facial_hair TEXT,
            -- eye attributes
            eye_color TEXT,
            eye_shape TEXT,
            -- body attributes
            body_type TEXT,
            height_cm TEXT,
            weight_kg TEXT,
            breast_size TEXT,
            waist_size TEXT,
            hip_size TEXT,
            -- clothing attributes
            outerwear TEXT,
            midwear TEXT,
            topwear TEXT,
            bottomwear TEXT,
            underwear TEXT,
            footwear TEXT,
            -- accessories
            eyewear TEXT,
            headwear TEXT,
            jewelry TEXT,
            piercings TEXT,
            tattoos TEXT,
            makeup_style TEXT,
            FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS assistantMind (
            assistant_id INTEGER PRIMARY KEY,
            -- psychological attributes
            personality_traits TEXT,
            language_style TEXT,
            hobbies TEXT,
            likes TEXT,
            dislikes TEXT,
            fears TEXT,
            goals TEXT,
            moral_values TEXT,
            beliefs TEXT,
            -- dynamic state
            current_mood TEXT DEFAULT 'neutral',
            mental_state TEXT DEFAULT 'stable',
            -- contextual knowledge
            FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS assistantRelationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assistant_id INTEGER NOT NULL,
            name TEXT,
            surname TEXT,
            relationship_type TEXT,
            description TEXT,
            last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS assistantMemory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assistant_id INTEGER NOT NULL,
            content TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
        );
    `);

    // Table conversations/messages (utilisées par l'IA).
    createConversationTables(database);
}

/**
 * Crée les tables de conversations et messages.
 * @returns {void}
 */
function createConversationTables() {
    // Tables de conversation et messages.
    database.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
            assistant_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            context TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
    `);
}

/**
 * Crée les tables de référence pour les tons de peau.
 * @returns {void}
 */
function createToneReferenceTables() {
    // Table de référence des tons de peau (utilisée par views/pages/user/profile.ejs).
    database.exec(`
        CREATE TABLE IF NOT EXISTS ref_skin_tones (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            hex_code TEXT NOT NULL
        );
    `);

    // Table services: liste des services et métadonnées.
    database.exec(`
        INSERT OR IGNORE INTO ref_skin_tones (id, label, hex_code) VALUES 
            ('TONE_1', 'Very Fair', '#F7E2D3'),
            ('TONE_2', 'Fair', '#F1C27D'),
            ('TONE_3', 'Medium', '#E0AC69'),
            ('TONE_4', 'Olive/Tan', '#C68642'),
            ('TONE_5', 'Brown', '#8D5524'),
            ('TONE_6', 'Dark/Black', '#3B2219');
    `);
}

/**
 * Crée les tables des services, tags et dépendances.
 * @returns {void}
 */
function createServiceTables() {
    // Table des services.
    database.exec(`
        CREATE TABLE IF NOT EXISTS service (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            path TEXT,
            data_directory TEXT,
            serviceIsAI BOOLEAN DEFAULT 0,
            ai_input_schema TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Table des dépendances de service.
    database.exec(`
        CREATE TABLE IF NOT EXISTS dependencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            path TEXT,
            hash TEXT,
            size BIGINT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Table liant service <-> dépendances.
    database.exec(`
        CREATE TABLE IF NOT EXISTS service_dependencies (
            dependency_id INTEGER NOT NULL REFERENCES dependencies(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES service(id) ON DELETE CASCADE,
            PRIMARY KEY (dependency_id, service_id)
        );
    `);

    // Table de tags simples (catégorisation services).
    database.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Table de liaison service <-> tags.
    database.exec(`
        CREATE TABLE IF NOT EXISTS service_tags (
            service_id INTEGER NOT NULL REFERENCES service(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (service_id, tag_id)
        );
    `);

    // Vérifie si les services par défaut existent.
    const defaultService = database
        .prepare('SELECT 1 FROM service WHERE name = ?')
        .get('Default Service');

    const defaultAIService = database
        .prepare('SELECT 1 FROM service WHERE name = ?')
        .get('Default AI Service');

    // Statements préparés pour l'insertion.
    const insertService = database.prepare(
        'INSERT INTO service (name, description, path, data_directory, serviceIsAI, ai_input_schema) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertTag = database.prepare(
        'INSERT INTO tags(tag) VALUES (?) ON CONFLICT(tag) DO NOTHING'
    );
    const linkTag = database.prepare(`
        INSERT INTO service_tags (service_id, tag_id)
        VALUES (?, (SELECT id FROM tags WHERE tag = ?))
        ON CONFLICT(service_id, tag_id) DO NOTHING`
    );
    if (!defaultService) {
        // Crée le service par défaut non-IA.

        try {
            database.exec('BEGIN');

            const DefaultServiceInfo = insertService.run(
                'Default Service',
                'This is the default service template.',
                'services/default_service/script_template.js',
                'services/default_service/data',
                0,
                null
            );
            const DefaultServiceId = DefaultServiceInfo.lastInsertRowid;

            for (const tag of ['default', 'template']) {
                insertTag.run(tag);
                linkTag.run(DefaultServiceId, tag);
            }

            database.exec('COMMIT');
        } catch (err) {
            database.exec('ROLLBACK');
            throw err;
        }
    }
    
    if (!defaultAIService) {
        // Crée le service par défaut IA si manquant.

        try {
            database.exec('BEGIN');

            const DefaultAIServiceInfo = insertService.run(
                'Default AI Service',
                'This is the default AI service template.',
                'services/default_ai_service/ai_script_template.js',
                'services/default_ai_service/data',
                1,
                null
            );
            const DefaultAIServiceId = DefaultAIServiceInfo.lastInsertRowid;
            
            for (const tag of ['default', 'template', 'AI']) {
                insertTag.run(tag);
                linkTag.run(DefaultAIServiceId, tag);
            }

            database.exec('COMMIT');
        } catch (err) {
            database.exec('ROLLBACK');
            throw err;
        }
    }

    // Écrit les scripts de template si absents (voir: ./serviceFiles.js).
    writeDefaultServiceFile();
    writeDefaultAiServiceFile();
}

/**
 * Retourne une connexion SQLite (singleton).
 * @returns {import('node:sqlite').DatabaseSync} Connexion active.
 */
function getDatabase() {
    if (database) {
        return database;
    }
    
    // Ouvre la base SQLite locale (node:sqlite).
    database = new DatabaseSync(DB_PATH);
    database.exec('PRAGMA foreign_keys = ON;');

    return database;
}

module.exports = { getDatabase, createUserTable, createAssistantTables, createServiceTables };