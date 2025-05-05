require('dotenv').config();

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;

console.log('Connecting to MongoDB host:', mongodb_host);

const MongoClient = require("mongodb").MongoClient;

const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}`
                + `@${mongodb_host}/${mongodb_database}`
                + `?retryWrites=true&w=majority`;

var database = new MongoClient(atlasURI, {});

module.exports = {database};