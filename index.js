require("./utils.js");
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 12;
const expireTime = 60 * 60 * 1000;

/* secret info */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

var { database } = require('./databaseConnection');
const userCollection = database.collection('users');

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority`,
	crypto: {
		secret: mongodb_session_secret
	}
})

app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');

function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    res.redirect('/');
}

app.use(session({ 
        secret: node_session_secret,
        store: mongoStore,
        saveUninitialized: false, 
        resave: true,
        cookie: {
            maxAge: expireTime
        }
    }
));

app.get('/', (req, res) => {
    res.render('index', {session: req.session})
});

app.get('/signup', (req, res) => {
    res.send(`
        <h1>Sign Up</h1>
        <form action="/signup" method="POST">
            <input name="username" type="text" placeholder="Name">
            <br/>
            <input name="email" type="email" placeholder="Email">
            <br/>
            <input name="password" type="password" required placeholder="Password">
            <br/>
            <button>Submit</button>
        </form>
    `);
});

app.post('/signup', async (req,res) => {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.object({
        username: Joi.string().min(1).alphanum().max(20).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(1).required()
	});
    
    // Validates 3 fields
	const validationResult = schema.validate({username, email, password});
	if (validationResult.error != null) {
        console.log(validationResult.error);
        const field = validationResult.error.details[0].context.key;
        const label = field.charAt(0).toUpperCase() + field.slice(1);
        return res.send(`
            <h1>${label} is required.</h1>
            <a href="/signup">Try again</a>
        `);
    }

    //Hash and store user 
    var hash = await bcrypt.hash(password, saltRounds);
	await userCollection.insertOne({username: username, email: email, password: hash});
    console.log("New user has been created", username);

    //logs in and redirects
    req.session.authenticated = true;
    req.session.username = username;
    res.redirect('/members')
});

app.get('/login', (req, res) => {
    res.send(`
        <h1>Log In</h1>
        <form action="/login" method="post">
            <input name="email" type="email" placeholder="Email">
            <br/>
            <input name="password" type="password" placeholder="Password">
            <br/>
            <button>Submit</button>
        </form>
    `);
});

app.post('/login', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required()
    })

    // Validate both fields
    const validationResult = schema.validate({ email, password });
    if (validationResult.error) {
        console.log(validationResult.error);
        return res.redirect('/login');
    }

    // Lookup user by email
    const user = await userCollection.findOne({ email });

    // Compare password
    const match = user && await bcrypt.compare(password, user.password);

    if (!user || !match) {
        return res.send(`
            <h1>Invalid email/password combination.</h1>
            <a href="/login">Try again</a>
        `);
    }

    // On success create session and go to members
    req.session.authenticated = true;
    req.session.username = user.username;
    res.redirect('/members');
});


app.get('/members', requireAuth, (req, res) => {
    const images = ['/donkey.gif', '/shrek.gif', '/pus.gif'];
    const img = images[Math.floor(Math.random() * images.length)];
    const user = req.session.username;
    res.send(`
        <h1>Hello, ${user}</h1>
        <img src="${img}">
        <form action="/logout"><button>Sign Out</button></form>
        `);
});
    
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Catch all for 404
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 – Page Not Found</h1>
        <p>Sorry, that page doesn’t exist.</p>
    `);
});

app.listen(port, () => {
	console.log("Listening on port "+ port);
}); 