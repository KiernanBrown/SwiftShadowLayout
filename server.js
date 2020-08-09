const express = require("express");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = 3000;


// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

http.listen(port, () => {
  console.log(`Listening on ${port}`);
});
