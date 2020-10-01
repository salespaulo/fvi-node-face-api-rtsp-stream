// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)
require('@tensorflow/tfjs-node')

const faceapi = require('face-api.js')

// implements nodejs wrappers for HTMLCanvasElement, HTMLImageElement, ImageData
const canvas = require('canvas')

// patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement
const { Canvas, Image, ImageData } = canvas

faceapi.env.monkeyPatch({ Canvas, Image, ImageData })

// Now code!
const util = require('util')
const EventEmitter = require('events').EventEmitter

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const moment = require('moment')

const Stream = require('node-rtsp-stream')

const DEFAULT_PORT = 6789

const FaceApiRtspStreamConsumer = function (opts = {}) {
    opts = { mtcnn: opts.mtcnn || {}, ...opts }
    this.options = {
        mtcnn: {
            maxNumScales: opts.mtcnn.maxNumScales || 10,
            scaleFactor: opts.mtcnn.scaleFactor || 0.709,
            scoreThresholds: opts.mtcnn.scoreThresholds || [0.6, 0.7, 0.7],
            minFaceSize: opts.mtcnn.minFaceSize || 20,
        },
        score: opts.score || 0.5,
        ...opts,
    }

    if (this.options && this.options.url) {
        this.stream = new Stream({
            name: this.options.name || `FacialApi_RTSP_${Math.random() * 10000}`,
            streamUrl: this.options.url,
            wsPort: this.options.port || DEFAULT_PORT,
            ffmpegOptions: {
                '-stats': '',
                // Opts needs to work face detect
                '-f': 'image2',
                '-vcodec': 'mjpeg',
                '-update': 1,
            },
        })
    } else if (this.options && this.options.stream) {
        this.stream = this.options.stream
    } else {
        const message = 'Facial Api Rtsp Stream Consumer - Loading Failed!'
        this.emit('error', { message })
        throw new Error(message)
    }

    this.stream.on('exitWithError', () => {
        this.emit('error', {
            buffer: this.buff,
            message: `RTSP Stream Exit With Error - Stream Closed - See logs!`,
        })
    })

    this.buff = Buffer.from('')
}

util.inherits(FaceApiRtspStreamConsumer, EventEmitter)

FaceApiRtspStreamConsumer.prototype._load = async function () {
    // Load from source
    let weightsDir = path.join(path.resolve(), 'src', 'facial', 'weights')

    // Load from node_modules
    if (!fs.existsSync(weightsDir)) {
        weightsDir = path.join(
            path.resolve(),
            'node_modules',
            path.basename(path.resolve(path.join(__dirname, '..', '..'))),
            'src',
            'facial',
            'weights'
        )
    }

    await faceapi.nets.mtcnn.loadFromDisk(weightsDir)
    await faceapi.nets.faceExpressionNet.loadFromDisk(weightsDir)
    await faceapi.nets.faceLandmark68Net.loadFromDisk(weightsDir)
    await faceapi.nets.ageGenderNet.loadFromDisk(weightsDir)

    this.emit('load', { stream: this.stream })
}

FaceApiRtspStreamConsumer.prototype._clear = function () {
    this.buff = Buffer.from('')
    return this.buff
}

FaceApiRtspStreamConsumer.prototype._faceDetect = async function () {
    const detectedAt = moment().format()
    const img = await canvas.loadImage(this.buff)

    const options = new faceapi.MtcnnOptions(this.options.mtcnn)
    const detections = await faceapi
        .detectAllFaces(img, options)
        // TODO: Config data into props
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender()

    const detectionsArray = Array.isArray(detections) ? detections : [detections]

    if (detectionsArray.length > 0) {
        const out = faceapi.createCanvasFromMedia(img)
        const outBuff = out.toBuffer()
        const imgFullBuffer = await sharp(outBuff).clone().toBuffer()

        const promises = detectionsArray.map(async det => {
            const score = det.detection.score
            const dims = det.detection.imageDims
            const box = det.detection.box

            const boxRound = {
                left: Math.round(box.x < 1 ? 1 : box.x),
                top: Math.round(box.y < 1 ? 1 : box.y),
                width: Math.round(
                    box.x + box.width <= dims.width ? box.width : box.x + box.width - dims.width
                ),
                height: Math.round(
                    box.y + box.height < dims.height ? box.height : box.y + box.height - dims.height
                ),
            }

            if (score < this.options.score && (boxRound.y < 1 || boxRound.x < 1)) {
                this._clear()
                return { buffer: this.b }
            }

            const imgCroppedBuffer = await sharp(outBuff).clone().extract(boxRound).toBuffer()

            // Enviar para o backend
            const data = {
                url: this.options.url || 'stream',
                port: this.options.port || DEFAULT_PORT,
                datatime: detectedAt,
                detection: det,
                files: {
                    image: imgFullBuffer,
                    imageCropped: imgCroppedBuffer,
                },
            }

            const result = { buffer: this.buff, data }
            this.emit('detect', result)
            return result
        })

        await Promise.all(promises)
    }

    this._clear()
}

FaceApiRtspStreamConsumer.prototype.start = async function () {
    try {
        this.emit('start', { stream: this.stream })

        await this._load()

        this.stream.on('camdata', async data => {
            if (data.length <= 1) {
                const message = `Camera Data is lower than 2 bytes!`
                this.emit('error', { message })
                throw new Error(message)
            }

            this.buff = Buffer.concat([this.buff, data])
            offset = data[data.length - 2].toString(16)
            offset2 = data[data.length - 1].toString(16)

            if (offset == 'ff' && offset2 == 'd9') {
                // Dados corretos para deteccao facial
                this.emit('data', { buffer: this.buff })
                return await this._faceDetect()
            }

            this.emit('warn', {
                message: `Not Match offset=${offset} != 'ff'; offset2=${offset2} != 'd9', continue consumnig...`,
            })
            return await Promise.resolve({ buffer: this.buff })
        })
    } catch (e) {
        this.emit('error', e)
    }
}

FaceApiRtspStreamConsumer.prototype.stop = function () {
    this.emit('stop', { buffer: this.buff })
    this._clear()
}

module.exports = FaceApiRtspStreamConsumer
