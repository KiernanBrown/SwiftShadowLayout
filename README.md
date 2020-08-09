# SwiftShadow Layout
This project is a Twitch Overlay that I use when streaming (specifically speedrunning). This is used in a Browser source in OBS that is placed on top of my gameplay/webcam/other elements I have on stream. Could be a useful reference for other streamers/devs that want to interact wtih channel points for their own streams as well.

### LiveSplit Components
This requires you to use the LiveSplit WebSocket Server component in livesplit due to planned features for the future. This component allows us to read information from and send information to livesplit using a WebSocket connection. The download and setup information for this component can be found here: [https://github.com/MeGotsThis/LiveSplit.WebSocketServer](https://github.com/MeGotsThis/LiveSplit.WebSocketServer)

### Current Features
* Support for channel point rewards being redeemed:
  * Chat members can give luck to me during a run as a channel point reward. This will pick from a set of messages to display on stream and play a sound effect.
  * Chat members can replace my facecam with a supported emote of thier choice.

### Planned Features
* Support more emotes for the facecam emote reward. Look into a way of getting an emote URL just providing the name of an emote (I haven't found anything on this front yet).
* Chat members will be able to modify the color of my layout in some way.
* Connect with LiveSplit Server to be able to detect when I split/reset/gold a split. This is being worked on now, as we are currently able to connect with LiveSplit using the component mentioned above.