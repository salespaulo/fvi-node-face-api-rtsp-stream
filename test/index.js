const FaceApiRtspStream = require('../src/index.js')

describe(`Testing`, () => {
    it(`Init`, done => {
        const instance = FaceApiRtspStream({
            url: 'rtsp://localhost:8554/cam',
            port: 8081,
        })
        instance.on('detect', event => {
            console.log('>>>>>> detect:', event)
        })
        instance.on('error', e => {
            console.log('>>>>>> error:', e)
            done(e)
        })
        instance
            .start()
            .then(res => {
                setTimeout(() => done(), 2 * 60 * 1000)
            })
            .catch(e => done(e))
    })
})
