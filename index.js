const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage')
const Grid = require('gridfs-stream')
const methodOverride = require('method-override')

const port = 80

/* mongodb */
const mongoose = require('mongoose')
const mongoURI = 'mongodb://admin:admin1@ds139435.mlab.com:39435/docstore'
const conn = mongoose.createConnection(mongoURI)
mongoose.connect(mongoURI)
let db = mongoose.connection
db.on('error', console.error.bind(console, 'MongoDb connection error:'))

// GridFs
let gfs
conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('uploads')
})
// storage 
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise ((resolve, reject) => {
            // encrypt filename
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err)
                }
                const filename = buf.toString('hex') + path.extname(file.originalname)
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                }
                
                resolve(fileInfo)
            })
        })
    }
})
const upload = multer({ storage })


let filesModel = require('./files')




express()
    // Middleware
    .set('view engine', 'hjs')
    .use(bodyParser.urlencoded({extended: false}))
    .use(bodyParser.json())
    .use(methodOverride('_method'))

    // routes
    .get('/', (req, res) => {
        res.render('index')
    })
    .post('/uplaod', upload.single('file'), (req, res) => {
        let nome = req.body.name
        let tags = req.body.tags.split(',')
        let file = req.file
        /* res.redirect('/') */
        let newFile = {
            nome,
            filename: file.filename,
            userId: '1',
            tags
        }
        filesModel.create(newFile, (err) => {
            if (err) console.log(err)
            res.redirect('/')
        })
        
    })

    // search
    .post('/search', (req, res) => {
        let searchName = req.body.name
        let searchTags = req.body.tags.split(',')

        filesModel.find({}, (err, files) => {
            let toShow = []
            let added = false
            for (let i = 0; i < files.length; i++) {
                if (files[i].nome.indexOf(searchName) >= 0 && searchName.length > 0) {
                    added = true
                }
                if (searchTags.length > 1) {
                    for (let j = 0; j < searchTags.length; j++) {
                        for (let k = 0; k < files[i].tags.length; k++) {
                            if (files[i].tags[k].indexOf(searchTags[j]) >= 0) {
                                added = true
                            }
                        }
                    }
                }
                if (added && (files[i].filename.indexOf('.jpg') >= 0 || files[i].filename.indexOf('.png') >= 0 || files[i].filename.indexOf('.gif') >= 0)) {
                    files[i].down = `/image/${files[i].filename}`
                } else {
                    files[i].down = `/download/${files[i].filename}`
                }
                if (added) {
                    toShow.push(files[i])
                }
                added = false
            }
            if (toShow.length > 0) {
                res.render('results', {
                    files: toShow
                })
            } else {
                res.render('sadCat')
            }
        })
    })

    // api
    .get('/files', (req, res) => {
        gfs.files.find().toArray((err, files) => {
            if (!files || files.length === 0) {
                return res.send('no files found')
            }
            return res.json(files)
        })
    })
    .get('/files/:filename', (req, res) => {
        gfs.files.findOne({filename: req.params.filename}, (err, files) => {
            if (!files) {
                return res.send('no files found')
            }
            return res.send(files)
        })
    })
    .get('/image/:filename', (req, res) => {
        gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
            if (!file) {
                return res.status(404).json({
                    err: 'no files found'
                })
            }

            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/gif') {
                const readstream = gfs.createReadStream(file.filename)
                readstream.pipe(res)
            } else {
                res.status(404).json({
                    err: 'not an image'
                })
            }
        })
    })
    .get('/download/:filename', (req, res) => {
        gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
            // Check if file
            if (!file || file.length === 0) {
                return res.status(404).json({
                    err: 'No file exists'
                })
            }
            // File exists
            res.set('Content-Type', file.contentType);
            res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"')
            // streaming from gridfs
            var readstream = gfs.createReadStream({
                filename: req.params.filename
            })
            //error handling, e.g. file does not exist
            readstream.on('error', function (err) {
                console.log('An error occurred!', err)
                throw err
            })
            readstream.pipe(res)
        })
    })

    .listen(port || 3000)