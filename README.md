# Requirements

-   Requires [ffmpeg]https://ffmpeg.org/).

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
    mtcnn: {},
})
```

## MTCNN Opts

```javascript
{
    mtcnn: {
        // number of scaled versions of the input image passed through the CNN
        // of the first stage, lower numbers will result in lower inference time,
        // but will also be less accurate
        maxNumScales: Number
        // scale factor used to calculate the scale steps of the image
        // pyramid used in stage 1
        scaleFactor: Number
        // the score threshold values used to filter the bounding
        // boxes of stage 1, 2 and 3
        scoreThresholds: Array<Number>
        // mininum face size to expect, the higher the faster processing will be,
        // but smaller faces won't be detected
        minFaceSize: Number
    }
}
```

# Licence

MIT
