//connect to database, Schema & model
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const uniqueValidator = require('mongoose-unique-validator'); //allow enforcing unique constraints
const bcrypt = require('bcrypt');

const organizationSchema = new mongoose.Schema({
	name: {type: String},
	url: {type: String},
	email: {type: String}
});

//coach/user schema for Passport authentication
const userSchema = new mongoose.Schema({
	username: {type: String, required: true, index: {unique: true, dropDups: true}}, //email is username
	passwordHash: {type: String, required: true},
	first: {type: String, required: true},
	last: {type: String, required: true},
	name: {type: String},
	phone: {type: String, required: true}, 
	admin: {type: Boolean, "default": false}, 
	organization: {type: String, ref: 'Organization'}
});

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
	name: {type: String},
	phone: {type: String},
	dateAssigned: {type: Date},
	organization: {type: String, ref: 'Organization'}
});

//individual session schema 
const subSessionSchema = new mongoose.Schema({
	sessionsID: {type: mongoose.Schema.Types.ObjectId, ref: 'Sessions'},
	sessionNum: {type: Number},
	sessionDate: {type: Date},
	canceled: {type: Boolean, "default": false},
	cancelDate: {type: Date},
	advance: {type: Boolean, "default": false},
	logged: {type: Boolean, "default": false},
	last: {type: Boolean, "default": false},
	notes: {type: String}
});

//sessions schema for each coach/user
const sessionsSchema = new mongoose.Schema({
	sessionsID: {type: mongoose.Schema.Types.ObjectId},
	coach: {type: String, ref: 'User'},
	coachee: {type: String, ref: 'Coachee'},
	totalNum: {type: Number},
	status: {type: Boolean},
	subSessions: {type: Array, "default": []}
});

mongoose.model('User', userSchema);
mongoose.model('Coachee', coacheeSchema);
mongoose.model('Sessions', sessionsSchema);
mongoose.model('subSession', subSessionSchema);
mongoose.model('Organization', organizationSchema);

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