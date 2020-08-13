const clientId = 'ttwsfmzramvda8ualo9mi9gc701580';
const redirectURI = 'http://localhost:3000';
const scope = 'channel_read+channel:read:redemptions';
let channelId;
let ws;
let splitsSocket;
let overlayCanvas;
let overlayCtx;
let gameCanvas;
let gameCtx;
let camCanvas;
let camCtx;
let camEmote;
let camBlack;
let dt = 0;
let lastUpdate = Date.now();
let resetSounds = [];
let running = false;
let socket;
let timerState;
let prevTimerState;
let run;
let currentSplit;

// Audio files for luck
const goodLuckAudio = new Audio('/media/sounds/GoodLuck.mp3');
const badLuckAudio = new Audio('/media/sounds/Yikes.mp3');
const glhfAudio = new Audio('/media/sounds/GLHF.mp3');
const cursedAudio = new Audio('/media/sounds/Terror.mp3');
const fanfareAudio = new Audio('/media/sounds/Fanfare.mp3');

let overlayQueue = [];
let rewardQueue = [];
let camRewardQueue = [];
let lucks = [];
let shift = 'Blue';
let emotes = [];
const emoteSize = 202; // Facecam emote size in pixels

const maxRadius = 1080;

// Fall Guys info
let fallGuys = true;
let infoFill = 'rgba(48, 48, 48, 0.85)';
let totalWins = 40;
let sessionAttempts = 0;
let sessionWins = 0;
let winRate = "0.00%";
let winStreak = 0;
let highWinStreak = 0;
let eliminations = [0, 0, 0, 0, 0, 0];
let sessionRounds = 0;
let teamRounds = 0;
let teamEliminations = 0;

let infoRectW = 277;
let infoRectH = 130;

