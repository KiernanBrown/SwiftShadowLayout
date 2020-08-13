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
let totalWins = 40;
let sessionAttempts = 0;
let sessionWins = 0;
let winRate = "0%";
let winStreak = 0;
let highWinStreak = 0;
let eliminations = [0, 0, 0, 0, 0, 0];
let sessionRounds = 0;
let teamRounds = 0;
let teamEliminations = 0;
const reducer = (accumulator, currentValue) => accumulator + currentValue;

let insulted = false;
let insults = [
  'Seriously, no wins? None at all?',
  'Really, how is he this bad?',
  "Can't even finish an FF7R run and now this? smh",
  "I bet he doesn't even understand how seesaws work",
  'Sadge fart of Fall Guys',
  'Swift is such a 2Head',
  'Imagine calling yourself the Hexagod and choking this hard Pepega',
  "Why even have a !wins command if it'll always be at 0 LULW",
  'Sorry everyone in chat has to see this disgraceful gameplay PepeHands',
  "I'm sure even Kairi would be more useful on a team than him",
  'I thought this was a !wins command, not a view count command...',
  'SuccShadow coming out in full force today eh SandbagHop'
];
let usedInsults = [];


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
    client.say(target, `Swift has won ${sessionWins} games this session!`);

    // Chatbot gonna get mean
    let insultChance = Math.floor(Math.random() * 2);
    if (sessionWins === 0 && !insulted && insultChance === 0) {
      let numInsults = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numInsults; i++) {
        let insult;
        do {
          insult = insults[Math.floor(Math.random() * insults.length)];
        } while(usedInsults.includes(insult));
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
    if (winStreak === highWinStreak) {
      client.say(target, `Swift is currently on a win streak of ${winStreak} games! This is the highest streak of this session!`);
    } else {
      client.say(target, `Swift is currently on a win streak of ${winStreak} games! The highest win streak of this session has been ${highWinStreak} games!`);
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
    totalWins = data.totalWins;
    sessionAttempts = data.sessionAttempts;
    sessionWins = data.sessionWins;
    winRate = data.winRate;
    winStreak = data.winStreak;
    highWinStreak = data.highWinStreak;
    eliminations = data.eliminations;
    sessionRounds = data.sessionRounds;
    teamRounds = data.teamRounds;
    teamEliminations = data.teamEliminations;
    let totalEliminations = eliminations.reduce(reducer);

    console.log('');
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Session Attempts: ${sessionAttempts}`);
    console.log(`Session Wins: ${sessionWins}`);
    console.log(`Win Rate: ${winRate}`);
    console.log(`Win Streak: ${winStreak}`);
    console.log(`Highest Win Streak: ${highWinStreak}`);
    console.log(`Eliminations: ${eliminations}`);
    console.log(`Session Rounds: ${sessionRounds}`);
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
