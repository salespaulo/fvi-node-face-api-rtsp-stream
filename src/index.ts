import VideoStream from 'node-rtsp-stream/videoStream'
import FaceApiRtspStreamConsumer from './facial'

interface MtcnnOpts {
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

interface RtspStreamOpts {
    name: String
    url: String
    port: Number
    stream: VideoStream
    score: Number
    mtcnn: MtcnnOpts
}

export default (opts: RtspStreamOpts) => new FaceApiRtspStreamConsumer(opts)
