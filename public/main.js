const clientId = 'ttwsfmzramvda8ualo9mi9gc701580';
const redirectURI = 'https://swiftshadow-layout.glitch.me/';
const scope = 'channel_read+channel:read:redemptions';
let channelId;
let ws;
let splitsSocket;
let blueCanvas;
let blueCtx;
let gameCanvas;
let gameCtx;
let camCanvas;
let camCtx;
let camEmote;
let camBlack;
let lastUpdate = Date.now();

// Audio files for luck
const goodLuckAudio = new Audio('https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FGood%20Luck.mp3?v=1594953838510');
const badLuckAudio = new Audio('https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FYikes.mp3?v=1594970570632');
const glhfAudio = new Audio('https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FGLHF.mp3?v=1594970570704');
const cursedAudio = new Audio('https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FTerror.mp3?v=1594970570659');
const fanfareAudio = new Audio('https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FFanfare.mp3?v=1594970570936');

let lucks = [];
let rewardQueue = [];
let camRewardQueue = [];
let shift = 'blue';
let emotes = [];
const emoteSize = 202; // Facecam emote size in pixels

// Emote class
// Emotes are created given a name, image, and size (default of 112)
class Emote {
  constructor(name, url, size) {
    this.name = name;
    this.url = url;
    this.size = size ? size : 112;
    this.img = new Image(this.size, this.size);
    this.img.src = url;

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

// Show any rewards that are in the queues
function showRewards() {
  let dt = Date.now() - lastUpdate; // Delta time
  lastUpdate = Date.now();

  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  if (rewardQueue.length != 0) {
    console.dir('REWARD!');
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
          if (shift === 'blue') {
            gameCtx.fillStyle = `rgba(61, 65, 166, ${opacity})`;
          } else if (shift === 'red') {
            gameCtx.fillStyle = `rgb(204, 18, 0, ${opacity})`;
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

  requestAnimationFrame(showRewards);
}

// Used when resetting a run
function resetRun() {
  // Clear out all users who have given luck
  lucks = [];
}

function startSplitsSocket() {
  
}

// Connect
function connect() {
  var heartbeatInterval = 1000 * 60; //ms between PING's
  var reconnectInterval = 1000 * 3; //ms to wait before reconnect
  var heartbeatHandle;

  // Reset the run when hitting -
  // This should (hopefully) be changed in the future to work with LiveSplit's Reset event (using LiveSplit Server WebSocket?)
  window.addEventListener("keypress", (event) => {
    if (event.code === 'NumpadSubtract') {
      resetRun();
    }
  });

  // Populate emotes
  // There is definitely a better way of doing this. Is there an API that can get an image URL by emote name?
  emotes.push(new Emote('swifts7Bless', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSwiftShadow_AerithBless.png?v=1595560196571', 1000));
  emotes.push(new Emote('swifts7Flex', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSwiftShadow_TifaFlex.png?v=1595560196740', 1000));
  emotes.push(new Emote('swifts7Blush', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSwiftShadow_CloudBlush.png?v=1595560197015', 1000));
  emotes.push(new Emote('swifts7Troll', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSwiftShadow_RocheTroll.png?v=1595560197073', 1000));
  emotes.push(new Emote('swifts7Rage', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSwiftShadow_MadamMRage.png?v=1595560197663', 1000));
  emotes.push(new Emote('swifts7Love', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7LoveL.png?v=1595560180578'));
  emotes.push(new Emote('swifts7NotLikeThis', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7NotLikeThisL.png?v=1595560180762'));
  emotes.push(new Emote('swifts7POGGERS', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7POGGERSL.png?v=1595560180692'));
  emotes.push(new Emote('swifts7Pout', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7PoutL.png?v=1595560181002'));
  emotes.push(new Emote('swifts7Wink', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7TTL.png?v=1595560181028'));
  emotes.push(new Emote('swifts7Nut', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7NutL.png?v=1595560181050'));
  emotes.push(new Emote('swifts7Hi', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7HiL.png?v=1595560180646'));
  emotes.push(new Emote('swifts7Nice', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7NiceL.png?v=1594952518885'));
  emotes.push(new Emote('swifts7EZ', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7EZL.png?v=1595560180923'));
  emotes.push(new Emote('swifts7LMAO', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7LMAOL.png?v=1595560180627'));
  emotes.push(new Emote('swifts7Gun', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7GunL.png?v=1595560180859'));
  emotes.push(new Emote('swifts7AYAYA', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7AYAYAL.png?v=1595560180604'));
  emotes.push(new Emote('swifts7Pog', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7PogL.png?v=1595560180667'));
  emotes.push(new Emote('Swifts7Sandbag', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2Fswifts7SandbagResized.png?v=1595570229802', 128));
  emotes.push(new Emote('PepeHands', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FPepeHands.png?v=1594948745241', 128));
  emotes.push(new Emote('YEP', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FYep.png?v=1594952194613', 128));
  emotes.push(new Emote('Pepega', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FPepega.png?v=1595570589772'));
  emotes.push(new Emote('Sadge', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSadge.png?v=1595570752340'));
  emotes.push(new Emote('POGGERS', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FPOGGERS.png?v=1594952696631'));
  emotes.push(new Emote('YuukoBlank', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FYuukoBlank.png?v=1594952305010', 128));
  emotes.push(new Emote('TimesaveForNextRun', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FTimesaveForNextRun.png?v=1594952630985', 128));
  emotes.push(new Emote('MioNotLikeThis', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FMioNotLikeThis.png?v=1595104387116'));
  emotes.push(new Emote('peepoPOG', 'https://cdn.betterttv.net/emote/5b69afcde1dd39261a3b9d53/3x'));
  emotes.push(new Emote('peepoS', 'https://cdn.betterttv.net/emote/5a26924bfc6e584787d98544/3x'));
  emotes.push(new Emote('peepoHappy', 'https://cdn.betterttv.net/emote/5a16ee718c22a247ead62d4a/3x'));
  emotes.push(new Emote('peepoSad', 'https://cdn.betterttv.net/emote/5a16ddca8c22a247ead62ceb/3x'));
  
  // GIF Emotes
  emotes.push(new Emote('YuukoGasm', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FYuukoGasm.gif?v=1595104387634'));
  emotes.push(new Emote('RainbowPls', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FRainbowPls.gif?v=1595112882845'));
  emotes.push(new Emote('kannaDansu', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FkannaDansu.gif?v=1595112916803'));
  emotes.push(new Emote('ThisIsFine', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FThisIsFine.gif?v=1595112917925'));
  emotes.push(new Emote('SandbagHop', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FSandbagHop.gif?v=1595570277899'));
  emotes.push(new Emote('PeepoPooPoo', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FpeepoPooPoo.gif?v=1595570642274'));
  emotes.push(new Emote('monkaSTEER', 'https://cdn.glitch.com/fb3616f0-e04e-498a-a49a-c7fd168463d8%2FmonkaSTEER.gif?v=1596949988825', 110));
  emotes.push(new Emote('WAYTOOPOGGERS', 'https://cdn.betterttv.net/emote/5f2672a5fe85fb4472d1e207/3x'));
  emotes.push(new Emote('blobDance', 'https://cdn.betterttv.net/emote/5ada077451d4120ea3918426/3x'));
  emotes.push(new Emote('peepoSHAKE', 'https://cdn.betterttv.net/emote/5b83938ca69b8634bf059473/3x'));

  // Set up Canvases
  blueCanvas = document.getElementById('blueCanvas');
  blueCtx = blueCanvas.getContext('2d');
  gameCanvas = document.getElementById('gameCanvas');
  gameCtx = gameCanvas.getContext('2d');
  camCanvas = document.getElementById('camCanvas');
  camCtx = camCanvas.getContext('2d');
  camEmote = document.getElementById('camEmote');
  camBlack = document.getElementById('camBlack');

  requestAnimationFrame(showRewards);

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

      if (redemption.reward.id === "b67d2fa1-8a59-48fa-9727-c997a4734325") {
        // Channel point reward for giving luck
        var rewardUser = redemption.user.display_name;

        // Generate what type of luck
        let luckNum = Math.floor(Math.random() * 750);
        let luckTime = 4000;
        let luckMessage = '';
        let luckId = '';
        let luckAudio;
        let luckFont = '64px Arial';

        if (luckNum < 413) {
          // ~55% chance of good luck
          luckId = 'good';
          luckMessage = `${rewardUser} has given Good Luck!`;
          luckAudio = goodLuckAudio;
        } else if (luckNum < 616) {
          // ~27% chance of bad luck
          luckId = 'bad';
          luckMessage = `${rewardUser} has given Bad Luck!`;
          luckAudio = badLuckAudio;
        } else if (luckNum < 702) {
          // ~12% chance of glhf
          luckId = 'glhf';
          luckMessage = `GLHF from ${rewardUser}!!!`;
          luckAudio = glhfAudio;
        } else if (luckNum < 747) {
          // ~5.8% chance to curse the run
          luckId = 'curse';
          luckTime = 6000;
          luckMessage = `Oh no! ${rewardUser} cursed the run!`;
          luckAudio = cursedAudio;
        } else if (luckNum < 750) {
          // 0.4% chance for a gifted sub
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
