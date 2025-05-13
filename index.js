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

const navLinks = [
    {name: "Home", link: "/"},
    {name: "Members", link: "/members"},
    {name: "Login", link: "/login"},
    {name: "Admin", link: "/admin"},
    {name: "404", link: "/dne"},
    {name: "Logout", link: "/logout"},
]

app.use(express.urlencoded({extended: false}));
app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.locals.session = req.session;
    res.locals.navLinks = navLinks;
    res.locals.currentPath = req.path
    res.locals.title   = '';
    next();
});


function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    res.redirect('/');
}

function requireAdmin(req, res, next) {
    if (!req.session.authenticated) {
        return res.redirect('/login')
    }
    if (req.session.user_type !== 'admin') {
        return res
            .status(403)
            .render('404', { message: 'No access' })
    }
    next();
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
    res.render('signup',{
        session: req.session,
        title: 'Sign Up',
        error: null,
        username: '',
        email: ''
    });
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
        return res.render('signup', {
            error:   `${label} is required.`,
            username,
            email
        });
    }

    //Hash and store user 
    var hash = await bcrypt.hash(password, saltRounds);
	await userCollection.insertOne({username: username, email: email, password: hash, user_type: 'user' });
    console.log("New user has been created", username);

    //logs in and redirects
    req.session.authenticated = true;
    req.session.user_type= 'user';
    req.session.username = username;
    res.redirect('/members')
});

app.get('/login', (req, res) => {
    res.render('login', {
        session: req.session,
        title:'Log In',
        email:'',
        error:null
    });
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
        return res.render('login', {
            session: req.session,
            title:   'Log In',
            error:   'Please enter a valid email & password.',
            email
        });
    }

    // Lookup user by email
    const user = await userCollection.findOne({ email });

    // Compare password
    const match = user && await bcrypt.compare(password, user.password);

    if (!user || !match) {
        return res.render('login', {
            session: req.session,
            title:   'Log In',
            error:   'Invalid email/password combination.',
            email
        });
    }

    // On success create session and go to members
    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.user_type = user.user_type;
    res.redirect('/members');
});


app.get('/members', requireAuth, (req, res) => {
    const images = ['/donkey.gif', '/shrek.gif', '/pus.gif'];
    // const img = images[Math.floor(Math.random() * images.length)];
    const user = req.session.username;
    res.render('members', {
        session : req.session,
        title: 'Members',
        user: user,
        image: images
    })
});


app.get('/admin', requireAdmin, async (req, res) => {
    const users = await userCollection.find().toArray();
    res.render('admin', { users });
});

app.get('/admin/promote', requireAdmin, async (req, res) => {
    await userCollection.updateOne(
        { username: req.query.user },
        { $set: { user_type: 'admin' } }
    );
    res.redirect('/admin');
});

app.get('/admin/demote', requireAdmin, async (req, res) => {
    await userCollection.updateOne(
        { username: req.query.user },
        { $set: { user_type: 'user' } }
    );
    res.redirect('/admin');
});

    
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Catch all for 404
app.use((req, res) => {
    res.status(404);
    res.locals.title = 'Page Not Found';
    res.render('404')
});

app.listen(port, () => {
	console.log("Listening on port "+ port);
}); 