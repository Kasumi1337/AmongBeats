const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Stockage des données des salons
const rooms = {};

io.on('connection', (socket) => {
    console.log('Connexion : ' + socket.id);

    // --- UTILITAIRES ---
    const getRoomId = (s) => Array.from(s.rooms)[1];
    
    const checkAdmin = (s, rId) => {
        return rooms[rId] && rooms[rId].players.find(p => p.id === s.id && p.admin);
    };

    // --- LOGIQUE DE SALON ---

    socket.on('createRoom', (username) => {
        const roomId = Math.random().toString(36).substring(7).toUpperCase();
        rooms[roomId] = { 
            players: [], 
            settings: { songsPerPlayer: 2 }, 
            state: 'LOBBY', 
            playlist: [], 
            currentSong: null 
        };
        joinRoom(socket, roomId, username);
    });

    socket.on('joinRoom', ({ roomId, username }) => {
        const id = roomId.toUpperCase();
        if (rooms[id]) {
            if (rooms[id].state !== 'LOBBY') {
                return socket.emit('errorMsg', 'La partie a déjà commencé.');
            }
            joinRoom(socket, id, username);
        } else {
            socket.emit('errorMsg', 'Code de salle invalide.');
        }
    });

    function joinRoom(socket, roomId, username) {
        socket.join(roomId);
        // Le premier joueur devient admin
        const isAdmin = rooms[roomId].players.length === 0;
        
        const newPlayer = { 
            id: socket.id, 
            username: username, 
            admin: isAdmin, 
            songs: [], 
            score: 0 
        };
        
        rooms[roomId].players.push(newPlayer);
        
        socket.emit('initRoom', { roomId, isAdmin });
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
    }

    // --- LOGIQUE DE JEU ---

    socket.on('startGame', (settings) => {
        const roomId = getRoomId(socket);
        if (checkAdmin(socket, roomId)) {
            rooms[roomId].settings = settings;
            rooms[roomId].state = 'SELECTING';
            io.to(roomId).emit('startSelection', settings.songsPerPlayer);
        }
    });

    socket.on('addSong', (song) => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && player.songs.length < room.settings.songsPerPlayer) {
            // On enregistre qui a envoyé la musique (ownerId)
            player.songs.push({ ...song, ownerId: socket.id });
            socket.emit('songAccepted', player.songs.length);

            // Vérifier si tout le monde est prêt
            const allReady = room.players.every(p => p.songs.length >= room.settings.songsPerPlayer);
            if (allReady) {
                startNewRound(roomId);
            }
        }
    });

    function startNewRound(roomId) {
        const room = rooms[roomId];
        if (!room) return;

        // Initialisation de la playlist au début du jeu
        if (room.state === 'SELECTING') {
            room.state = 'PLAYING';
            room.playlist = room.players.flatMap(p => p.songs).sort(() => Math.random() - 0.5);
        }

        if (room.playlist.length > 0) {
            room.currentSong = room.playlist.pop();
            io.to(roomId).emit('playRound', { 
                url: room.currentSong.url, 
                players: room.players.map(p => ({ id: p.id, username: p.username })) 
            });
        } else {
            room.state = 'FINISHED';
            io.to(roomId).emit('gameOver', room.players.sort((a,b) => b.score - a.score));
        }
    }

    socket.on('submitVote', (votedId) => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (!room || room.state !== 'PLAYING') return;

        // Attribution des points si le vote est correct
        if (room.currentSong && votedId === room.currentSong.ownerId) {
            const voter = room.players.find(p => p.id === socket.id);
            if (voter) voter.score += 10;
        }

        // On renvoie les scores à tout le monde
        io.to(roomId).emit('updatePlayers', room.players);
        
        // Petit délai pour voir les scores avant la musique suivante
        // On vérifie que le timer n'est pas lancé plusieurs fois par round
        if (!room.roundTimeout) {
            room.roundTimeout = setTimeout(() => {
                room.roundTimeout = null;
                startNewRound(roomId);
            }, 5000); 
        }
    });

    // --- GESTION ADMIN (KICK & RESET) ---

    socket.on('kickPlayer', (playerId) => {
        const roomId = getRoomId(socket);
        if (checkAdmin(socket, roomId)) {
            const target = io.sockets.sockets.get(playerId);
            if (target) {
                target.emit('kicked');
                target.leave(roomId);
                rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== playerId);
                io.to(roomId).emit('updatePlayers', rooms[roomId].players);
            }
        }
    });

    socket.on('resetRoom', () => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (room && checkAdmin(socket, roomId)) {
            room.state = 'LOBBY';
            room.playlist = [];
            room.currentSong = null;
            if(room.roundTimeout) clearTimeout(room.roundTimeout);
            room.roundTimeout = null;

            // Reset individuel des joueurs
            room.players.forEach(p => { 
                p.score = 0; 
                p.songs = []; 
            });

            io.to(roomId).emit('roomReseted');
            io.to(roomId).emit('updatePlayers', room.players);
        }
    });

    // --- DECONNEXION ---
    socket.on('disconnecting', () => {
        socket.rooms.forEach(id => {
            if (rooms[id]) {
                rooms[id].players = rooms[id].players.filter(p => p.id !== socket.id);
                
                // Si la room est vide, on la supprime
                if (rooms[id].players.length === 0) {
                    delete rooms[id];
                } else {
                    // Si l'admin est parti, on nomme un nouvel admin
                    if (!rooms[id].players.some(p => p.admin)) {
                        rooms[id].players[0].admin = true;
                    }
                    io.to(id).emit('updatePlayers', rooms[id].players);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));