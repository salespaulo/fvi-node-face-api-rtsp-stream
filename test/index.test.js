const FaceApiRtspStream = require('../src/index.js')

describe(`Testing`, () => {
    it(`Init`, done => {
        const instance = FaceApiRtspStream({
            url: 'rtsp://localhost:8554/cam',
            port: 8081,
        })

        let count = 0

        instance.on('data', event => {
            console.log('> name:', event.name, ': size: ', event.buffer.length)
            count += 1

            if (count === 3) {
                instance.stop()
                done()
            }
        })

        instance.on('error', e => {
            console.log('> error:', e)
            instance.stop()
            done(e)
        })

        instance
            .start()
            .then(res => {
                console.log('> Start face detect', res)
                setTimeout(() => {
                    instance.stop()
                    done(`Not Data Receive!`)
                }, 3000)
            })
            .catch(e => done(e))
    })
})
