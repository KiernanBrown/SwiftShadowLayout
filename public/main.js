import { addTrackedPokemonBySplit, resetTracker, initPokemonSocket } from './pokemon.js';

const clientId = 'ttwsfmzramvda8ualo9mi9gc701580';
const redirectURI = 'http://localhost:3000';
const scope = 'channel_read+channel:manage:redemptions';
let channelId;
let ws;

let overlayCanvas;
let overlayCtx;
let gameCanvas;
let gameCtx;
const camDimensions = {
  x: 18,
  y: 17,
  width: 390,
  height: 289,
};
let camEmote;
let dt = 0;
let lastUpdate = Date.now();
let resetSounds = [];
let running = false;
let socket;
let speedrun = true;

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
let luckTimeouts = [];
let luckInterval = 20 * 60000; // Minutes to ms
let shift = 'Red';
let emotes = [];
const emoteSize = camDimensions.height; // Facecam emote size in pixels

const maxRadius = 1080;

// Dice rolling
let dieX = 566;
let dieY = 862;
let dieW = 172;
let dieH = 198;
let diceRewardQueue = [];
let greyDie;

const diceStartAudio = new Audio('/media/sounds/LetTheGameBegin.wav');
const nat1Audio = new Audio('/media/sounds/LuckHasBetrayedYou.wav');
const nat20Audio = new Audio('/media/sounds/ItsMoreFun.wav');
const tooBadAudio = new Audio('/media/sounds/TooBad.wav');
const impressiveAudio = new Audio('/media/sounds/Impressive.wav');
const continuesAudio = new Audio('/media/sounds/TheGameContinues.wav');
const wellDoneAudio = new Audio('/media/sounds/WellDone.wav');
const aliceAudio = new Audio('/media/sounds/AliceAre.wav');

// Fall Guys info
let fallGuys = false;
let infoFill = 'rgba(48, 48, 48, 0.85)';
let totalWins = 0;
let sessionAttempts = 0;
let sessionWins = 0;
let winRate = '0.00%';
let winStreak = 0;
let highWinStreak = 0;
let eliminations = [0, 0, 0, 0, 0];
let sessionRounds = 0;
let teamRounds = 0;
let teamEliminations = 0;
let finalStats = [];
let finalLevels = [
  'Hex-a-gone',
  'Fall Mountain',
  'Royal Fumble',
  'Jump Showdown',
];

let infoRectX = 21;
let infoRectY = 299;
let infoRectW = 349;
let infoRectH = 130;
let infoRectOff = infoRectW + 80;

