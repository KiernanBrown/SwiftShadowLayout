const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || process.env.NODE_PORT || 3000;
const OBSWebSocket = require('obs-websocket-js');

const obs = new OBSWebSocket();
let obsScenes = [];
let obsSceneNames = [];
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
});

// Make something where client can set scene while providing a scene name
// This should be done using SocketIO
// Use this for changing scene on Reset, Start, and Shift reward

/*obs.send('SetCurrentScene', {
  'scene-name': 'Blue Overlay'
});*/

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