const sessionInfoMessages = [
  {
    'header': 'Lifetime Stats',
    'type': 'Total Wins',
    'message': totalWins,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
  {
    'header': 'Session Stats',
    'type': 'Games Played',
    'message': sessionAttempts,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
  {
    'header': 'Session Stats',
    'type': 'Wins',
    'message': sessionWins,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
  {
    'header': 'Session Stats',
    'type': 'Current Streak',
    'message': winStreak,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
  {
    'header': 'Session Stats',
    'type': 'Highest Streak',
    'message': highWinStreak,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
  {
    'header': 'Session Stats',
    'type': 'Win Rate',
    'message': winRate,
    'time': 6000,
    'maxTime': 6000,
    'x': 300
  },
];

let currentInfoIndex = 0;
let currentInfoMessage = sessionInfoMessages[currentInfoIndex];
let nextInfoMessage = sessionInfoMessages[currentInfoIndex] + 1;
let previousInfoMessage = sessionInfoMessages[sessionInfoMessages.length - 1];

// Emote class
// Emotes are created given a name, image, and size (default of 112)
class Emote {
  constructor(name, url, size) {
    this.name = name;
    this.url = url;
    this.size = size ? size : 112;
    this.img = new Image(this.size, this.size);
    this.img.src = 'url';

    // Add a property for if the emote is a gif (not used for anything yet but maybe in the future)
    if (url.includes('gif?')) {
      this.gif = true;
    }
  }
}

function parseFragment(hash) {
  var hashMatch = function (expr) {
    var match = hash.match(expr);
    return match ? match[1] : null;
  };
  var state = hashMatch(/state=(\w+)/);
  if (sessionStorage.twitchOAuthState == state)
    sessionStorage.twitchOAuthToken = hashMatch(/access_token=(\w+)/);
  return
};

function authUrl() {
  sessionStorage.twitchOAuthState = nonce(15);
  var url = 'https://api.twitch.tv/kraken/oauth2/authorize' +
    '?response_type=token' +
    '&client_id=' + clientId +
    '&redirect_uri=' + redirectURI +
    '&state=' + sessionStorage.twitchOAuthState +
    '&scope=' + scope;
  return url;
}

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
function nonce(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// To stay connected to the server, we must ping it at least once every 5 minutes
function heartbeat() {
  let message = {
    type: 'PING'
  };
  ws.send(JSON.stringify(message));
}

// Request what to listen for
function listen() {
  let message = {
    type: 'LISTEN',
    nonce: nonce(15),
    data: {
      // Listen to Channel Point Rewards
      topics: ['channel-points-channel-v1.' + channelId],
      auth_token: sessionStorage.twitchOAuthToken
    }
  };
  ws.send(JSON.stringify(message));
}

function updateDT() {
  dt = Date.now() - lastUpdate; // Delta time
  lastUpdate = Date.now();
}

function updateOverlay() {
  updateDT();
  overlayCtx.clearRect(0, 0, 1920, 1080);

  // Draw Fall Guys info box
  if (fallGuys) {
    overlayCtx.fillStyle = infoFill;
    overlayCtx.fillRect(56, 269, infoRectW, infoRectH);
    overlayCtx.fillStyle = 'rgb(255, 255, 255)';
    overlayCtx.fillRect(56, 269 + infoRectH, 277, 3);
  }

  // Update overlay if necessary
  if (overlayQueue.length != 0) {
    let overlay = overlayQueue[0];
    let radius = 0;

    if (overlay.type === 'start') {
      // Run has started
      if (overlay.time === overlay.maxTime) {
        // Set the new overlay
        overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;

        // Change scene in OBS
        socket.emit('changeScene', `${shift} Overlay`);
      }

      radius = ((overlay.maxTime - overlay.time) / overlay.maxTime) * maxRadius;

    } else if (overlay.type === 'reset') {
      // Run has reset
      if (overlay.time === overlay.maxTime) {
        infoFill = 'rgba(48, 48, 48, 0.85)';
        // Set the new overlay
        overlayCanvas.style.backgroundImage = "url('/media/overlays/GreyOverlay.png')";
        overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;

        // Play a sound effect
        if (overlay.sound) {
          resetSounds[Math.floor(Math.random() * resetSounds.length)].play();
        }

        // Change scene in OBS
        socket.emit('changeScene', 'Grey Overlay');
      }

      radius = (overlay.time / overlay.maxTime) * maxRadius;

    } else if (overlay.type === 'shift') {
      console.dir('Layout shifting!');
      // Redshift/Blueshift reward
      if (overlay.time === overlay.maxTime) {
        // Shift the overlay color and set the new overlay
        shift = shift === 'Blue' ? 'Red' : 'Blue';
        console.dir(shift);
        overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;

        // Change scene in OBS
        socket.emit('changeScene', `${shift} Overlay`);
      }

      radius = ((overlay.maxTime - overlay.time) / overlay.maxTime) * maxRadius;
    }

    // Draw the new overlay
    if (overlay.time > 0) {
      if (overlay.type != 'shift' || running) {
        overlayCtx.save();
        overlayCtx.beginPath();
        overlayCtx.arc(overlayCanvas.width / 2, overlayCanvas.height / 2, radius, 0, Math.PI * 2);
        overlayCtx.clip();
        overlayCtx.clearRect(0, 0, 1920, 1080);
        overlayCtx.drawImage(overlay.newOverlay, 0, 0);
        if (fallGuys) {
          if (overlay.type != 'reset' && shift === 'Blue') {
            overlayCtx.fillStyle = 'rgba(48, 28, 176, 0.85)';
          } else if (overlay.type != 'reset' && shift === 'Red') {
            overlayCtx.fillStyle = 'rgba(176, 28, 28, 0.85)';
          } else {
            overlayCtx.fillStyle = 'rgba(48, 48, 48, 0.85)';
          }
          // Reset fill is broken. It's switching to grey immediately when it should stay as the color that is being used (and infoFill should switch to grey)

          // Rect dimensions (W: 277, H: 130)
          overlayCtx.fillRect(56, 269, 277, 130);
          overlayCtx.fillStyle = 'rgb(255, 255, 255)';
          overlayCtx.fillRect(56, 399, 277, 3);
        }
        overlayCtx.restore();
      }

      overlay.time -= dt;
      overlayQueue[0] = overlay;

      if (overlay.time <= 0) {
        overlayQueue.shift();
        if (overlay.type === 'start' || (overlay.type === 'shift' && running)) {
          overlayCanvas.style.backgroundImage = `url('${overlay.newOverlay.src.substring(overlay.newOverlay.src.indexOf('/media'))}')`;
          infoFill = shift === 'Blue' ? 'rgba(48, 28, 176, 0.85)' : 'rgba(176, 28, 28, 0.85)';
          if (overlay.type === 'start') {
            running = true;
          }
        } else {
          infoFill = 'rgba(48, 48, 48, 0.85)';
          running = false;
        }
      }
    }
  }

  // Draw Fall Guys info text
  if (fallGuys) {
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.rect(56, 269, 277, 130);
    overlayCtx.clip();

    overlayCtx.fillStyle = 'white';
    overlayCtx.strokeStyle = 'rgb(10, 10, 10)';
    overlayCtx.font = '26px Arial';

    // Update position of text
    if (currentInfoMessage.time >= currentInfoMessage.maxTime - 500) {
      currentInfoMessage.x = 300 - 300 * Math.abs((currentInfoMessage.time - (currentInfoMessage.maxTime - 500)) / 500 - 1);
    } else if (currentInfoMessage.time <= 500) {
      currentInfoMessage.x = 300 * (currentInfoMessage.time / 500) - 300;
    } else {
      currentInfoMessage.x = 0;
    }

    let text = currentInfoMessage.header;

    if ((previousInfoMessage.header != currentInfoMessage.header && currentInfoMessage.x >= 0) || (currentInfoMessage.header != nextInfoMessage.header && currentInfoMessage.x <= 0)) {
      overlayCtx.strokeText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 296);
      overlayCtx.fillText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 296);
    } else {
      overlayCtx.strokeText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56, 296);
      overlayCtx.fillText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56, 296);
    }

    text = currentInfoMessage.type;
    overlayCtx.strokeText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 390);
    overlayCtx.fillText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 390);

    overlayCtx.font = '56px Arial';
    text = currentInfoMessage.message;
    overlayCtx.strokeText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 354);
    overlayCtx.fillText(text, infoRectW / 2 - (overlayCtx.measureText(text).width / 2) + 56 + currentInfoMessage.x, 354);

    currentInfoMessage.time -= dt;

    if (currentInfoMessage.time <= 0) {
      console.dir('Swapping info message');
      currentInfoIndex++;
      currentInfoIndex = currentInfoIndex >= sessionInfoMessages.length ? 0 : currentInfoIndex;
      let nextIndex = currentInfoIndex + 1;
      nextIndex = nextIndex >= sessionInfoMessages.length ? 0 : nextIndex;

      // Change Info Message
      previousInfoMessage = currentInfoMessage;
      currentInfoMessage = sessionInfoMessages[currentInfoIndex];
      nextInfoMessage = sessionInfoMessages[nextIndex];
      currentInfoMessage.time = currentInfoMessage.maxTime;
    }
    overlayCtx.restore();
  }

  // Show any current rewards
  showRewards();
  requestAnimationFrame(updateOverlay);
}

