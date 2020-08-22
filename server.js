const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || process.env.NODE_PORT || 3000;
const OBSWebSocket = require('obs-websocket-js');
const tmi = require('tmi.js');
const fs = require('fs');

const opts = {
  identity: {
    username: 'ChatbotShadow',
    password: 'oauth:86hmvarktvwna5t29d5z5ocgd7jw4x'
  },
  channels: [
    'SwiftShadow'
  ]
};

const client = new tmi.client(opts);

const obs = new OBSWebSocket();
let obsScenes = [];
let obsSceneNames = [];

// Fall Guys info
let finalLevels = ['Hex-a-gone', 'Fall Mountain', 'Royal Fumble', 'Jump Showdown'];
let stats = {
  'totalWins': 0,
  'sessionAttempts': 0,
  'sessionWins': 0,
  'winRate': "0.00%",
  'winStreak': 0,
  'highWinStreak': 0,
  'eliminations': [0, 0, 0, 0, 0],
  'sessionRounds': 0,
  'teamRounds': 0,
  'teamEliminations': 0,
  'finalStats': []
};
const reducer = (accumulator, currentValue) => accumulator + currentValue;

let insulted = false;
let insults = [
  'Seriously, no wins this stream? None at all?',
  'Really, how is he this bad?',
  "Can't even finish an FF7R run and now this? smh",
  "I bet he doesn't even understand how seesaws work",
  'Sadge fart of Fall Guys',
  'Swift is such a 2Head',
  'Imagine calling yourself the Hexagod and choking this hard Pepega',
  "Why even have a !wins command if it'll always be at 0 LULW",
  'Sorry everyone in chat has to see this disgraceful gameplay PepeHands',
  "I'm sure even Kairi would be more useful on a team than him",
  'SuccShadow coming out in full force today eh SandbagHop'
];
let usedInsults = [];
let emotes = {};
let loadedEmotes = fs.readFileSync('public/emotes.json');
if (loadedEmotes) {
  emotes = JSON.parse(loadedEmotes);
}

// Load stats from JSON if it exists
let loadedStats = fs.readFileSync('public/stats.json');
if (loadedStats) {
  stats = JSON.parse(loadedStats);
} else {
  finalLevels.forEach(level => {
    stats.finalStats.push({
      'name': level,
      'attempts': 0,
      'wins': 0
    });
  });
}

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

// Called every time a message comes in
function onMessageHandler(target, context, msg, self) {
  if (self) {
    return;
  } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!wins') {
    client.say(target, `Swift has won ${stats.sessionWins} games this session! Swift has a total win count of ${stats.totalWins}!`);

    // Chatbot gonna get mean
    let insultChance = Math.floor(Math.random() * 2);
    if (stats.sessionWins === 0 && !insulted && insultChance === 0) {
      let numInsults = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numInsults; i++) {
        let insult;
        do {
          insult = insults[Math.floor(Math.random() * insults.length)];
        } while (usedInsults.includes(insult));
        setTimeout(() => {
          client.say(target, insult);
        }, 3500 * (i + 1));
      }
      insulted = true;
      setTimeout(() => {
        usedInsults = [];
        insulted = false;
      }, 240000);
    }
  } else if (commandName === '!streak') {
    if (stats.winStreak === stats.highWinStreak) {
      client.say(target, `Swift is currently on a win streak of ${stats.winStreak} games! This is the highest streak of this session!`);
    } else {
      client.say(target, `Swift is currently on a win streak of ${stats.winStreak} games! The highest win streak of this session has been ${stats.highWinStreak} games!`);
    }
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

obs.connect({
    address: 'localhost:4444',
    password: 'CleverPassword'
  })
  .then(() => {
    console.log('Connected to OBS');

    return obs.send('GetSceneList');
  })
  .then(data => {
    console.log(`${data.scenes.length} Available Scenes!`);
    obsScenes = data.scenes;

    obsScenes.forEach(scene => {
      obsSceneNames.push(scene.name);
    });
  })
  .catch(err => {
    // Promise convention dicates you have a catch on every chain.
    console.log(err);
  });

obs.on('error', err => {
  console.error('socket error:', err);
});

io.on('connection', (sock) => {
  const socket = sock;

  // Change scene in OBS
  socket.on('changeScene', (scene) => {
    // Make sure we actually have this scene before changing
    if (obsSceneNames.includes(scene)) {
      obs.send('SetCurrentScene', {
        'scene-name': scene
      });
    }
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

  socket.on('resetSession', () => {
    resetSession();
    socket.emit('resetSession', stats);
  });
});

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get('/', (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get('/stats', (req, res) => {
  res.json(stats);
});

app.get('/emotes', (req, res) => {
  res.json(emotes);
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});

function resetSession() {
  stats.sessionAttempts = 0;
  stats.sessionWins = 0;
  stats.winRate = "0.00%";
  stats.winStreak = 0;
  stats.highWinStreak = 0;
  stats.eliminations = [0, 0, 0, 0, 0];
  stats.sessionRounds = 0;
  stats.teamRounds = 0;
  stats.teamEliminations = 0;
  stats.finalStats = [];
  finalLevels.forEach(level => {
    stats.finalStats.push({
      'name': level,
      'attempts': 0,
      'wins': 0
    });
  });

  fs.writeFileSync('public/stats.json', JSON.stringify(stats));
}
