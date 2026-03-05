const admin = require("firebase-admin");

// Initialize Firebase Admin - مع معالجة الحالة التي لا يوجد فيها ملف
let db = null;

async function initFirebase() {
    try {
        // Check for environment variables first
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
            console.log('Firebase Admin initialized from environment variables');
        } else if (require('fs').existsSync("./serviceAccountKey.json")) {
            // Fall back to JSON file
            const serviceAccount = require("./serviceAccountKey.json");
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin initialized from serviceAccountKey.json');
        } else {
            throw new Error('Firebase credentials not found');
        }
        
        db = admin.firestore();
        console.log('Firebase Admin initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error.message);
        console.log('Note: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
        return false;
    }
}

// Default database structure
const defaultData = {
    tickets: [],
    ticketCounter: 0,
    ratings: [],
    customButtons: []
};

// In-memory fallback when Firebase is not available
let memoryDB = { ...defaultData };

// Initialize database - create default document if not exists
async function initDatabase() {
    const firebaseReady = await initFirebase();
    
    if (firebaseReady && db) {
        try {
            const doc = await db.doc('config/main').get();
            if (!doc.exists) {
                await db.doc('config/main').set(defaultData);
                console.log('Firestore database initialized');
            } else {
                // Load data to memory for fallback
                memoryDB = doc.data();
            }
        } catch (e) {
            console.log('Error initializing database:', e.message);
            console.log('Using in-memory database as fallback');
        }
    } else {
        console.log('Firebase not available, using in-memory database');
    }
}

// Read from Firestore or memory
async function readDB() {
    if (db) {
        try {
            const doc = await db.doc('config/main').get();
            if (doc.exists) {
                memoryDB = doc.data();
                return doc.data();
            }
        } catch (e) {
            console.log('Error reading from Firestore, using memory:', e.message);
        }
    }
    return { ...memoryDB };
}

// Write to Firestore or memory
async function writeDB(data) {
    memoryDB = data;
    if (db) {
        try {
            await db.doc('config/main').set(data);
        } catch (e) {
            console.log('Error writing to Firestore:', e.message);
        }
    }
}

// Get all tickets
async function getAllTickets() {
    const data = await readDB();
    return data.tickets || [];
}

// Get ticket counter
async function getTicketCounter() {
    const data = await readDB();
    return data.ticketCounter || 0;
}

// Increment ticket counter
async function incrementTicketCounter() {
    const data = await readDB();
    data.ticketCounter = (data.ticketCounter || 0) + 1;
    await writeDB(data);
    return data.ticketCounter;
}

// Add ticket
async function addTicket(ticket) {
    const data = await readDB();
    ticket.createdAt = ticket.createdAt || new Date().toISOString();
    data.tickets.push(ticket);
    await writeDB(data);
    return ticket;
}

// Update ticket
async function updateTicket(channelId, updates) {
    const data = await readDB();
    const index = data.tickets.findIndex(t => t.channelId === channelId);
    if (index !== -1) {
        data.tickets[index] = { ...data.tickets[index], ...updates };
        await writeDB(data);
        return data.tickets[index];
    }
    return null;
}

// Delete ticket
async function deleteTicket(ticketId) {
    const data = await readDB();
    const index = data.tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
        data.tickets.splice(index, 1);
        await writeDB(data);
        return true;
    }
    return false;
}

// Get user open tickets count
async function getUserOpenTicketsCount(userId) {
    const data = await readDB();
    return data.tickets.filter(t => t.creatorId === userId && t.status === 'مفتوحة').length;
}

// Get ticket by channel ID
async function getTicketByChannelId(channelId) {
    const data = await readDB();
    return data.tickets.find(t => t.channelId === channelId);
}

// Add rating
async function addRating(rating) {
    const data = await readDB();
    if (!data.ratings) data.ratings = [];
    rating.timestamp = rating.timestamp || new Date().toISOString();
    data.ratings.push(rating);
    await writeDB(data);
    return rating;
}

// Get all ratings
async function getAllRatings() {
    const data = await readDB();
    return data.ratings || [];
}

// Clear all tickets
async function clearAllTickets() {
    const data = await readDB();
    data.tickets = [];
    data.ticketCounter = 0;
    await writeDB(data);
}

// Get custom buttons
async function getCustomButtons(guildId) {
    const data = await readDB();
    if (!data.customButtons) data.customButtons = [];
    return data.customButtons.filter(b => b.guildId === guildId);
}

// Add custom button
async function addCustomButton(button) {
    const data = await readDB();
    if (!data.customButtons) data.customButtons = [];
    button.id = Date.now().toString();
    button.createdAt = new Date().toISOString();
    data.customButtons.push(button);
    await writeDB(data);
    return button;
}

// Delete custom button
async function deleteCustomButton(buttonId) {
    const data = await readDB();
    if (!data.customButtons) data.customButtons = [];
    const index = data.customButtons.findIndex(b => b.id === buttonId);
    if (index !== -1) {
        data.customButtons.splice(index, 1);
        await writeDB(data);
        return true;
    }
    return false;
}

module.exports = {
    initDatabase,
    getAllTickets,
    getTicketCounter,
    incrementTicketCounter,
    addTicket,
    updateTicket,
    deleteTicket,
    getUserOpenTicketsCount,
    getTicketByChannelId,
    addRating,
    getAllRatings,
    clearAllTickets,
    getCustomButtons,
    addCustomButton,
    deleteCustomButton
};