// Show any rewards that are in the queues
function showRewards() {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  // Show game rewards if there are any
  if (rewardQueue.length != 0) {
    let reward = rewardQueue[0];
    console.dir(reward);

    if (reward.type === 'luck') {
      let opacity = 1.0;
      if (reward.time === reward.maxTime) {
        // Play reward audio
        reward.audio.play();

        // Split the message for the reward to have the user's display name on their own
        // This is so we can show the user's display name in a highlighted color
        let splitMessage = reward.message.split(reward.user1);
        for (let i = 0; i < splitMessage.length; i++) {
          if (splitMessage[i] === '') {
            // Add the user's name
            reward.splitMessage.push(reward.user1);
          } else if (i === splitMessage.length - 1 && !reward.splitMessage.includes(reward.user1)) {
            // If this is the last part of the message and the user's name is not included yet, add the user's name and then the end
            reward.splitMessage.push(reward.user1);
            reward.splitMessage.push(splitMessage[i]);
          } else {
            // Add this part of the message
            reward.splitMessage.push(splitMessage[i]);
          }
        }
      }

      if (reward.time >= reward.maxTime - 500) {
        // Fade in
        opacity = Math.abs((reward.time - (reward.maxTime - 500)) / 500 - 1);
        if (opacity >= 1.0) opacity = 1.0;
      } else if (reward.time <= 500) {
        // Fade out
        opacity = reward.time / 500;
        if (opacity <= 0) opacity = 0;
      }

      gameCtx.font = reward.font;
      gameCtx.strokeStyle = `rgba(10, 10, 10, ${opacity})`;
      gameCtx.lineWidth = 6;

      let typedMessage = '';
      for (let i = 0; i < reward.splitMessage.length; i++) {
        let text = reward.splitMessage[i];
        if (text === reward.user1) {
          if (running && shift === 'Blue') {
            gameCtx.fillStyle = `rgba(61, 65, 166, ${opacity})`;
          } else if (running && shift === 'Red') {
            gameCtx.fillStyle = `rgb(204, 18, 0, ${opacity})`;
          } else {
            gameCtx.fillStyle = `rgba(69, 69, 69, ${opacity})`;
          }
        } else {
          gameCtx.fillStyle = `rgba(242, 242, 242, ${opacity})`;
        }

        gameCtx.strokeText(text, gameCanvas.width / 2 - (gameCtx.measureText(reward.message).width / 2 - gameCtx.measureText(typedMessage).width), 110);
        gameCtx.fillText(text, gameCanvas.width / 2 - (gameCtx.measureText(reward.message).width / 2 - gameCtx.measureText(typedMessage).width), 110);
        typedMessage += text;
      }
    }

    reward.time -= dt;
    rewardQueue[0] = reward;

    if (reward.time <= 0) {
      rewardQueue.shift();
    }
  }

  // Show cam rewards if there are any
  if (camRewardQueue.length != 0) {
    let reward = camRewardQueue[0];

    // Show the new image
    if (reward.time === reward.maxTime) {
      camBlack.style.visibility = "visible";
      camEmote.style.visibility = "visible";
      camEmote.src = reward.emote.url;
      camEmote.style.width = `${emoteSize}px`;
      camEmote.style.height = `${emoteSize}px`;
      let x = 56 + (277 - emoteSize) / 2;
      camEmote.style.left = `${x}px`;
      camEmote.style.top = "42px";
    }

    reward.time -= dt;
    camRewardQueue[0] = reward;

    // Remove this reward from the queue
    if (reward.time <= 0) {
      camRewardQueue.shift();
      camBlack.style.visibility = "hidden";
      camEmote.style.visibility = "hidden";
    }
  }
}

