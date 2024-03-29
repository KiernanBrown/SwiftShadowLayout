const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || process.env.NODE_PORT || 3000;
const OBSWebSocket = require('obs-websocket-js');
const tmi = require('tmi.js');
const fs = require('fs');
const {
  chatbotPassword,
  spotifyClientID,
  spotifyClientSecret,
} = require('./config.json');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const Spotify = require('spotify-web-api-node');
const fetch = require('node-fetch');
const btoa = require('btoa');
const { json } = require('express');
const LiveSplitClient = require('livesplit-client');

let socket;
let fallGuys = false;
let song = {};
let freeRolls = [];

let livesplitPort = 16834;
let lsConnected = false;
let timerPhase = '';
let splitIndex = -1;

let pollingTime = 0.5; // Time in seconds between updates from LiveSplit
let pollingInterval;
let lsClient;

const spotifyApi = new Spotify({
  clientId: spotifyClientID,
  clientSecret: spotifyClientSecret,
  redirectUri: 'http://localhost:3000/spotify/callback',
});

let spotifyAccessToken;
let spotifyRefreshToken;

const opts = {
  identity: {
    username: 'ChatbotShadow',
    password: chatbotPassword,
  },
  channels: ['SwiftShadow'],
};

const client = new tmi.client(opts);

const obs = new OBSWebSocket();
let obsScenes = [];
let obsSceneNames = [];

// Fall Guys info
let finalLevels = [
  'Hex-a-gone',
  'Fall Mountain',
  'Royal Fumble',
  'Jump Showdown',
];
let stats = {
  totalWins: 0,
  sessionAttempts: 0,
  sessionWins: 0,
  winRate: '0.00%',
  winStreak: 0,
  highWinStreak: 0,
  eliminations: [0, 0, 0, 0, 0],
  sessionRounds: 0,
  teamRounds: 0,
  teamEliminations: 0,
  finalStats: [],
};
const reducer = (accumulator, currentValue) => accumulator + currentValue;

let emotes = {};
let loadedEmotes = fs.readFileSync('public/emotes.json');
if (loadedEmotes) {
  emotes = JSON.parse(loadedEmotes);
}

let songs = [];
let loadedSongs = fs.readFileSync('public/songs.json');
if (loadedSongs) {
  songs = JSON.parse(loadedSongs);
}

// Load stats from JSON if it exists
let loadedStats = fs.readFileSync('public/stats.json');
if (loadedStats) {
  stats = JSON.parse(loadedStats);
} else {
  finalLevels.forEach((level) => {
    stats.finalStats.push({
      name: level,
      attempts: 0,
      wins: 0,
    });
  });
}

// Gnosia info
let gnosiaStats = {};
let loadedGStats = fs.readFileSync('public/gnosia.json');
if (loadedGStats) {
  gnosiaStats = JSON.parse(loadedGStats);
}

process.on('uncaughtException', function (err) {
  console.error(err);
  console.log('Node NOT Exiting...');
});

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

// Spotify-Passport
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(
  new SpotifyStrategy(
    {
      clientID: spotifyClientID,
      clientSecret: spotifyClientSecret,
      callbackURL: 'http://localhost:3000/spotify/callback',
    },
    function (accessToken, refreshToken, expires_in, profile, done) {
      spotifyAccessToken = accessToken;
      spotifyRefreshToken = refreshToken;
      spotifyApi.setAccessToken(spotifyAccessToken);
      setInterval(() => {
        spotifyRefresh();
      }, 3550000);
      return done(null, profile);
    }
  )
);

const spotifyRefresh = () => {
  fetch('https://accounts.spotify.com/api/token', {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' + btoa(`${spotifyClientID}:${spotifyClientSecret}`),
      Accept: 'application/json',
    },
    body: `grant_type=refresh_token&refresh_token=${spotifyRefreshToken}`,
  }).then((res) => {
    res.json().then((data) => {
      spotifyAccessToken = data.access_token;
      spotifyApi.setAccessToken(spotifyAccessToken);
    });
  });
};

