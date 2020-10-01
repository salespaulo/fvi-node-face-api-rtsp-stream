const sharp = require('sharp')
const path = require('path')

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

const weightsDir = path.join(path.resolve(), '..', 'src/facial/weights')

// Now code!
const app = require('express')()
const server = require('http').Server(app)
const util = require('util')
const EventEmitter = require('events').EventEmitter

const WebSocket = require('ws')
const FaceApiRtspStream = require('../src')

server.listen(8081)

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/ws-index.html')
})

app.get('/jsmpeg.min.js', function (req, res) {
    res.sendFile(__dirname + '/jsmpeg.min.js')
})

const faceDetect = FaceApiRtspStream({
    url: 'rtsp://localhost:8554/cam',
    port: 6789,
    weightsDir,
})

const Controller = function () {}

util.inherits(Controller, EventEmitter)

const controller = new Controller()

faceDetect
    .start()
    .then(res => console.log('> STARTED'))
    .catch(e => console.error(e))

faceDetect.on('load', event => {
    console.log('> LOADED', event.name)
})

faceDetect.on('detect', event => {
    console.log('> DETECTED:', event.name, ':', event.data.detectedAt)

    try {
        const face = event.data.face
        const out = event.data.out

        faceapi.draw.drawDetections(out, [face.detection])
        faceapi.draw.drawFaceExpressions(out, [face])

        const { age, gender, genderProbability } = face
        new faceapi.draw.DrawTextField(
            [
                `${faceapi.utils.round(age, 0)} years`,
                `${gender} (${faceapi.utils.round(genderProbability)})`,
            ],
            face.detection.box.bottomLeft
        ).draw(out)

        faceapi.draw.drawFaceLandmarks(out, face.landmarks)
        controller.emit('socket', out.toBuffer())

        /* Save images on disk
            sharp(event.data.image)
                .clone()
                .toFile(`img-${event.data.detectedAt}.jpeg`)
                .then(res => console.log('> Save image!'))
                .catch(e => console.error(e))
            sharp(event.data.imageCropped)
                .clone()
                .toFile(`cropped-${event.data.detectedAt}.jpeg`)
                .then(res => console.log('> Save image cropped!'))
                .catch(e => console.error(e))
            */
    } catch (e) {
        console.error(e)
    }
})
const wsServer = new WebSocket.Server({
    port: 6790,
})

wsServer.on('connection', (socket, request) => {
    console.log(`New WebSocket Connection (` + wsServer.clients.size + ' total)')

    controller.on('socket', data => {
        socket.send(data)
    })

    socket.remoteAddress = request.connection.remoteAddress
    socket.on('close', (code, message) => {
        return console.log('Disconnected WebSocket', code, message)
    })
})