// Send Fall Guys info to the server
function updateFG() {
  socket.emit('updateFGInfo', {
    'totalWins': totalWins,
    'sessionAttempts': sessionAttempts,
    'sessionWins': sessionWins,
    'winRate': winRate,
    'winStreak': winStreak,
    'highWinStreak': highWinStreak,
    'eliminations': eliminations,
    'sessionRounds': sessionRounds,
    'teamRounds': teamRounds,
    'teamEliminations': teamEliminations
  });

  // Update info messages as well
  sessionInfoMessages[0].message = sessionAttempts;
  sessionInfoMessages[1].message = sessionWins;
  sessionInfoMessages[2].message = winStreak;
  sessionInfoMessages[3].message = highWinStreak;
  sessionInfoMessages[4].message = winRate;
}

// Used when resetting a run
function resetRun() {
  console.dir('run reset');
  // Clear out all users who have given luck
  lucks = [];

  // Only play a reset sound if the run has not been finished
  let sound;
  if (prevTimerState === 'Ended') {
    // Add to wins and winStreak on a completed run
    totalWins++;
    sessionWins++;
    winStreak++;
    highWinStreak = winStreak > highWinStreak ? winStreak : highWinStreak;
    sound = false;
  } else {
    // Reset winstreak and play a sound on a non completed run
    winStreak = 0;
    sound = true;
    sessionRounds++;

    // Track team eliminations
    if (currentSplit.name.includes('(Team)')) {
      teamRounds++;
      teamEliminations++;
    }

    // Track where we were eliminated
    if (currentSplit.name.includes('Round 1')) {
      eliminations[0] = eliminations[0] + 1;
    } else if (currentSplit.name.includes('Round 2')) {
      eliminations[1] = eliminations[1] + 1;
    } else if (currentSplit.name.includes('Round 3')) {
      eliminations[2] = eliminations[2] + 1;
    } else if (currentSplit.name.includes('Round 4')) {
      eliminations[3] = eliminations[3] + 1;
    } else if (currentSplit.name.includes('Round 5')) {
      eliminations[4] = eliminations[4] + 1;
    } else if (currentSplit.name.includes('Final Round')) {
      eliminations[5] = eliminations[5] + 1;
    }
  }

  winRate = `${((sessionWins / sessionAttempts) * 100).toFixed(2)}%`; // Update winRate
  console.dir(winRate);
  updateFG();

  if (overlayQueue.length > 2) {
    // Adjust the overlay queue to prioritize reset
    let currentOverlay = overlayQueue.shift();
    overlayQueue.unshift({
      'type': 'reset',
      'time': 600,
      'maxTime': 600,
      'newOverlay': new Image(overlayCanvas.width, overlayCanvas.height),
      'sound': sound,
    });
    overlayQueue.unshift(currentOverlay);
  } else {
    // Reset overlay
    overlayQueue.push({
      'type': 'reset',
      'time': 600,
      'maxTime': 600,
      'newOverlay': new Image(overlayCanvas.width, overlayCanvas.height),
      'sound': sound,
    });
  }

  // Reset livesplit variables
  currentSplit = '';
}

