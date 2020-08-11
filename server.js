const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || process.env.NODE_PORT || 3000;
const OBSWebSocket = require('obs-websocket-js');
const tmi = require('tmi.js');

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
let sessionAttempts = 0;
let sessionWins = 0;
let winRate = "0%";
let winStreak = 0;
let highWinStreak = 0;
let eliminations = [0, 0, 0, 0, 0];
let totalRounds = 0;
let teamRounds = 0;
let teamEliminations = 0;
const reducer = (accumulator, currentValue) => accumulator + currentValue;


client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!wins') {
    client.say(target, `I have won ${sessionWins} games this session!`);
  } else if (commandName === '!streak') {
    if (winStreak === highWinStreak) {
      client.say(target, `I am currently on a win streak of ${winStreak} games! This is my highest streak of this session!`);
    } else {
      client.say(target, `I am currently on a win streak of ${winStreak} games! My highest win streak of this session has been ${highWinStreak} games!`);
    }
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
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
    sessionAttempts = data.sessionAttempts;
    sessionWins = data.sessionWins;
    winRate = data.winRate;
    winStreak = data.winStreak;
    highWinStreak = data.highWinStreak;
    eliminations = data.eliminations;
    totalRounds = data.totalRounds;
    teamRounds = data.teamRounds;
    teamEliminations = data.teamEliminations;
    let totalEliminations = eliminations.reduce(reducer);

    console.log('');
    console.log(`Session Attempts: ${sessionAttempts}`);
    console.log(`Session Wins: ${sessionWins}`);
    console.log(`Win Rate: ${winRate}`);
    console.log(`Win Streak: ${winStreak}`);
    console.log(`Highest Win Streak: ${highWinStreak}`);
    console.log(`Eliminations: ${eliminations}`);
    console.log(`Total Rounds: ${totalRounds}`);
    console.log(`Team Eliminations: ${teamEliminations}`);
    console.log(`Team Elim Rate: ${(teamEliminations/totalEliminations) * 100}%`);
  });
});

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});
