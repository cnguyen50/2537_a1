require('dotenv').config();

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;

console.log('Connecting to MongoDB host:', mongodb_host);

const MongoClient = require("mongodb").MongoClient;
const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}`
                + `@${mongodb_host}/${mongodb_database}`
                + `?retryWrites=true&w=majority&ssl=true`;

var client = new MongoClient(atlasURI, {
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames:    true
});

client.connect()
    .then(() => console.log(`MongoDB connected to "${mongodb_database}"`))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });


const database = client.db(mongodb_database);
module.exports = {database};