// Used when starting a run
function startRun() {
  console.dir('run started');
  sessionAttempts++;
  if (overlayQueue.length > 2) {
    // Adjust the overlay queue to prioritize start
    let currentOverlay = overlayQueue.shift();
    overlayQueue.unshift({
      'type': 'start',
      'time': 600,
      'maxTime': 600,
      'newOverlay': new Image(overlayCanvas.width, overlayCanvas.height),
    });
    overlayQueue.unshift(currentOverlay);
  } else {
    // Start overlay
    overlayQueue.push({
      'type': 'start',
      'time': 600,
      'maxTime': 600,
      'newOverlay': new Image(overlayCanvas.width, overlayCanvas.height),
    });
  }
}

// Open a WebSocket that works with LiveSplit
function startSplitsSocket() {
  splitsSocket = new WebSocket('ws://192.168.1.152:15721');
  splitsSocket.onopen = (event) => {
    console.dir('Connected to LiveSplit');
    console.dir(event);
  };

  splitsSocket.onmessage = (event) => {
    console.dir('Message Received');
    let data = JSON.parse(event.data);
    let action = data.action.action;
    console.dir(data);
    console.dir(action);

    prevTimerState = timerState;
    timerState = data.state.timerState;

    if (action === 'reset') {
      // A run has reset
      resetRun();
    }
    if (action === 'start') {
      // A run has started
      currentSplit = data.state.run.segments[0];
      startRun();
    } else if (action === 'split') {
      // Runner has split, get split info
      sessionRounds++;
      if (currentSplit.name.includes('(Team)')) {
        teamRounds++;
      }
      currentSplit = data.state.run.segments[data.state.currentSplitIndex];
    } else if (action === 'skip-split') {
      currentSplit = data.state.run.segments[data.state.currentSplitIndex];
    }
  }

  splitsSocket.onerror = (error) => {
    console.dir(error);
  };
}

