# SwiftShadow Layout
This project is a Twitch Overlay that I use when streaming (specifically speedrunning). This is used in a Browser source in OBS that is placed on top of my gameplay/webcam/other elements I have on stream. Could be a useful reference for other streamers/devs that want to interact wtih channel points for their own streams as well.

### LiveSplit Components
This requires you to use the LiveSplit WebSocket Server component in livesplit due to planned features for the future. This component allows us to read information from and send information to livesplit using a WebSocket connection. The download and setup information for this component can be found here: [https://github.com/MeGotsThis/LiveSplit.WebSocketServer](https://github.com/MeGotsThis/LiveSplit.WebSocketServer)

### OBS Plugins
This requries you to use the obs-websockt plugin for OBS in order to change scenes in OBS. The download and setup information for this plugin can be found here: [https://obsproject.com/forum/resources/obs-websocket-remote-control-obs-studio-from-websockets.466/](https://obsproject.com/forum/resources/obs-websocket-remote-control-obs-studio-from-websockets.466/)

This also uses obs-websocket-js in order to change scenes using Node. Documentation for this can be found here: [https://github.com/haganbmj/obs-websocket-js](https://github.com/haganbmj/obs-websocket-js)


### Snip
Snip is being used to get the current song that is being played through spotify. The Snip folder is placed inside of the public folder of this project. Snip can be found here: [https://github.com/dlrudie/Snip/](https://github.com/dlrudie/Snip/)

### Current Features
* Support for channel point rewards being redeemed:
  * Chat members can give luck to me during a run as a channel point reward. This will pick from a set of messages to display on stream and play a sound effect.
  * Chat members can replace my facecam with a supported emote of thier choice.
  * Chat members can redshift/blueshift my layout which will toggle the overlay color from red to blue.
* Overlay changes colors based on if a run is in progress or not. This changes both the image color on the webpage and also the current scene in OBS.
* Chatbot commands such as !wins and !streak for Fall Guys streams and !song for when a Spotify playlist is going

### Planned Features
* Support more emotes for the facecam emote reward. Look into a way of getting an emote URL just providing the name of an emote (I haven't found anything on this front yet).
* Chat members will be able to modify the color of my layout in some way.
* Overlay color changes when golding a split.