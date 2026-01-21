// 1. INITIALISATION (Toujours en premier)
const socket = io();

// 2. VARIABLES D'ÉTAT
let iAmAdmin = false;
let mySongsCount = 0;
let maxSongs = 0;

// 3. NAVIGATION
function showSection(id) {
    const sections = ['section-menu', 'section-lobby', 'section-select', 'section-game', 'section-end'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
}

// 4. ACTIONS UTILISATEUR
function createRoom() {
    const name = document.getElementById('username').value;
    if (name) socket.emit('createRoom', name);
}

function joinRoom() {
    const name = document.getElementById('username').value;
    const code = document.getElementById('roomInput').value;
    if (name && code) socket.emit('joinRoom', { roomId: code, username: name });
}

function launchSelection() {
    const limit = document.getElementById('songsLimit').value;
    socket.emit('startGame', { songsPerPlayer: parseInt(limit) });
}

function resetGame() {
    socket.emit('resetRoom');
}

async function searchMusic() {
    const q = document.getElementById('search').value;
    if (q.length < 3) return;
    
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=5`);
        const data = await res.json();
        const results = document.getElementById('results');
        results.innerHTML = data.results.map(s => `
            <li>
                ${s.trackName} - ${s.artistName} 
                <button onclick="addSong('${s.trackName.replace(/'/g, "\\'")}', '${s.artistName.replace(/'/g, "\\'")}', '${s.previewUrl}')">Ajouter</button>
            </li>
        `).join('');
    } catch (err) {
        console.error("Erreur API:", err);
    }
}

function addSong(title, artist, url) {
    if (mySongsCount < maxSongs) {
        socket.emit('addSong', { title, artist, url });
    }
}

function voteFor(playerId) {
    document.getElementById('playerButtons').innerHTML = "Vote envoyé !";
    socket.emit('submitVote', playerId);
}

// 5. ÉVÉNEMENTS SOCKET
socket.on('initRoom', (data) => {
    iAmAdmin = data.isAdmin;
    showSection('section-lobby');
    document.getElementById('displayRoom').innerText = "Room: " + data.roomId;
    document.getElementById('admin-controls').style.display = iAmAdmin ? 'block' : 'none';
});

socket.on('updatePlayers', (players) => {
    const list = document.getElementById('playerList');
    if (!list) return;
    list.innerHTML = players.map(p => `
        <li>
            ${p.username} (${p.score} pts) ${p.admin ? '👑' : ''}
            ${iAmAdmin && p.id !== socket.id ? `<button onclick="socket.emit('kickPlayer','${p.id}')">Kick</button>` : ''}
        </li>
    `).join('');
});

socket.on('startSelection', (limit) => {
    maxSongs = limit;
    mySongsCount = 0;
    document.getElementById('maxDisplay').innerText = limit;
    document.getElementById('countDisplay').innerText = "0";
    showSection('section-select');
});

socket.on('songAccepted', (count) => {
    mySongsCount = count;
    document.getElementById('countDisplay').innerText = count;
    if (count >= maxSongs) {
        document.getElementById('results').innerHTML = "Attente des autres joueurs...";
        document.getElementById('search').disabled = true;
    }
});

socket.on('playRound', (data) => {
    showSection('section-game');
    const player = document.getElementById('audioPlayer');
    player.src = data.url;
    player.play();

    const btnContainer = document.getElementById('playerButtons');
    btnContainer.innerHTML = data.players
        .filter(p => p.id !== socket.id)
        .map(p => `<button onclick="voteFor('${p.id}')">${p.username}</button>`)
        .join('');
});

socket.on('gameOver', (sorted) => {
    showSection('section-end');
    document.getElementById('finalScores').innerHTML = sorted.map((p, i) => 
        `<li>${i === 0 ? '🥇' : ''} ${p.username}: ${p.score} pts</li>`
    ).join('');
    
    document.getElementById('admin-reset-control').style.display = iAmAdmin ? 'block' : 'none';
    const player = document.getElementById('audioPlayer');
    player.pause();
});

socket.on('roomReseted', () => {
    mySongsCount = 0;
    document.getElementById('search').disabled = false;
    document.getElementById('search').value = "";
    document.getElementById('results').innerHTML = "";
    showSection('section-lobby');
});

socket.on('kicked', () => {
    alert("Vous avez été exclu.");
    location.reload();
});

socket.on('errorMsg', (m) => alert(m));