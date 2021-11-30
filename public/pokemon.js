// Pokemon info
let starterPokemon = 'Piplup';
let trackedPokemon = [starterPokemon];
let additionalPokemon = [
  {
    name: 'Scyther',
    split: 'Scyther',
  },
  {
    name: 'Dialga',
    split: 'Dialga',
  },
];
let trackerStarted = false;
let trackerInterval;
let trackerIntervalTime = 10 * 1000;
//let trackerChangeTime = 0.5 * 1000;
let trackerIndex = 0;
let socket;

const initPokemonSocket = (sock) => {
  socket = sock;
};

const addTrackedPokemonBySplit = (split) => {
  let newPKMN = additionalPokemon.find((pkmn) => {
    return pkmn.split.toLowerCase() === split.toLowerCase();
  });

  if (newPKMN) {
    trackedPokemon.push(newPKMN.name);
    if (!trackerStarted) {
      trackerStarted = true;
      trackerInterval = setInterval(() => {
        updateTracker();
      }, trackerIntervalTime);
    }
  }
};

const addTrackedPokemonByName = (pkmn) => {
  trackedPokemon.push(pkmn);
  if (!trackerStarted) {
    trackerStarted = true;
    trackerInterval = setInterval(() => {
      updateTracker();
    }, trackerIntervalTime);
  }
};

const updateTracker = () => {
  console.dir('Updating tracker');
  if (trackedPokemon.length > 1) {
    // Update trackerIndex
    let prevTrackerIndex = trackerIndex;
    trackerIndex =
      trackerIndex + 1 >= trackedPokemon.length ? 0 : trackerIndex + 1;

    socket.emit('togglePokemon', {
      pokemon: trackedPokemon[prevTrackerIndex],
      visible: false,
    });
    socket.emit('togglePokemon', {
      pokemon: trackedPokemon[trackerIndex],
      visible: true,
    });
  }
};

const resetTracker = () => {
  console.dir('Resetting tracker');
  for (let pkmn of trackedPokemon) {
    if (pkmn != starterPokemon) {
      socket.emit('togglePokemon', {
        pokemon: pkmn,
        visible: false,
      });
    }
  }
  trackedPokemon = [starterPokemon];
  trackerStarted = false;
  trackerIndex = 0;
  clearInterval(trackerInterval);
  socket.emit('togglePokemon', {
    pokemon: starterPokemon,
    visible: true,
  });
};

//export default Pokemon;
export { addTrackedPokemonBySplit, resetTracker, initPokemonSocket };