const sessionInfoMessages = [
  {
    header: 'Lifetime Stats',
    type: 'Total Wins',
    message: totalWins,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
  {
    header: 'Session Stats',
    type: 'Games Played',
    message: sessionAttempts,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
  {
    header: 'Session Stats',
    type: 'Wins',
    message: sessionWins,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
  {
    header: 'Session Stats',
    type: 'Current Streak',
    message: winStreak,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
  {
    header: 'Session Stats',
    type: 'Highest Streak',
    message: highWinStreak,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
  {
    header: 'Session Stats',
    type: 'Win Rate',
    message: winRate,
    time: 6000,
    maxTime: 6000,
    x: infoRectOff,
  },
];

let currentInfoIndex = 0;
let currentInfoMessage = sessionInfoMessages[currentInfoIndex];
let nextInfoMessage = sessionInfoMessages[currentInfoIndex] + 1;
let previousInfoMessage = sessionInfoMessages[sessionInfoMessages.length - 1];

// Gnosia info
let gnosia = false;
let gnosiaStats = {};
let gnosiaRoles = [
  'Crew',
  'Engineer',
  'Guardian Angel',
  'Doctor',
  'Guard Duty',
  'Gnosia',
  'AC Follower',
];
let roleIndex = 0;

// Pokemon info
let pokemon = true;

// Emote class
// Emotes are created given a name, image, and size (default of 112)
class Emote {
  constructor(name, url, gif, size) {
    this.name = name;
    this.url = url;
    this.gif = gif;
    this.size = size ? size : 112;
    this.img = new Image(this.size, this.size);
    this.img.src = 'url';
  }
}

function parseFragment(hash) {
  let hashMatch = function (expr) {
    let match = hash.match(expr);
    return match ? match[1] : null;
  };
  let state = hashMatch(/state=(\w+)/);
  if (sessionStorage.twitchOAuthState == state)
    sessionStorage.twitchOAuthToken = hashMatch(/access_token=(\w+)/);
  return;
}

function authUrl() {
  sessionStorage.twitchOAuthState = nonce(15);
  let url =
    'https://api.twitch.tv/kraken/oauth2/authorize' +
    '?response_type=token' +
    '&client_id=' +
    clientId +
    '&redirect_uri=' +
    redirectURI +
    '&state=' +
    sessionStorage.twitchOAuthState +
    '&scope=' +
    scope;
  return url;
}

// Source: https://www.thepolyglotdeveloper.com/2015/03/create-a-random-nonce-string-using-javascript/
function nonce(length) {
  let text = '';
  let possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// To stay connected to the server, we must ping it at least once every 5 minutes
function heartbeat() {
  let message = {
    type: 'PING',
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
      auth_token: sessionStorage.twitchOAuthToken,
    },
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
    overlayCtx.fillRect(infoRectX, infoRectY, infoRectW, infoRectH);
    overlayCtx.fillStyle = 'rgb(255, 255, 255)';
    overlayCtx.fillRect(infoRectX, infoRectY + infoRectH, infoRectW, 3);
  }

  // Draw D20
  /*if (diceRewardQueue.length != 0) {
    let dice = diceRewardQueue[0];
    if (dice.time === dice.maxTime) {
      diceStartAudio.play();
      dice.rolls = 0;
      dice.roll = Math.floor(Math.random() * 20) + 1;
      dice.nextRoll = Math.floor(Math.random() * 6) + 22 + 4.38 * dice.rolls;
      dice.timePast = 0;
    }
    dice.time -= dt;
    dice.timePast += dt;

    if (!dice.stopped && dice.timePast >= dice.nextRoll) {
      dice.timePast -= dice.nextRoll;
      dice.roll = Math.floor(Math.random() * 20) + 1;
      if (dice.time >= 5500) {
        dice.nextRoll = Math.floor(Math.random() * 6) + 16 + 2.88 * dice.rolls;
      } else {
        dice.nextRoll = Math.floor(Math.random() * 6) + 42 + 5.88 * dice.rolls;
      }

      dice.rolls++;
    }

    // Draw die
    let opacity = 1.0;
    if (dice.time >= dice.maxTime - 500) {
      // Fade in
      opacity = Math.abs((dice.time - (dice.maxTime - 500)) / 500 - 1);
      if (opacity >= 1.0) opacity = 1.0;
    } else if (dice.time <= 500) {
      // Fade out
      opacity = dice.time / 500;
      if (opacity <= 0) opacity = 0;
    }

    overlayCtx.save();
    overlayCtx.fillStyle = 'rgb(255, 255, 255)';
    overlayCtx.font = '32px Arial';
    overlayCtx.globalAlpha = opacity;
    overlayCtx.drawImage(greyDie, dieX, dieY);
    let textX = dieW / 2 - overlayCtx.measureText(dice.roll).width / 2 + dieX;
    let textY = dieH / 2 + 8 + dieY;
    overlayCtx.fillText(dice.roll, textX, textY);
    overlayCtx.lineWidth = 0.6;
    if (dice.stopped) {
      overlayCtx.strokeStyle = 'rgb(173, 150, 47)';
    } else {
      overlayCtx.strokeStyle = 'rgb(155, 155, 155)';
    }
    overlayCtx.strokeText(dice.roll, textX, textY);
    overlayCtx.restore();

    diceRewardQueue[0] = dice;

    if (dice.time <= 3000 && !dice.stopped) {
      dice.stopped = true;

      if (dice.roll === 1) {
        nat1Audio.play();
      } else if (dice.roll === 2) {
        wellDoneAudio.play();
      } else if (dice.roll === 7) {
        continuesAudio.play();
      } else if (dice.roll === 19) {
        impressiveAudio.play();
      } else if (dice.roll === 20) {
        nat20Audio.play();
      } else {
        tooBadAudio.play();
      }

      socket.emit('diceRoll', {
        roll: dice.roll,
        user: dice.user,
      });
    }

    if (dice.time <= 0) {
      diceRewardQueue.shift();
    }
  }

  // Update overlay if necessary
  if (overlayQueue.length != 0) {
    let overlay = overlayQueue[0];
    let radius = 0;

    if (overlay.type === 'start') {
      // Run has started
      if (overlay.time === overlay.maxTime) {
        // Set the new overlay
        // Change scene in OBS
        if (speedrun) {
          overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;
          socket.emit('changeScene', `${shift} Overlay`);
        } else {
          socket.emit('changeScene', `${shift} Casual Overlay`);
        }
      }

      radius = ((overlay.maxTime - overlay.time) / overlay.maxTime) * maxRadius;
    } else if (overlay.type === 'reset') {
      // Run has reset
      if (overlay.time === overlay.maxTime) {
        infoFill = 'rgba(48, 48, 48, 0.85)';
        // Set the new overlay
        if (speedrun) {
          overlayCanvas.style.backgroundImage =
            "url('/media/overlays/GreyOverlay.png')";
          overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;
        }

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

        // Change scene in OBS
        if (speedrun) {
          overlay.newOverlay.src = `/media/overlays/${shift}Overlay.png`;
          socket.emit('changeScene', `${shift} Overlay`);
        } else {
          socket.emit('changeScene', `${shift} Casual Overlay`);
        }
      }

      radius = ((overlay.maxTime - overlay.time) / overlay.maxTime) * maxRadius;
    }

    // Draw the new overlay
    if (overlay.time > 0) {
      console.dir('first block');
      if (overlay.type != 'shift' || running) {
        overlayCtx.save();
        overlayCtx.beginPath();
        overlayCtx.arc(
          overlayCanvas.width / 2,
          overlayCanvas.height / 2,
          radius,
          0,
          Math.PI * 2
        );
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

          // Draw info rect
          overlayCtx.fillRect(infoRectX, infoRectY, infoRectW, infoRectH);
          overlayCtx.fillStyle = 'rgb(255, 255, 255)';
          overlayCtx.fillRect(infoRectX, infoRectY + infoRectH, infoRectW, 3);
        }

        if (diceRewardQueue.length != 0) {
          // Draw die
          let dice = diceRewardQueue[0];
          let opacity = 1.0;
          if (dice.time >= dice.maxTime - 500) {
            // Fade in
            opacity = Math.abs((dice.time - (dice.maxTime - 500)) / 500 - 1);
            if (opacity >= 1.0) opacity = 1.0;
          } else if (dice.time <= 500) {
            // Fade out
            opacity = dice.time / 500;
            if (opacity <= 0) opacity = 0;
          }

          overlayCtx.save();
          overlayCtx.fillStyle = 'rgb(255, 255, 255)';
          overlayCtx.font = '32px Arial';
          overlayCtx.globalAlpha = opacity;
          overlayCtx.drawImage(greyDie, dieX, dieY);
          let textX =
            dieW / 2 - overlayCtx.measureText(dice.roll).width / 2 + dieX;
          let textY = dieH / 2 + 8 + dieY;
          console.dir(overlayCtx.measureText(dice.roll));
          overlayCtx.fillText(dice.roll, textX, textY);
          overlayCtx.lineWidth = 0.6;
          if (dice.stopped) {
            overlayCtx.strokeStyle = 'rgb(173, 150, 47)';
          } else {
            overlayCtx.strokeStyle = 'rgb(155, 155, 155)';
          }
          overlayCtx.strokeText(dice.roll, textX, textY);
          overlayCtx.restore();
        }
        overlayCtx.restore();
      }

      overlay.time -= dt;
      overlayQueue[0] = overlay;

      if (overlay.time <= 0) {
        console.dir('second block');
        overlayQueue.shift();
        if (overlay.type === 'start' || (overlay.type === 'shift' && running)) {
          if (speedrun) {
            overlayCanvas.style.backgroundImage = `url('${overlay.newOverlay.src.substring(
              overlay.newOverlay.src.indexOf('/media')
            )}')`;
            console.dir('changing background');
          }
          infoFill =
            shift === 'Blue'
              ? 'rgba(48, 28, 176, 0.85)'
              : 'rgba(176, 28, 28, 0.85)';
          if (overlay.type === 'start') {
            running = true;
          }
        } else {
          infoFill = 'rgba(48, 48, 48, 0.85)';
          running = false;
        }
      }
    }
  }*/

  // Draw Fall Guys info text
  if (fallGuys) {
    overlayCtx.save();
    overlayCtx.beginPath();
    overlayCtx.rect(infoRectX, infoRectY, infoRectW, infoRectH);
    overlayCtx.clip();

    overlayCtx.fillStyle = 'white';
    overlayCtx.strokeStyle = 'rgb(10, 10, 10)';
    overlayCtx.font = '26px Arial';

    // Update position of text
    if (currentInfoMessage.time >= currentInfoMessage.maxTime - 500) {
      currentInfoMessage.x =
        infoRectOff -
        infoRectOff *
          Math.abs(
            (currentInfoMessage.time - (currentInfoMessage.maxTime - 500)) /
              500 -
              1
          );
    } else if (currentInfoMessage.time <= 500) {
      currentInfoMessage.x =
        infoRectOff * (currentInfoMessage.time / 500) - infoRectOff;
    } else {
      currentInfoMessage.x = 0;
    }

    let text = currentInfoMessage.header;

    if (
      (previousInfoMessage.header != currentInfoMessage.header &&
        currentInfoMessage.x >= 0) ||
      (currentInfoMessage.header != nextInfoMessage.header &&
        currentInfoMessage.x <= 0)
    ) {
      overlayCtx.strokeText(
        text,
        infoRectW / 2 -
          overlayCtx.measureText(text).width / 2 +
          infoRectX +
          currentInfoMessage.x,
        infoRectY + 27
      );
      overlayCtx.fillText(
        text,
        infoRectW / 2 -
          overlayCtx.measureText(text).width / 2 +
          infoRectX +
          currentInfoMessage.x,
        infoRectY + 27
      );
    } else {
      overlayCtx.strokeText(
        text,
        infoRectW / 2 - overlayCtx.measureText(text).width / 2 + infoRectX,
        infoRectY + 27
      );
      overlayCtx.fillText(
        text,
        infoRectW / 2 - overlayCtx.measureText(text).width / 2 + infoRectX,
        infoRectY + 27
      );
    }

    text = currentInfoMessage.type;
    overlayCtx.strokeText(
      text,
      infoRectW / 2 -
        overlayCtx.measureText(text).width / 2 +
        infoRectX +
        currentInfoMessage.x,
      infoRectY + 121
    );
    overlayCtx.fillText(
      text,
      infoRectW / 2 -
        overlayCtx.measureText(text).width / 2 +
        infoRectX +
        currentInfoMessage.x,
      infoRectY + 121
    );

    overlayCtx.font = '56px Arial';
    text = currentInfoMessage.message;
    overlayCtx.strokeText(
      text,
      infoRectW / 2 -
        overlayCtx.measureText(text).width / 2 +
        infoRectX +
        currentInfoMessage.x,
      infoRectY + 85
    );
    overlayCtx.fillText(
      text,
      infoRectW / 2 -
        overlayCtx.measureText(text).width / 2 +
        infoRectX +
        currentInfoMessage.x,
      infoRectY + 85
    );

    currentInfoMessage.time -= dt;

    if (currentInfoMessage.time <= 0) {
      console.dir('Swapping info message');
      currentInfoIndex++;
      currentInfoIndex =
        currentInfoIndex >= sessionInfoMessages.length ? 0 : currentInfoIndex;
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

  // Draw Gnosia info text
  if (gnosia) {
    overlayCtx.save();
    overlayCtx.lineWidth = 7.5;
    overlayCtx.fillStyle = 'white';
    overlayCtx.strokeStyle = 'rgb(10, 10, 10)';
    overlayCtx.font = '48px Arial';

    overlayCtx.strokeText(`Loop: ${gnosiaStats.loop}`, 580, 905);
    overlayCtx.fillText(`Loop: ${gnosiaStats.loop}`, 580, 905);
    overlayCtx.strokeText(`Level: ${gnosiaStats.level}`, 580, 970);
    overlayCtx.fillText(`Level: ${gnosiaStats.level}`, 580, 970);
    overlayCtx.strokeText(`Role: ${gnosiaStats.role}`, 580, 1035);
    overlayCtx.fillText(`Role: ${gnosiaStats.role}`, 580, 1035);

    // Write stats
    let startingX = 872;
    let statY = 937;
    let valueY = 983;

    overlayCtx.lineWidth = 6.2;
    overlayCtx.font = '39px Arial';

    for (let i = 0; i < gnosiaStats.stats.length; i++) {
      overlayCtx.strokeText(`${gnosiaStats.stats[i].stat}`, startingX, statY);
      overlayCtx.fillText(`${gnosiaStats.stats[i].stat}`, startingX, statY);

      let statWidth = overlayCtx.measureText(
        `${gnosiaStats.stats[i].stat}`
      ).width;
      let valueWidth = overlayCtx.measureText(
        `${gnosiaStats.stats[i].value}`
      ).width;

      overlayCtx.strokeText(
        `${gnosiaStats.stats[i].value}`,
        startingX + statWidth / 2 - valueWidth / 2,
        valueY
      );
      overlayCtx.fillText(
        `${gnosiaStats.stats[i].value}`,
        startingX + statWidth / 2 - valueWidth / 2,
        valueY
      );

      startingX += statWidth + 26;
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
          } else if (
            i === splitMessage.length - 1 &&
            !reward.splitMessage.includes(reward.user1)
          ) {
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
            gameCtx.fillStyle = `rgba(115, 6, 180, ${opacity})`;
          }
        } else {
          gameCtx.fillStyle = `rgba(240, 240, 240, ${opacity})`;
        }

        gameCtx.strokeText(
          text,
          gameCanvas.width / 2 -
            (gameCtx.measureText(reward.message).width / 2 -
              gameCtx.measureText(typedMessage).width),
          110
        );
        gameCtx.fillText(
          text,
          gameCanvas.width / 2 -
            (gameCtx.measureText(reward.message).width / 2 -
              gameCtx.measureText(typedMessage).width),
          110
        );
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
      socket.emit('toggleSource', { source: 'OverlayCam', visible: false });
      if (reward.type === 'emote') {
        camEmote.style.visibility = 'visible';
        camEmote.src = reward.emote.url;
        camEmote.style.width = `${emoteSize}px`;
        camEmote.style.height = `${emoteSize}px`;
        //let x = camBlack.style.left + emoteSize / 2;
        let x = camDimensions.x + (camDimensions.width - emoteSize) / 2;
        let y = camDimensions.y;
        camEmote.style.left = `${x}px`;
        camEmote.style.top = `${y}px`;
      } else if (reward.type === 'pngtuber') {
        socket.emit('toggleSource', { source: 'PNGTuber', visible: true });
        aliceAudio.play();
      }
    }

    reward.time -= dt;
    camRewardQueue[0] = reward;

    // Remove this reward from the queue
    if (reward.time <= 0) {
      camRewardQueue.shift();
      socket.emit('toggleSource', { source: 'OverlayCam', visible: true });
      if (reward.type === 'emote') {
        camEmote.style.visibility = 'hidden';
      }
      if (reward.type === 'pngtuber') {
        socket.emit('toggleSource', { source: 'PNGTuber', visible: false });
      }
    }
  }
}

// Send Fall Guys info to the server
const updateFG = () => {
  socket.emit('updateFGInfo', {
    totalWins: totalWins,
    sessionAttempts: sessionAttempts,
    sessionWins: sessionWins,
    winRate: winRate,
    winStreak: winStreak,
    highWinStreak: highWinStreak,
    eliminations: eliminations,
    sessionRounds: sessionRounds,
    teamRounds: teamRounds,
    teamEliminations: teamEliminations,
    finalStats: finalStats,
  });

  // Update info messages as well
  updateInfo();
};

// Add win for a given level
const addWin = (level) => {
  totalWins++;
  sessionWins++;
  winStreak++;
  highWinStreak = winStreak > highWinStreak ? winStreak : highWinStreak;
  let finalLevelInfo = finalStats.find((e) => {
    return e.name === level;
  });
  finalLevelInfo.wins++;
};

// Used when resetting a run
const resetRun = () => {
  console.dir('run reset');
  // Clear out all users who have given luck
  lucks = [];
  luckTimeouts.forEach((luckTO) => {
    clearTimeout(luckTO.timeout);
  });

  luckTimeouts = [];

  // Reset tracked pokemon
  if (pokemon) {
    resetTracker();
  }
};

// Used when starting a run
function startRun() {
  console.dir('run started');
  sessionAttempts++;
  if (overlayQueue.length > 2) {
    // Adjust the overlay queue to prioritize start
    let currentOverlay = overlayQueue.shift();
    overlayQueue.unshift({
      type: 'start',
      time: 600,
      maxTime: 600,
      newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
    });
    overlayQueue.unshift(currentOverlay);
  } else {
    // Start overlay
    overlayQueue.push({
      type: 'start',
      time: 600,
      maxTime: 600,
      newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
    });
  }
}

// Get stat information from server
function getStats() {
  // Get the stats json from the server
  // This allows us to keep session info until I want to manually reset it
  // We can also store more information as a result (Weekly statistics/etc.)
  fetch('/stats')
    .then((res) => res.json())
    .then((stats) => {
      console.dir(stats);
      setStats(stats);
    });

  fetch('/gnosia')
    .then((res) => res.json())
    .then((stats) => {
      gnosiaStats = stats;
      roleIndex = gnosiaRoles.indexOf(gnosiaStats.role);
    });
}

function getEmotes() {
  fetch('/emotes')
    .then((res) => res.json())
    .then((emotesJSON) => {
      if (emotesJSON.hasOwnProperty('emotes')) {
        let ems = emotesJSON.emotes;
        for (const emoteName in ems) {
          let emote = ems[emoteName];
          /*if (emote.hasOwnProperty('size')) {
            emotes.push(new Emote())
          } else {

          }*/
          emotes.push(new Emote(emoteName, emote.img, false, emote.size));
        }
      }
      if (emotesJSON.hasOwnProperty('gifEmotes')) {
        let ems = emotesJSON.gifEmotes;
        for (const emoteName in ems) {
          let emote = ems[emoteName];
          emotes.push(new Emote(emoteName, emote.img, true, emote.size));
        }
      }
    });
}

const setStats = (stats) => {
  totalWins = stats.totalWins;
  sessionAttempts = stats.sessionAttempts;
  sessionWins = stats.sessionWins;
  winRate = stats.winRate;
  winStreak = stats.winStreak;
  highWinStreak = stats.highWinStreak;
  eliminations = stats.eliminations;
  sessionRounds = stats.sessionRounds;
  teamRounds = stats.teamRounds;
  teamEliminations = stats.teamEliminations;
  finalStats = stats.finalStats;

  updateInfo();
};

const updateInfo = () => {
  sessionInfoMessages[0].message = totalWins;
  sessionInfoMessages[1].message = sessionAttempts;
  sessionInfoMessages[2].message = sessionWins;
  sessionInfoMessages[3].message = winStreak;
  sessionInfoMessages[4].message = highWinStreak;
  sessionInfoMessages[5].message = winRate;
};

const toggleFallGuys = () => {
  fallGuys = !fallGuys;
};

const toggleGnosia = () => {
  gnosia = !gnosia;
};

const toggleSpeedrun = () => {
  speedrun = !speedrun;
  console.dir(speedrun);

  if (!speedrun) {
    running = true;
    overlayQueue.push({
      type: 'start',
      time: 600,
      maxTime: 600,
      newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
    });
  } else {
    running = false;
    overlayQueue.push({
      type: 'reset',
      time: 600,
      maxTime: 600,
      newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
      sound: false,
    });
  }
};

// Connect
function connect() {
  let heartbeatInterval = 1000 * 60; //ms between PING's
  let reconnectInterval = 1000 * 3; //ms to wait before reconnect
  let heartbeatHandle;

  // Reset session by hitting r
  window.addEventListener('keypress', (event) => {
    if (event.key === 'r') {
      socket.emit('resetSession');
    } else if (event.key === 'c') {
      overlayQueue.push({
        type: 'shift',
        time: 600,
        maxTime: 600,
        newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
      });
    } else if (event.key === 'f') {
      toggleFallGuys();
    } else if (event.key === 'g') {
      toggleGnosia();
    } else if (event.key === 'u') {
      getStats();
    } else if (event.key === 's') {
      toggleSpeedrun();
    }
  });

  socket = io.connect();

  socket.on('resetSession', (stats) => {
    setStats(stats);
  });

  socket.on('diceRoll', (user) => {
    console.dir('rolling!!!');
    diceRewardQueue.push({
      user: user,
      time: 9700,
      maxTime: 9700,
    });
  });

  socket.on('getLuck', (user) => {
    console.dir('rolling!!!');
    diceRewardQueue.push({
      user: user,
      time: 9700,
      maxTime: 9700,
    });
  });

  socket.on('reset', () => {
    resetRun();
  });

  socket.on('end', () => {
    resetRun();
  });

  socket.on('split', (split) => {
    if (pokemon) {
      addTrackedPokemonBySplit(split);
    }
  });

  initPokemonSocket(socket);

  socket.emit('lsConnect');

  // Get stats from server (not functional yet)
  getStats();

  // Populate reset sounds
  let noWay = new Audio('/media/sounds/NoWay.wav');
  let dumbWay = new Audio('/media/sounds/WhatADumbWayToGo.wav');
  resetSounds.push(noWay);
  resetSounds.push(noWay);
  resetSounds.push(noWay);
  resetSounds.push(dumbWay);

  // Populate emotes
  // There is definitely a better way of doing this. Is there an API that can get an image URL by emote name?
  getEmotes();

  // Set up Canvases
  overlayCanvas = document.getElementById('overlayCanvas');
  overlayCtx = overlayCanvas.getContext('2d');
  gameCanvas = document.getElementById('gameCanvas');
  gameCtx = gameCanvas.getContext('2d');
  camEmote = document.getElementById('camEmote');

  greyDie = document.getElementById('greyDie');

  requestAnimationFrame(updateOverlay);

  // Create and open WebSocket
  ws = new WebSocket('wss://pubsub-edge.twitch.tv');
  ws.onopen = (event) => {
    heartbeat();
    heartbeatHandle = setInterval(heartbeat, heartbeatInterval);

    fetch('https://api.twitch.tv/kraken/channel', {
      headers: {
        'client-id': clientId,
        authorization: 'OAuth ' + sessionStorage.twitchOAuthToken,
        accept: 'application/vnd.twitchtv.v5+json',
      },
    }).then((resp) => {
      resp.json().then((channel) => {
        channelId = channel._id;
        listen();
      });
    });
  };

  ws.onerror = (error) => {
    console.dir(error);
  };

  ws.onmessage = (event) => {
    let message = JSON.parse(event.data);

    if (message.type == 'RECONNECT') {
      // Attempt to reconnect after a specified period of time
      setTimeout(connect, reconnectInterval);
    } else if (message.type == 'MESSAGE') {
      let redemption = JSON.parse(message.data.message).data.redemption;

      console.dir(redemption.reward.id);
      if (redemption.reward.id === 'b67d2fa1-8a59-48fa-9727-c997a4734325') {
        // Channel point reward for giving luck
        let rewardUser = redemption.user.display_name;

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
        } else if (luckNum < 997) {
          // ~5.5% chance to curse the run
          luckId = 'curse';
          luckTime = 6000;
          luckMessage = `Oh no! ${rewardUser} cursed the run!`;
          luckAudio = cursedAudio;
        } else if (luckNum < 1000) {
          // 0.3% chance for a gifted sub
          luckId = 'sub';
          luckTime = 6000;
          luckFont = '58px Arial';
          luckMessage = `Lucky day for ${rewardUser}! Enjoy a gift sub!`;
          luckAudio = fanfareAudio;
        }

        console.dir(luckTimeouts);

        // Add this to the queue if the user has not yet given luck
        if (!lucks.includes(rewardUser)) {
          rewardQueue.push({
            id: luckId,
            type: 'luck',
            user1: rewardUser,
            message: luckMessage,
            splitMessage: [],
            font: luckFont,
            audio: luckAudio,
            time: luckTime,
            maxTime: luckTime,
          });
          lucks.push(rewardUser);

          let luckTO = setTimeout(() => {
            lucks.splice(lucks.indexOf(rewardUser), 1);
            let results = luckTimeouts.filter((luckTO) => {
              return luckTO.user === rewardUser;
            });
            if (results.length > 0) {
              luckTimeouts.splice(luckTimeouts.indexOf(results[0]), 1);
            }
          }, luckInterval);
          luckTimeouts.push({
            user: rewardUser,
            time: Date.now(),
            timeout: luckTO,
            interval: luckInterval,
          });
        } else {
          let results = luckTimeouts.filter((luckTO) => {
            return luckTO.user === rewardUser;
          });
          console.dir(results);
          if (results.length > 0) {
            let timeoutOBJ = results[0];
            timeoutOBJ.cause = 'reward';
            socket.emit('luckTime', timeoutOBJ);
          }
        }
      } else if (
        redemption.reward.id === 'e1d249af-4baf-4644-b53e-27376e79b234'
      ) {
        // Channel point reward for facecam emote
        // Split the message on spaces
        let userMsg = redemption.user_input.toLowerCase().split(' ');

        let selectedEmote;
        if (userMsg.length > 0) {
          // Get the first supported emote in the message
          for (let i = 0; i < userMsg.length; i++) {
            let emoteName = userMsg[i].replace(/\s/g, '');
            console.dir(emoteName);

            selectedEmote = emotes.find((e) => {
              return e.name.toLowerCase() === emoteName;
            });

            if (selectedEmote) {
              break;
            }
          }
        }

        if (selectedEmote) {
          // Add this to the queue
          camRewardQueue.push({
            type: 'emote',
            emote: selectedEmote,
            time: 30000,
            maxTime: 30000,
          });
        }
      } else if (
        redemption.reward.id === 'e41c949f-8ffb-40fa-94b4-e2cf73594bed'
      ) {
        // Channel point reward for PNGTuber

        // Add this to the queue
        camRewardQueue.push({
          type: 'pngtuber',
          time: 60000,
          maxTime: 60000,
        });
      } else if (
        redemption.reward.id === '1b9fe4b3-6571-49be-b467-eb687dfd51ef'
      ) {
        console.dir('shift reward redeemed');
        // Channel point reward for shifting layout
        overlayQueue.push({
          type: 'shift',
          time: 600,
          maxTime: 600,
          newOverlay: new Image(overlayCanvas.width, overlayCanvas.height),
        });
      } else if (
        redemption.reward.id === '4273cc94-01d2-44fd-8b46-0e4e970e261c'
      ) {
        console.dir(redemption);
        // Channel point reward for d20 roll
        // Die position: 566, 862
        // Die dimensions: 172, 198
        diceRewardQueue.push({
          user: redemption.user,
          time: 9700,
          maxTime: 9700,
        });
      } else if (
        redemption.reward.id === '28bd23f0-85d9-4f73-a6d9-6fa6ed7da060'
      ) {
        socket.emit('skipSong');
      } else if (
        redemption.reward.id === 'f52487ee-c191-4d8d-be00-edcf9b622abb'
      ) {
        socket.emit('backSong');
      }
    }
  };

  ws.onclose = function () {
    // Socket has been closed. Reconnect
    clearInterval(heartbeatHandle);
    setTimeout(connect, reconnectInterval);
  };
}

$(function () {
  if (document.location.hash.match(/access_token=(\w+)/))
    parseFragment(document.location.hash);
  if (sessionStorage.twitchOAuthToken) {
    // If this has already been connected to Twitch, show the layout
    connect();
    console.dir('Connected');
    console.dir(sessionStorage.twitchOAuthToken);
    $('.rewards').show();
  } else {
    // Not connected to Twitch, ask to connect
    let url = authUrl();
    $('#auth-link').attr('href', url);
    $('.auth').show();
  }
});

$('#topic-form').submit(function () {
  listen();
  event.preventDefault();
});
