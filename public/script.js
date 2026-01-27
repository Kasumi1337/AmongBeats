// 1. INITIALISATION (Toujours en premier)
const socket = io();

// 2. VARIABLES D'ÉTAT
let iAmAdmin = false;
let mySongsCount = 0;
let maxSongs = 0;
let PlayerNumber = 0;
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
    const limit = 3
    socket.emit('startGame', { songsPerPlayer: parseInt(limit) });
}

function resetGame() {
    socket.emit('resetRoom');
}

function resetAdmin()
{
    if(data.isAdmin)
    {
        document.getElementById('wait_btn').style.display = "none";
        document.getElementById('start_btn').display = "block";
    }
}

async function searchMusic() {
    const q = document.getElementById('search').value;
    if (q.length < 3) return;
    
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=15`);
        const data = await res.json();
        const results = document.getElementById('results');
        results.innerHTML = data.results.map(s => `
            <li  onclick="addSong('${s.trackName.replace(/'/g, "\\'")}', '${s.artistName.replace(/'/g, "\\'")}', '${s.previewUrl}')" class="song-card">
                <img src="${s.artworkUrl100}">

                <h3> ${s.trackName} <br> ${s.artistName} </h3>
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

var pfp_count = 1;

function changePfpLeft() {
    if (pfp_count > 1)
        pfp_count -= 1;
    else
        pfp_count = 7;
    document.getElementById("pp").src = `./assets/icon/icon${pfp_count}.svg`
}

function changePfpRight() {
    if (pfp_count < 7)
        pfp_count += 1;
    else
        pfp_count = 1;
    document.getElementById("pp").src = `./assets/icon/icon${pfp_count}.svg`
}


function copy() {
    navigator.clipboard .writeText(document.getElementById('displayRoom').innerText.slice(6))
    alert(document.getElementById('displayRoom').innerText.slice(6) + " copied")
}

// 5. ÉVÉNEMENTS SOCKET
socket.on('initRoom', (data) => {
    iAmAdmin = data.isAdmin;
    showSection('section-lobby');
    document.getElementById('displayRoom').innerText = "Room: " + data.roomId;
    document.getElementById('displayRoom').onclick = "copy()"
});

socket.on('updatePlayers', (players) => {
    PlayerNumber += 1;
    console.log(PlayerNumber)
    const list = document.getElementById('playerList');
    if (!list) return;
    list.innerHTML = players.map(p => `
        <li>
            ${p.username} (${p.score} pts) ${p.admin ? '👑' : ''}
            ${iAmAdmin && p.id !== socket.id ? `<button style="cursor: pointer;" onclick="socket.emit('kickPlayer','${p.id}')">X</button>` : ''}
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
    if (count >= 3) {
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

socket.on('OwnSong', () => {

})

socket.on('kicked', () => {
    alert("Vous avez été exclu.");
    location.reload();
});

socket.on('errorMsg', (m) => alert(m));