// Connect
function connect() {
  var heartbeatInterval = 1000 * 60; //ms between PING's
  var reconnectInterval = 1000 * 3; //ms to wait before reconnect
  var heartbeatHandle;

  socket = io.connect();

  // Populate reset sounds
  let noWay = new Audio('/media/sounds/NoWay.wav');
  let dumbWay = new Audio('/media/sounds/WhatADumbWayToGo.wav');
  resetSounds.push(noWay);
  resetSounds.push(noWay);
  resetSounds.push(noWay);
  resetSounds.push(dumbWay);

  // Populate emotes
  // There is definitely a better way of doing this. Is there an API that can get an image URL by emote name?
  // TODO: Move all emotes into a JSON file and just loop to add them
  emotes.push(new Emote('swifts7Bless', '/media/emotes/SwiftShadow_AerithBless.png', 1000));
  emotes.push(new Emote('swifts7Flex', '/media/emotes/SwiftShadow_TifaFlex.png', 1000));
  emotes.push(new Emote('swifts7Blush', '/media/emotes/SwiftShadow_CloudBlush.png', 1000));
  emotes.push(new Emote('swifts7Troll', '/media/emotes/SwiftShadow_RocheTroll.png', 1000));
  emotes.push(new Emote('swifts7Rage', '/media/emotes/SwiftShadow_MadamMRage.png', 1000));
  emotes.push(new Emote('swifts7Love', '/media/emotes/swifts7LoveL.png'));
  emotes.push(new Emote('swifts7NotLikeThis', '/media/emotes/swifts7NotLikeThisL.png'));
  emotes.push(new Emote('swifts7POGGERS', '/media/emotes/swifts7POGGERSL.png'));
  emotes.push(new Emote('swifts7Pout', '/media/emotes/swifts7PoutL.png'));
  emotes.push(new Emote('swifts7Wink', '/media/emotes/swifts7WinkL.png'));
  emotes.push(new Emote('swifts7Nut', '/media/emotes/swifts7NutL.png'));
  emotes.push(new Emote('swifts7Hi', '/media/emotes/swifts7HiL.png'));
  emotes.push(new Emote('swifts7Nice', '/media/emotes/swifts7NiceL.png'));
  emotes.push(new Emote('swifts7EZ', '/media/emotes/swifts7EZL.png'));
  emotes.push(new Emote('swifts7LMAO', '/media/emotes/swifts7LMAOL.png'));
  emotes.push(new Emote('swifts7Gun', '/media/emotes/swifts7GunL.png'));
  emotes.push(new Emote('swifts7AYAYA', '/media/emotes/swifts7AYAYAL.png'));
  emotes.push(new Emote('swifts7Pog', '/media/emotes/swifts7PogL.png'));
  emotes.push(new Emote('swifts7WutFace', 'https://cdn.betterttv.net/emote/5d8275e9c0652668c9e4e381/3x'));
  emotes.push(new Emote('swifts7Really', 'https://cdn.betterttv.net/emote/5d8275aad2458468c1f464a6/3x'));
  emotes.push(new Emote('Swifts7Sandbag', '/media/emotes/swifts7SandbagResized.png', 128));
  emotes.push(new Emote('PepeHands', 'https://cdn.betterttv.net/emote/59f27b3f4ebd8047f54dee29/3x'));
  emotes.push(new Emote('PepeLmao', 'https://cdn.frankerfacez.com/emoticon/214658/4', 128));
  emotes.push(new Emote('YEP', 'https://cdn.frankerfacez.com/emoticon/418189/4', 128));
  emotes.push(new Emote('Pepega', 'https://cdn.betterttv.net/emote/5aca62163e290877a25481ad/3x'));
  emotes.push(new Emote('Sadge', 'https://cdn.betterttv.net/emote/5e0fa9d40550d42106b8a489/3x'));
  emotes.push(new Emote('POGGERS', 'https://cdn.betterttv.net/emote/58ae8407ff7b7276f8e594f2/3x'));
  emotes.push(new Emote('YuukoBlank', 'https://cdn.frankerfacez.com/emoticon/238499/4', 128));
  emotes.push(new Emote('YuukoS', 'https://cdn.betterttv.net/emote/5d7c0bbfc0652668c9e4c59b/3x'));
  emotes.push(new Emote('YuukO', 'https://cdn.betterttv.net/emote/5d7c1192d2458468c1f44662/3x'));
  emotes.push(new Emote('YuukoYikes', 'https://cdn.betterttv.net/emote/5d7c170cb58d1868c285c7aa/3x'));
  emotes.push(new Emote('YuukoKappa', 'https://cdn.betterttv.net/emote/5d8677d4d2458468c1f47677/3x'));
  emotes.push(new Emote('TimesaveForNextRun', 'https://cdn.frankerfacez.com/emoticon/462840/4', 128));
  emotes.push(new Emote('MioNotLikeThis', 'https://cdn.betterttv.net/emote/5d867d18b58d1868c285f784/3x'));
  emotes.push(new Emote('peepoPOG', 'https://cdn.betterttv.net/emote/5b69afcde1dd39261a3b9d53/3x'));
  emotes.push(new Emote('peepoS', 'https://cdn.betterttv.net/emote/5a26924bfc6e584787d98544/3x'));
  emotes.push(new Emote('peepoHappy', 'https://cdn.betterttv.net/emote/5a16ee718c22a247ead62d4a/3x'));
  emotes.push(new Emote('peepoSad', 'https://cdn.betterttv.net/emote/5a16ddca8c22a247ead62ceb/3x'));
  emotes.push(new Emote('peepoPoo', 'https://cdn.frankerfacez.com/emoticon/307828/4', 128));
  emotes.push(new Emote('peepoLove', 'https://cdn.betterttv.net/emote/5a5e0e8d80f53146a54a516b/3x'));
  emotes.push(new Emote('pigO', 'https://cdn.frankerfacez.com/emoticon/386230/4', 128));
  emotes.push(new Emote('cfAYAYA', 'https://cdn.frankerfacez.com/emoticon/420824/4', 128));
  emotes.push(new Emote('SaberHappy', 'https://cdn.frankerfacez.com/emoticon/51458/4', 128));
  emotes.push(new Emote('LULW', 'https://cdn.frankerfacez.com/emoticon/139407/4', 128));
  emotes.push(new Emote('Kairi', 'https://cdn.frankerfacez.com/emoticon/375263/4', 128));
  emotes.push(new Emote('JunkoLewd', 'https://cdn.frankerfacez.com/emoticon/126838/4', 128));
  emotes.push(new Emote('FeelsBaseMan', 'https://cdn.frankerfacez.com/emoticon/391184/4', 128));
  emotes.push(new Emote('EZ', 'https://cdn.betterttv.net/emote/5590b223b344e2c42a9e28e3/3x'));
  emotes.push(new Emote('OMEGALUL', 'https://cdn.betterttv.net/emote/583089f4737a8e61abb0186b/3x'));
  emotes.push(new Emote('monkaS', 'https://cdn.betterttv.net/emote/56e9f494fff3cc5c35e5287e/3x'));
  emotes.push(new Emote('monkaW', 'https://cdn.betterttv.net/emote/59ca6551b27c823d5b1fd872/3x'));

  // GIF Emotes
  emotes.push(new Emote('YuukoGasm', 'https://cdn.betterttv.net/emote/5d9803411df66f68c80c7a2d/3x'));
  emotes.push(new Emote('RainbowPls', 'https://cdn.betterttv.net/emote/5b35cae2f3a33e2b6f0058ef/3x'));
  emotes.push(new Emote('kannaDansu', 'https://cdn.betterttv.net/emote/5a848b1cc577c33d3e375afe/3x'));
  emotes.push(new Emote('ThisIsFine', 'https://cdn.betterttv.net/emote/5e2914861df9195f1a4cd411/3x'));
  emotes.push(new Emote('SandbagHop', 'https://cdn.betterttv.net/emote/5d7954fdbd340415e9f33ba5/3x'));
  emotes.push(new Emote('PeepoPooPoo', 'https://cdn.betterttv.net/emote/5c3427a55752683d16e409d1/3x'));
  emotes.push(new Emote('peepoGoolysses', 'https://cdn.betterttv.net/emote/5f246d9bfe85fb4472d1c339/3x'));
  emotes.push(new Emote('monkaSTEER', '/media/emotes/monkaSTEER.gif', 110));
  emotes.push(new Emote('WAYTOOPOGGERS', 'https://cdn.betterttv.net/emote/5f2672a5fe85fb4472d1e207/3x'));
  emotes.push(new Emote('blobDance', 'https://cdn.betterttv.net/emote/5ada077451d4120ea3918426/3x'));
  emotes.push(new Emote('peepoSHAKE', 'https://cdn.betterttv.net/emote/5b83938ca69b8634bf059473/3x'));
  emotes.push(new Emote('peepoGiggles', 'https://cdn.betterttv.net/emote/5e0bcf69031ec77bab473476/3x'));
  emotes.push(new Emote('Monka', 'https://cdn.betterttv.net/emote/5c37cc6743a23a61c2449c73/3x'));
  emotes.push(new Emote('monkaTOS', 'https://cdn.betterttv.net/emote/5a7fd054b694db72eac253f4/3x'));
  emotes.push(new Emote('PepeJAMJAM', 'https://cdn.betterttv.net/emote/5c36fba2c6888455faa2e29f/3x'));
  emotes.push(new Emote('pepeMeltdown', 'https://cdn.betterttv.net/emote/5ba84271c9f0f66a9efc1c86/3x'));
  emotes.push(new Emote('AYAYABASSS', 'https://cdn.betterttv.net/emote/5bbecbb0605b7273d160f6f6/3x'));
  emotes.push(new Emote('Jammies', 'https://cdn.betterttv.net/emote/5d2dc7dcff6ed3680130eb6d/3x', 100));
  emotes.push(new Emote('HeartGirl', 'https://cdn.betterttv.net/emote/5ae39aa3695e497cec5d2218/3x'));
  emotes.push(new Emote('SenpaiWhoop', 'https://cdn.betterttv.net/emote/5ada1b9c35ca0201c05aed72/3x'));
  emotes.push(new Emote('ThinkingWright', 'https://cdn.betterttv.net/emote/5bec61f9c3cac7088d09c0aa/3x'));
  emotes.push(new Emote('Pepego', 'https://cdn.betterttv.net/emote/5c85dd4b2bc49a0419824494/3x'));
  emotes.push(new Emote('POGSLIDE', 'https://cdn.betterttv.net/emote/5aea37908f767c42ce1e0293/3x'));
  emotes.push(new Emote('JigglyMad', 'https://cdn.betterttv.net/emote/5c8390a488a48f11abcd0389/3x'));
  emotes.push(new Emote('KirbDance', 'https://cdn.betterttv.net/emote/5b9011eea2c5266ff2b8fde5/3x'));

  // Set up Canvases
  overlayCanvas = document.getElementById('overlayCanvas');
  overlayCtx = overlayCanvas.getContext('2d');
  gameCanvas = document.getElementById('gameCanvas');
  gameCtx = gameCanvas.getContext('2d');
  camCanvas = document.getElementById('camCanvas');
  camCtx = camCanvas.getContext('2d');
  camEmote = document.getElementById('camEmote');
  camBlack = document.getElementById('camBlack');

  requestAnimationFrame(updateOverlay);

  // Create and open WebSocket
  ws = new WebSocket('wss://pubsub-edge.twitch.tv');
  ws.onopen = (event) => {
    heartbeat();
    heartbeatHandle = setInterval(heartbeat, heartbeatInterval);

    fetch(
        'https://api.twitch.tv/kraken/channel', {
          headers: {
            "client-id": clientId,
            "authorization": "OAuth " + sessionStorage.twitchOAuthToken,
            'accept': 'application/vnd.twitchtv.v5+json'
          }
        }
      )
      .then(resp => {
        resp.json().then(channel => {
          channelId = channel._id;
          listen();
        })
      })

  };

  ws.onerror = (error) => {
    console.dir(error);
  };

  ws.onmessage = (event) => {
    var message = JSON.parse(event.data);

    if (message.type == 'RECONNECT') {
      // Attempt to reconnect after a specified period of time
      setTimeout(connect, reconnectInterval);
    } else if (message.type == 'MESSAGE') {
      var redemption = JSON.parse(message.data.message).data.redemption;

      console.dir(redemption.reward.id);
      if (redemption.reward.id === "b67d2fa1-8a59-48fa-9727-c997a4734325") {
        // Channel point reward for giving luck
        var rewardUser = redemption.user.display_name;

        // Generate what type of luck
        let luckNum = Math.floor(Math.random() * 1000);
        let luckTime = 4000;
        let luckMessage = '';
        let luckId = '';
        let luckAudio;
        let luckFont = '64px Arial';

        if (luckNum < 550) {
          // ~55% chance of good luck
          luckId = 'good';
          luckMessage = `${rewardUser} has given Good Luck!`;
          luckAudio = goodLuckAudio;
        } else if (luckNum < 820) {
          // ~27% chance of bad luck
          luckId = 'bad';
          luckMessage = `${rewardUser} has given Bad Luck!`;
          luckAudio = badLuckAudio;
        } else if (luckNum < 940) {
          // ~12% chance of glhf
          luckId = 'glhf';
          luckMessage = `GLHF from ${rewardUser}!!!`;
          luckAudio = glhfAudio;
        } else if (luckNum < 995) {
          // ~5.5% chance to curse the run
          luckId = 'curse';
          luckTime = 6000;
          luckMessage = `Oh no! ${rewardUser} cursed the run!`;
          luckAudio = cursedAudio;
        } else if (luckNum < 1000) {
          // 0.5% chance for a gifted sub
          luckId = 'sub';
          luckTime = 6000;
          luckFont = '58px Arial';
          luckMessage = `Lucky day for ${rewardUser}! Enjoy a gift sub!`;
          luckAudio = fanfareAudio;
        }

        // Add this to the queue if the user has not yet given luck
        if (!lucks.includes(rewardUser)) {
          rewardQueue.push({
            'id': luckId,
            'type': 'luck',
            'user1': rewardUser,
            'message': luckMessage,
            'splitMessage': [],
            'font': luckFont,
            'audio': luckAudio,
            'time': luckTime,
            'maxTime': luckTime,
          });
          lucks.push(rewardUser);
        }
      } else if (redemption.reward.id === 'e1d249af-4baf-4644-b53e-27376e79b234') {
        // Channel point reward for facecam emote
        // Split the message on spaces
        let userMsg = redemption.user_input.toLowerCase().split(' ');

        let selectedEmote;
        if (userMsg.length > 0) {
          // Get the first supported emote in the message
          for (let i = 0; i < userMsg.length; i++) {
            let emoteName = userMsg[i].replace(/\s/g, '');
            console.dir(emoteName);

            selectedEmote = emotes.find(e => {
              return e.name.toLowerCase() === emoteName
            });

            if (selectedEmote) {
              break;
            }
          }
        }

        if (selectedEmote) {
          // Add this to the queue
          camRewardQueue.push({
            'type': 'emote',
            'emote': selectedEmote,
            'time': 30000,
            'maxTime': 30000,
          });
        }
      } else if (redemption.reward.id === '1b9fe4b3-6571-49be-b467-eb687dfd51ef') {
        console.dir('shift reward redeemed');
        // Channel point reward for shifting layout
        overlayQueue.push({
          'type': 'shift',
          'time': 600,
          'maxTime': 600,
          'newOverlay': new Image(overlayCanvas.width, overlayCanvas.height),
        });
      }
    }
  };

  ws.onclose = function () {
    // Socket has been closed. Reconnect
    clearInterval(heartbeatHandle);
    setTimeout(connect, reconnectInterval);
  };

  startSplitsSocket();

}

$(function () {
  if (document.location.hash.match(/access_token=(\w+)/))
    parseFragment(document.location.hash);
  if (sessionStorage.twitchOAuthToken) {
    // If this has already been connected to Twitch, show the layout
    connect();
    console.dir('Connected');
    $('.rewards').show();
  } else {
    // Not connected to Twitch, ask to connect
    var url = authUrl()
    $('#auth-link').attr("href", url);
    $('.auth').show()
  }
});

$('#topic-form').submit(function () {
  listen();
  event.preventDefault();
});
