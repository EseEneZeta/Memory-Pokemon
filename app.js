const firebaseURL = ''

// Referencia a elementos del DOM
const gameForm = document.getElementById('game-form');
const cardsInput = document.getElementById('cards-number');
const gameBoard = document.getElementById('game-board');
const playBtn = document.getElementById('play-btn');
const timerElement = document.getElementById('timer');
const modal = document.getElementById('modal');

// Variables globales
let timerInterval;
let flippedCards = [];
let matchedPairs = 0;

// Referencia al cuerpo de la tabla de ranking
const rankingBody = document.getElementById('ranking-body');

// Función para convertir el tiempo del formato "Xm Ys" a segundos
function parseTime(time) {
  const [minutes, seconds] = time.split(' ').map((t) => parseInt(t, 10));
  return minutes * 60 + seconds;
}

let endGame = false;

// Funció per sanejar claus amb caràcters prohibits
function sanitizeEmail(email) {
  return email.replace(/[@.$[\]]/g, '_');
}

// Función para mostrar un mensaje en el modal
function showModal(message) {
  modal.textContent = message;
  modal.showModal();
  setTimeout(() => modal.close(), 3000);
}

// Función para iniciar el temporizador
function startTimer() {
  let seconds = 0;
  timerElement.textContent = '0m 0s';

  timerInterval = setInterval(() => {
    seconds += 1;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timerElement.textContent = `${minutes}m ${remainingSeconds}s`;
  }, 1000);
}

// Función para detener el temporizador
function stopTimer() {
  clearInterval(timerInterval);
}

// Función para obtener cartas de la API de Pokémon
async function fetchPokemonCards(count) {
  const maxPokemonId = 151;
  // eslint-disable-next-line max-len
  const selectedIds = Array.from({ length: count / 2 }, () => Math.floor(Math.random() * maxPokemonId) + 1);

  const pokemonPromises = selectedIds.map((id) => fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then((res) => res.json()));

  const pokemons = await Promise.all(pokemonPromises);
  return pokemons.flatMap((pokemon) => [
    { id: pokemon.id, image: pokemon.sprites.front_default },
    { id: pokemon.id, image: pokemon.sprites.front_default },
  ]);
}

// Función para barajar las cartas
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function destacarUsuarioEnRanking(userId) {
  const filaUsuario = document.querySelector(`#ranking-body tr[data-id="${userId}"]`);

  if (filaUsuario) {
    filaUsuario.classList.add('highlight');
  }
}

// Función para renderizar el ranking en la tabla
function renderRanking(ranking) {
  rankingBody.innerHTML = '';

  ranking.forEach((record, index) => {
    if (record === '...') {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = '...';
      row.appendChild(cell);
      rankingBody.appendChild(row);
      return;
    }

    const row = document.createElement('tr');
    row.setAttribute('data-id', record.username);
    const positionCell = document.createElement('td');
    positionCell.textContent = index + 1;

    const usernameCell = document.createElement('td');
    usernameCell.textContent = record.username;

    const emailCell = document.createElement('td');
    emailCell.textContent = record.email;

    const timeCell = document.createElement('td');
    timeCell.textContent = record.time;

    const cardsCell = document.createElement('td');
    cardsCell.textContent = record.cards;

    row.append(positionCell, usernameCell, emailCell, timeCell, cardsCell);
    rankingBody.appendChild(row);
  });
  if (endGame) {
    const currentUserId = sessionStorage.getItem('user');
    if (currentUserId) {
      destacarUsuarioEnRanking(currentUserId);
    }
  }
}

// Función para obtener los datos del ranking desde Firebase
async function fetchRanking() {
  const response = await fetch('https://ejercicioajax-default-rtdb.europe-west1.firebasedatabase.app/ranking.json');
  const data = await response.json();

  if (!data) return [];

  return Object.entries(data).map(([id, record]) => ({
    id,
    ...record,
  }));
}

// Función para ordenar y mostrar el ranking
async function updateRanking() {
  const ranking = await fetchRanking();

  const currentUserId = sessionStorage.getItem('user');

  ranking.sort((a, b) => {
    if (b.cards !== a.cards) return b.cards - a.cards;
    return parseTime(a.time) - parseTime(b.time);
  });

  const recentGameIndex = ranking.findIndex((record) => record.id === currentUserId);

  renderRanking(ranking, recentGameIndex);
}

// Función para guardar el resultado de la partida en Firebase
async function saveGameResult() {
  const username = sessionStorage.getItem('user');
  const time = timerElement.textContent;
  const email = document.getElementById('email').value;
  const cards = gameBoard.childElementCount;
  endGame = true;

  playBtn.disabled = false;

  await fetch('https://ejercicioajax-default-rtdb.europe-west1.firebasedatabase.app/ranking.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      time,
      cards,
    }),
  });
  updateRanking();
}

