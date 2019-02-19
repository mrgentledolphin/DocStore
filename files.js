const mongoose = require('mongoose')
let Schema = mongoose.Schema
let filesSchema = new Schema({
    nome: String,
    filename: String,
    tags: Array,
    userId: String
}, {
    collection: 'files'
})
module.exports = mongoose.model('files', filesSchema)