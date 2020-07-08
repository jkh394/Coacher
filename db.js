//connect to database, Schema & model
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const uniqueValidator = require('mongoose-unique-validator'); //allow enforcing unique constraints
const bcrypt = require('bcrypt');

//coach/user schema for Passport authentication
const userSchema = new mongoose.Schema({
	_id: mongoose.Schema.Types.ObjectId,
	username: {type: String, required: true, unique: true}, //email is username
	passwordHash: {type: String, required: true},
	first: {type: String},
	last: {type: String},
	phone: {type: String}
});

//static method to compare password from user w/ hash password
//userSchema.statics.passwordMatches = function(password, hash) {
//	return bcrypt.compareSync(password, hash);
//}
//middleware to hash password
//userSchema.pre('save', function(next) {
//	const unsafePassword = this.password;
//	this.password = bcrypt.hashSync(unsafePassword);
//	next();
//});
//userSchema.plugin(passportLocalMongoose);
userSchema.plugin(uniqueValidator);
userSchema.methods.validPassword = function(password) {
	return bcrypt.compareSync(password, this.passwordHash);
};
userSchema.virtual("password").set(function(value) {
	this.passwordHash = bcrypt.hashSync(value, 12);
});

//coachee schema 
const coacheeSchema = new mongoose.Schema({
	email: {type: String, index: {unique: true, dropDups: true}, required: true},
	first: {type: String},
	last: {type: String},
	phone: {type: String},
	coach: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	dateAssigned: {type: Date}
});

//session schema for each coach/user
const sessionSchema = new mongoose.Schema({
	coach: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	coachee: {type: String, ref: 'Coachee'},
	date: {type: Date},
	sessionNum: {type: Number},
	sessionDate: {type: Date},
	tookPlace: {type: Boolean},
	canceled: {type: Boolean},
	cancelDate: {type: Date},
	notes: {type: String}
	//User: {type: mongoose.Schema.Types.ObjectId, ref: 'User'} <- do i need this??
});

mongoose.model('User', userSchema);
mongoose.model('Coachee', coacheeSchema);
mongoose.model('Session', sessionSchema);

// is the environment variable, NODE_ENV, set to PRODUCTION? 
let dbconf;
if (process.env.NODE_ENV === 'PRODUCTION') {
 // if we're in PRODUCTION mode, then read the configuration from a file
 // use blocking file io to do this...
 const fs = require('fs');
 const path = require('path');
 const fn = path.join(__dirname, 'config.json');
 const data = fs.readFileSync(fn);

 // our configuration file will be in json, so parse it and set the
 // connection string appropriately!
 const conf = JSON.parse(data);
 dbconf = conf.dbconf;
} else {
 // if we're not in PRODUCTION mode, then use
 dbconf = 'mongodb://localhost/coacher';
}

//'mongodb://ayyy:lmao@localhost/coacher'

//connect to database
mongoose.connect(dbconf, {useUnifiedTopology:true, useNewUrlParser:true})
	.then((resolved) => console.log('The database has been successfully connected! :D'))
	.catch((err) => console.log(err));