let isCheckingMatch = false;
let cardsFlipped = 0;

function checkForMatch() {
  const [firstCard, secondCard] = flippedCards;

  if (firstCard.id === secondCard.id) {
    firstCard.element.classList.add('matched');
    secondCard.element.classList.add('matched');
    matchedPairs += 1;
    flippedCards = [];
    isCheckingMatch = false;
    cardsFlipped = 0;
    if (matchedPairs === gameBoard.childElementCount / 2) {
      stopTimer();
      showModal('¡Has ganado!');
      saveGameResult();
    }
  } else {
    setTimeout(() => {
      firstCard.element.style.backgroundImage = 'url("img/card-back.png")';
      secondCard.element.style.backgroundImage = 'url("img/card-back.png")';
      firstCard.element.classList.remove('flipped');
      secondCard.element.classList.remove('flipped');
      flippedCards = [];
      isCheckingMatch = false;
      cardsFlipped = 0;
    }, 1000);
  }
}

function flipCard(cardElement, card) {
  if (isCheckingMatch || cardsFlipped === 2) {
    return;
  }

  cardsFlipped += 1;
  const element = cardElement;

  // Voltear la carta
  element.style.backgroundImage = `url("${card.image}")`;
  element.classList.add('flipped');
  flippedCards.push({ element, id: card.id });

  if (cardsFlipped === 2) {
    isCheckingMatch = true;
    checkForMatch();
  }
}

// Función para crear el tablero del juego
async function createGameBoard(cardsCount) {
  gameBoard.innerHTML = '';
  const cards = shuffle(await fetchPokemonCards(cardsCount));

  cards.forEach((card) => {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    cardElement.dataset.id = card.id;
    cardElement.style.backgroundImage = 'url("img/card-back.png")';

    cardElement.addEventListener('click', () => flipCard(cardElement, card));
    gameBoard.appendChild(cardElement);
  });
}

// Funció per gestionar l'usuari
async function gestionarUsuari(email, username) {
  const sanitizedEmail = sanitizeEmail(email);

  const response = await fetch(`${firebaseURL}/usuarios/${sanitizedEmail}.json`);
  if (!response.ok) {
    throw new Error('Error al consultar la base de dades');
  }

  const userData = await response.json();

  if (userData) {
    const updateResponse = await fetch(`${firebaseURL}/usuarios/${sanitizedEmail}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!updateResponse.ok) {
      throw new Error("Error al actualitzar l'usuari existent");
    }
  } else {
    const newUser = {
      email,
      username,
      createdAt: new Date().toISOString(),
    };

    const createResponse = await fetch(`${firebaseURL}/usuarios/${sanitizedEmail}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });

    if (!createResponse.ok) {
      throw new Error('Error al crear un nou usuari');
    }a
  }
}

// Evento para manejar el formulario del juego
gameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const cardsCount = parseInt(cardsInput.value, 10);

  if (Number.isNaN(cardsCount) || cardsCount <= 0 || cardsCount % 2 !== 0) {
    showModal('Por favor, introduce un número entero, positivo y par.');
    return;
  }

  playBtn.disabled = true;

  stopTimer();
  matchedPairs = 0;
  flippedCards = [];
  await createGameBoard(cardsCount);
  startTimer();
  playBtn.textContent = 'Volver a jugar';
});

function reloadPage() {
  window.location.reload();
}

// Captura de l'enviament del formulari
// Modifica el event listener del formulario de registro así:
document.getElementById('user-form').addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;

  gestionarUsuari(email, username);
  sessionStorage.setItem('user', username);

  // Ocultar pantalla de registro
  document.getElementById('auth-container').classList.add('hidden');
  
  // Mostrar animación de bienvenida
  const welcomeElement = document.getElementById('welcome');
  welcomeElement.classList.remove('hidden');
  
  setTimeout(() => {
    welcomeElement.classList.add('hidden');
    
    // Mostrar contenedor principal del juego
    const gameContainer = document.getElementById('game-container');
    gameContainer.classList.remove('hidden');
    
    // Mostrar juego dentro del contenedor
    const gameElement = document.getElementById('game');
    gameElement.classList.remove('hidden');
    gameElement.classList.add('flex');
    
    updateRanking();
  }, 2000); // Ajustamos el tiempo para la animación
});

// Y modifica el logout así:
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('user');
  // Ocultar juego y mostrar registro
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('hidden');
  reloadPage();
});

// Botón para cerrar sesión
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('user');
  reloadPage();
});
