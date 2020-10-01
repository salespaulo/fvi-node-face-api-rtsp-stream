# Requirements

-   Requires [ffmpeg](https://ffmpeg.org/).

# About

The Node Face API RTSP Stream library uses [face-api.js](https://justadudewhohacks.github.io/face-api.js/docs/index.html) and [node-rtsp-stream]https://github.com/kyriesent/node-rtsp-stream#readme) to consumes data messages from RTSP Stream and detect faces on it.

# How to Use

```javascript
const FaceApiRtspStream = require('fvi-node-face-api-rtsp-stream')

const instance = FaceApiRtspStream({
    name: '',
    url: '',
    port: 6789,
    score: 0.5,
    stream: 'new node-rtsp-stream/videoStream()',
})
```

# Lab

Into directory `lab` you find tests with this library using [WebSocket]https://github.com/websockets/ws) and [jsmpeg.js]https://github.com/phoboslab/jsmpeg). Let's look join it!

-   ws-index.test.js: Starts `fvi-node-face-api-rtsp-stream`, collects face detects, draw details and send, `WebSocket.socket.send`, buffered image to `ws-index.html`.

-   ws-index.html: Connects to WebSocket, get buffered images and show.

## Run

```bash
npm i
cd lab
node ws-index.test.js
```

> After this, opens browser url http://localhost:8081 to see images.

# Licence

MIT
