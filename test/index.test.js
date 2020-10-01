const FaceApiRtspStream = require('../src/index.js')

describe(`Testing`, () => {
    it(`Init`, done => {
        const instance = FaceApiRtspStream({
            url: 'rtsp://localhost:8554/cam',
            port: 8081,
        })
        instance.on('detect', event => {
            console.log('> detect:', event.name, ':', event.data.detectedAt)
        })
        instance.on('error', e => {
            console.log('> error:', e)
            done(e)
        })
        instance
            .start()
            .then(res => {
                setTimeout(() => done(), 5000)
            })
            .catch(e => done(e))
    })
})
