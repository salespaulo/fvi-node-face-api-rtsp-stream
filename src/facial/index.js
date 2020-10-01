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

const path = require('path')
const sharp = require('sharp')
const moment = require('moment')

const Stream = require('node-rtsp-stream')

const DEFAULT_PORT = 6789

const FaceApiRtspStreamConsumer = function (opts = {}) {
    opts = {
        name: opts.name || `FacialApi_RTSP_${Math.round(Math.random() * 1000000)}`,
        ...opts,
    }

    this.options = {
        score: opts.score || 0.5,
        ...opts,
    }

    if (this.options && this.options.url) {
        this.stream = new Stream({
            name: this.options.name,
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

        if (this.options.jsmpegPort) {
            this.streamJsmpeg = new Stream({
                name: this.options.name,
                streamUrl: this.options.url,
                wsPort: this.options.jsmpegPort,
                ffmpegOptions: {
                    '-stats': '',
                    '-r': 30,
                    '-f': 'mpegts',
                    '-codec:v': 'mpeg1video',
                    '-codec:a': 'mp2',
                    '-bf': 0,
                },
            })
        }
    } else {
        const message = 'Facial Api Rtsp Stream Consumer - Loading Failed!'
        this.emit('error', { name: this.options.name, message })
        throw new Error(message)
    }

    this.stream.on('exitWithError', () => {
        this.emit('error', {
            name: this.options.name,
            buffer: this.buff,
            message: `RTSP Stream Exit With Error - Stream Closed - See logs!`,
        })
    })

    this.buff = Buffer.from('')
}

util.inherits(FaceApiRtspStreamConsumer, EventEmitter)

FaceApiRtspStreamConsumer.prototype._load = async function () {
    try {
        // Load from source
        let weightsDir =
            this.options.weightsDir || path.join(path.resolve(), 'src', 'facial', 'weights')

        await faceapi.nets.tinyFaceDetector.loadFromDisk(weightsDir)
        await faceapi.nets.faceExpressionNet.loadFromDisk(weightsDir)
        await faceapi.nets.faceLandmark68Net.loadFromDisk(weightsDir)
        await faceapi.nets.ageGenderNet.loadFromDisk(weightsDir)
        this.emit('load', { name: this.options.name, stream: this.stream })
    } catch (e) {
        this.emit('error', e)
    }
}

FaceApiRtspStreamConsumer.prototype._clear = function () {
    this.buff = Buffer.from('')
    return this.buff
}

FaceApiRtspStreamConsumer.prototype._faceDetect = async function () {
    const detectedAt = moment().format()
    const img = await canvas.loadImage(this.buff)

    const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender()

    const detectionsArray = Array.isArray(detections) ? detections : [detections]

    if (detectionsArray.length > 0) {
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

            boxRound.width = boxRound.width < 1 ? 1 : boxRound.width
            boxRound.height = boxRound.height < 1 ? 1 : boxRound.height

            const out = faceapi.createCanvasFromMedia(img)
            const outBuff = out.toBuffer()
            const imgFullBuffer = await sharp(outBuff).clone().toBuffer()
            const imgCroppedBuffer = await sharp(outBuff).clone().extract(boxRound).toBuffer()

            // Enviar para o backend
            const data = {
                url: this.options.url || 'stream',
                port: this.options.port || DEFAULT_PORT,
                detectedAt,
                image: imgFullBuffer,
                imageCropped: imgCroppedBuffer,
                out,
                face: det,
            }

            const result = { name: this.options.name, buffer: this.buff, data }
            this.emit('detect', result)
            return result
        })

        await Promise.all(promises)
    }

    this._clear()
}

FaceApiRtspStreamConsumer.prototype.start = async function () {
    try {
        this.emit('start', { name: this.options.name, stream: this.stream })

        await this._load()

        this.stream.on('camdata', async data => {
            try {
                if (data.length <= 1) {
                    const message = `Camera Data is lower than 2 bytes!`
                    this.emit('error', { name: this.options.name, message })
                    throw new Error(message)
                }

                this.buff = Buffer.concat([this.buff, data])
                offset = data[data.length - 2].toString(16)
                offset2 = data[data.length - 1].toString(16)

                if (offset == 'ff' && offset2 == 'd9') {
                    // Dados corretos para deteccao facial
                    this.emit('data', { name: this.options.name, buffer: this.buff })
                    return await this._faceDetect()
                }

                this.emit('warn', {
                    name: this.options.name,
                    message: `Not Match offset=${offset} != 'ff'; offset2=${offset2} != 'd9', continue consumnig...`,
                })
                return await Promise.resolve({ buffer: this.buff })
            } catch (e) {
                console.error(e)
                return Promise.reject(e)
            }
        })
    } catch (e) {
        this.emit('error', e)
    }
}

FaceApiRtspStreamConsumer.prototype.stop = function () {
    this.emit('stop', { name: this.options.name, buffer: this.buff })
    if (this.streamJsmpeg) {
        this.streamJsmpeg.stop()
    }

    this.stream.stop()
    this._clear()
}

module.exports = FaceApiRtspStreamConsumer