// Called every time a message comes in
function onMessageHandler(target, context, msg, self) {
  if (self) {
    return;
  } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim().toLowerCase();

  // If the command is known, let's execute it
  if (commandName === '!wins' && fallGuys) {
    client.say(
      target,
      `Swift has won ${stats.sessionWins} games this session! Swift has a total win count of ${stats.totalWins}!`
    );
  } else if (commandName === '!streak' && fallGuys) {
    if (stats.winStreak === stats.highWinStreak) {
      client.say(
        target,
        `Swift is currently on a win streak of ${stats.winStreak} games! This is the highest streak of this session!`
      );
    } else {
      client.say(
        target,
        `Swift is currently on a win streak of ${stats.winStreak} games! The highest win streak of this session has been ${stats.highWinStreak} games!`
      );
    }
  } else if (commandName === '!song') {
    if (song.name && song.game) {
      client.say(target, `The current song is ${song.name} from ${song.game}`);
    } else if (song.name) {
      client.say(target, `The current song is ${song.name}`);
    } else {
      client.say(target, 'No song is currently playing!');
    }
  } /*else if (commandName === '!roll') {
    if (freeRolls.includes(context['user-id'])) {
      freeRolls.splice(freeRolls.indexOf(context['user-id']), 1);
      let remaining = freeRolls.reduce(
        (a, v) => (v === context['user-id'] ? a + 1 : a),
        0
      );
      client.say(
        target,
        `You're using 1 of your free rolls ${context['display-name']}! You have ${remaining} free rolls remaining!`
      );

      // Roll the dice for user
      socket.emit('diceRoll', {
        display_name: context['display-name'],
        id: context['user-id'],
      });
    } else {
      client.say(
        target,
        `Sorry ${context['display-name']}, you don't have any free dice rolls to use! You can earn some from the Roll The Dice channel point reward if you're lucky!`
      );
    }
  } */ else if (commandName === '!luck') {
    //luckTime({});
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

const updateSong = () => {
  if (spotifyAccessToken) {
    spotifyApi.getMyCurrentPlayingTrack().then(
      (data) => {
        if (data.body) {
          if (!data.body.is_playing) {
            song = {};
            obs
              .send('SetSceneItemRender', {
                source: 'Music',
                render: false,
              })
              .catch((err) => {
                console.error(err);
              });

            obs
              .send('SetSceneItemRender', {
                source: 'swifts7Jam',
                render: false,
              })
              .catch((err) => {
                console.error(err);
              });
          } else {
            let artist = [];
            data.body.item.artists.forEach((art) => {
              artist.push(art.name);
            });
            let newSong = {
              name: data.body.item.name,
              artist: artist.join(', '),
            };

            // Try to find the game the song is from
            for (let g of songs) {
              let foundSong = g.songs.find((s) => {
                return s.toLowerCase() === newSong.name.toLowerCase();
              });
              if (foundSong) {
                newSong.game = g.game;
                break;
              }
            }

            if (newSong.name != song.name || newSong.artist != song.artist) {
              song = newSong;

              // Update song information in OBS
              obs
                .send('SetSceneItemRender', {
                  source: 'Music',
                  render: true,
                })
                .catch((err) => {
                  console.error(err);
                });

              obs
                .send('SetSceneItemRender', {
                  source: 'swifts7Jam',
                  render: true,
                })
                .catch((err) => {
                  console.error(err);
                });

              obs
                .send('SetTextGDIPlusProperties', {
                  source: 'Music',
                  text: song.name,
                })
                .catch((err) => {
                  console.error(err);
                });
            }
          }
        } else {
          song = {};
        }
      },
      (err) => {
        console.log(err);
      }
    );
  }
};

const diceRoll = (data) => {
  if (data.roll === 1) {
    client.say(
      '#swiftshadow',
      `Sorry ${data.user.display_name}, a 1 means you're getting timed out for a day! If you have any last words, get them in before Swift or a mod times you out.`
    );
  } else if (data.roll === 2) {
    client.say(
      '#swiftshadow',
      'A 2 gets you a free design from Thom!! Check your whispers for more information and a form for you to fill out!'
    );
    client.whisper(
      data.user.display_name,
      'Fill out this form to give Thom information about the design you want! https://forms.gle/aexfeV6KXCquEJPGA'
    );
  } else if (data.roll === 7) {
    client.say(
      '#swiftshadow',
      `${data.user.display_name}, a 7 gets you 3 free dice rolls! You can use !roll to use those!`
    );
    for (let i = 0; i < 3; i++) {
      freeRolls.push(data.user.id);
    }
  } else if (data.roll === 19) {
    client.say(
      '#swiftshadow',
      `Congrats ${data.user.display_name}, a 19 gets you a gifted sub!`
    );
  } else if (data.roll === 20) {
    client.say(
      '#swiftshadow',
      `Incredible ${data.user.display_name}, you got a 20!!! Use !d20 to see what rewards you can pick from as a result of your amazing luck!`
    );
  } else {
    client.say(
      '#swiftshadow',
      `A ${data.roll}! Too bad ${data.user.display_name}... Maybe you'll have better luck next time!`
    );
  }
};

const luckTime = (data) => {
  let luckDate = data.time + data.interval;
  let dateDif = Math.round((luckDate - Date.now()) / 1000);
  if (dateDif > 60) {
    dateDif = Math.round(dateDif / 60);
    if (data.cause === 'reward') {
      client.say(
        '#swiftshadow',
        `Sorry ${data.user}, you've already given luck! You can give luck again in ${dateDif} minutes!`
      );
    } else {
      client.say(
        '#swiftshadow',
        `${data.user}, you can give luck again in ${dateDif} minutes!`
      );
    }
  } else {
    if (data.cause === 'reward') {
      client.say(
        '#swiftshadow',
        `Sorry ${data.user}, you've already given luck! You can give luck again in ${dateDif} seconds!`
      );
    } else {
      client.say(
        '#swiftshadow',
        `${data.user}, you can give luck again in ${dateDif} seconds!`
      );
    }
  }
};

// Function to connect to LiveSplit Server
const lsConnect = async () => {
  console.dir('in ls connect');
  if (!lsConnected) {
    try {
      console.dir('trying to connect');
      // Initialize client with LiveSplit Server's IP:PORT
      lsClient = new LiveSplitClient(`127.0.0.1:${livesplitPort}`);

      // Connected event
      lsClient.on('connected', () => {
        console.log('Connected!');
        lsConnected = true;
        socket.emit('lsConnect', lsConnected);

        // Poll for updates
        pollingInterval = setInterval(lsPoll, pollingTime * 1000);
      });

      // Disconnected event
      lsClient.on('disconnected', () => {
        console.log('Disconnected!');
        lsConnected = false;
        socket.emit('lsConnect', lsConnected);

        clearInterval(pollingInterval);
      });

      // Connect to the server, Promise will be resolved when the connection will be succesfully established
      await lsClient.connect();
    } catch (err) {
      console.dir(err); // Something went wrong
    }
  } else {
    socket.emit('lsConnect', lsConnected);
  }
};

// Function used when polling LiveSplit for updates
const lsPoll = async () => {
  let phase = await lsClient.getCurrentTimerPhase();

  if (phase != timerPhase) {
    if (phase === 'NotRunning') {
      if (timerPhase === 'Running') {
        // Reset
        splitIndex = -1;
        socket.emit('reset');
      }
    } else if (phase === 'Running' && timerPhase === 'NotRunning') {
      // Start of a run
      socket.emit('start');
    } else if (phase === 'Running' && timerPhase === 'Ended') {
      // Runner finished and then undid the last split
      // We should get rid of the finish animation and handle split
    } else if (phase === 'Ended') {
      // End of run
      socket.emit('end');
    }

    // Update our timerPhase
    timerPhase = phase;
  }

  // Only check for splits if the timer is Running
  if (timerPhase != 'Running') {
    return;
  }

  let index = await lsClient.getSplitIndex();

  // Compare the current and previous splitIndex
  if (index != splitIndex) {
    if (index > splitIndex && index > 0) {
      // A split has occurred since last update
      let d = await lsClient.getDelta();
      let sobD = await lsClient.getDelta('Best Segments');

      // Create an object for the split that occurred
      let split = await lsClient.getPreviousSplitname();

      // Have the client handle the split
      socket.emit('split', split);
    }

    // Update the splitIndex
    splitIndex = index;
  }
};

obs
  .connect({
    address: 'localhost:4444',
    password: 'CleverPassword',
  })
  .then(() => {
    console.log('Connected to OBS');

    return obs.send('GetSceneList');
  })
  .then((data) => {
    console.log(`${data.scenes.length} Available Scenes!`);
    obsScenes = data.scenes;

    obsScenes.forEach((scene) => {
      obsSceneNames.push(scene.name);
    });
  })
  .catch((err) => {
    // Promise convention dicates you have a catch on every chain.
    console.log(err);
  });

obs.on('error', (err) => {
  console.error('socket error:', err);
});

io.on('connection', (sock) => {
  socket = sock;

  socket.on('lsConnect', () => {
    lsConnect();
  });

  // Toggle Webcam in OBS
  socket.on('toggleSource', (data) => {
    obs.send('GetCurrentScene').then((scene) => {
      let webcamItem = scene.sources.find((item) => item.name === 'OverlayCam');
      if (webcamItem) {
        obs.send('SetSceneItemRender', {
          source: data.source,
          render: data.visible,
        });
      }
    });
  });

  // Change scene in OBS
  socket.on('changeScene', (scene) => {
    // Make sure we actually have this scene before changing
    if (obsSceneNames.includes(scene)) {
      obs.send('SetCurrentScene', {
        'scene-name': scene,
      });
    }
  });

  socket.on('diceRoll', (data) => {
    diceRoll(data);
  });
  socket.on('luckTime', (data) => {
    luckTime(data);
  });

  // Update Fall Guys info
  socket.on('updateFGInfo', (data) => {
    stats = data;

    fs.writeFileSync('public/stats.json', JSON.stringify(stats));

    console.log('');
    console.log(`Total Wins: ${stats.totalWins}`);
    console.log(`Session Attempts: ${stats.sessionAttempts}`);
    console.log(`Session Wins: ${stats.sessionWins}`);
    console.log(`Win Rate: ${stats.winRate}`);
    console.log(`Win Streak: ${stats.winStreak}`);
    console.log(`Highest Win Streak: ${stats.highWinStreak}`);
    console.log(`Eliminations: ${stats.eliminations}`);
    console.log(`Session Rounds: ${stats.sessionRounds}`);
    console.log(stats.finalStats);
  });

  // Update Gnosia info
  /*socket.on('updateFGInfo', (data) => {
    gnosiaStats = data;
  
    fs.writeFileSync('public/gnosia.json', JSON.stringify(gnosiaStats));
  });*/

  socket.on('resetSession', () => {
    resetSession();
    socket.emit('resetSession', stats);
  });

  socket.on('skipSong', () => {
    spotifyApi.skipToNext().then(
      (data) => {
        setTimeout(() => {
          updateSong();
        }, 100);
      },
      (err) => {
        console.log(err);
      }
    );
  });

  socket.on('backSong', () => {
    spotifyApi.skipToPrevious().then(
      (data) => {
        setTimeout(() => {
          updateSong();
        }, 100);
      },
      (err) => {
        console.log(err);
      }
    );
  });

  // Pokemon sockets
  socket.on('togglePokemon', (data) => {
    obs
      .send('GetCurrentScene')
      .then((scene) => {
        let pkmnTracker = scene.sources.find(
          (item) => item.name === `${data.pokemon} Tracker`
        );
        if (pkmnTracker) {
          obs
            .send('SetSceneItemRender', {
              source: pkmnTracker.name,
              render: data.visible,
            })
            .catch((err) => {
              console.error(err);
            });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });
});

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

app.use(passport.initialize());
app.use(passport.session());

// https://expressjs.com/en/starter/basic-routing.html
app.get('/', (request, response) => {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/stats', (req, res) => {
  res.json(stats);
});

app.get('/emotes', (req, res) => {
  res.json(emotes);
});

app.get('/gnosia', (req, res) => {
  loadedGStats = fs.readFileSync('public/gnosia.json');
  if (loadedGStats) {
    gnosiaStats = JSON.parse(loadedGStats);
  }

  res.json(gnosiaStats);
});

app.get(
  '/spotify',
  passport.authenticate('spotify', {
    scope: [
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
    ],
    showDialog: true,
  })
);

app.get(
  '/spotify/callback',
  passport.authenticate('spotify', {
    failureRedirect: '/login',
  }),
  function (req, res) {
    updateSong();
    res.redirect('/');
  }
);

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});

// Check for song updates every 5 seconds
updateSong();
setInterval(() => {
  updateSong();
}, 5000);

function resetSession() {
  stats.sessionAttempts = 0;
  stats.sessionWins = 0;
  stats.winRate = '0.00%';
  stats.winStreak = 0;
  stats.highWinStreak = 0;
  stats.eliminations = [0, 0, 0, 0, 0];
  stats.sessionRounds = 0;
  stats.teamRounds = 0;
  stats.teamEliminations = 0;
  stats.finalStats = [];
  finalLevels.forEach((level) => {
    stats.finalStats.push({
      name: level,
      attempts: 0,
      wins: 0,
    });
  });

  fs.writeFileSync('public/stats.json', JSON.stringify(stats));
}
