//Import necessary modules and variables

//.env contains files that the botframework uses to validate the bot
//These are defined on the botframework website
require('dotenv-extended').load();
//DatabaseTools is a file to manage the JSON database the bot uses to store users and reports
var db = require('./databaseTools');
//Botbuilder and restify are node.js modules necessary for the bot and use of skype features
var builder = require('botbuilder');
var restify = require('restify');
//This is used to schedule when to run statusUpdates and get reports
var schedule = require('node-schedule');
//This is used to date reports
var datetime = require('node-datetime');


//List of commands - used to check if the user has inputted a command
//New commands must be added to this list or they will not run
var commands = ["!teamStatus", "!help", "!updateStatus", "!teamReset", "!assignTeams", "!forceStatusUpdate", "!submitReport", "!forceSubmitReport", "!userReport"]


//Setting up the skype bot
// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot and listen to messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());

//set up bot
var bot = new builder.UniversalBot(connector);





//Building cards and carousels - this is the primary way of displaying information
//Card used in !teamStatus function - allows report to be displayed to user upon pressing button
function userCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.buttons([
			builder.CardAction.dialogAction(session, 'userReport', skypeID, 'See Report')
        ]);
	return card;
}

//Card used to add users without a team to a predefined team
function userTeamAssignCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.buttons([
			//This button should be replaced. dialogAction should be used instead
			//See the userCard card above for an example
            builder.CardAction.dialogAction(session, 'changeTeam', skypeID, 'Add ' + name + " to team")
        ]);
	return card;
}


//Producing carousels from a list of objects 
//Due to limits w/ carousels, only two cards are displayed on each carousel and multiple carousels are outputted
//The code that produces the multiple carousels is currently contained in dialogs
function teamStatus(session, connector, teamArray) {
	var msg = new builder.Message(session)
		.attachmentLayout(builder.AttachmentLayout.carousel);
	for (a = 0; a < teamArray.length; a++) {
		msg.addAttachment(userCard(session, connector, teamArray[a].name, teamArray[a].workingStatus, teamArray[a].skypeID));
	}
	return msg;
}

function teamAssign(session, connector, teamArray) {
	var msg = new builder.Message(session)
		.attachmentLayout(builder.AttachmentLayout.carousel);
	for (i = 0; i < teamArray.length; i++) {
		msg.addAttachment(userTeamAssignCard(session, connector, teamArray[i].name, teamArray[i].workingStatus, teamArray[i].skypeID));
	}
	return msg;
}




//Creating 'classes' to handle the user and report objects
//SkypeID is used as the main identifier for the users - reports have no unique ID. 
//If multiple reports are submitted on a day, only one will be accessable to user
// Create employee 'class' 
function employee(skypeID, address, name, team) {
	this.skypeID = skypeID;
	this.address = address;
	this.name = name;
	this.team = team;
	this.workingStatus = 'unknown';
}

// Create report 'class'
function report(skypeID, team, yesterdayText, todayText, issueText) {
	this.skypeID = skypeID;
	this.name = db.findValue(skypeID, "name");
	var dt = datetime.create();
	this.date = dt.format('d/m/Y');
	this.team = team;
	this.yesterdayText = yesterdayText;
	this.todayText = todayText;
	this.issueText = issueText;
}


//Bot dialogs - all commands use a dialog

//Add a user upon their first time messaging the bot - run if root dialog doesn't recognise their skypeID
bot.dialog('/addFirstTimeUser', [
	function (session) {
		var newUserName;
		var newUserTeam;
		builder.Prompts.text(session, 'Input your name:');
	},
	function (session, results) {
		newUserName = results.response;
		builder.Prompts.text(session, 'Input your team:');
	},
	function (session, results) {
		newUserTeam = results.response;
		var newEmployee = new employee(session.message.address.user.id, session.message.address, newUserName, newUserTeam);
		db.saveEmployee(newEmployee);
		session.endDialog("New user created");
	}
]);
 
//This is a greeting function, only used so the user is not repeatedly greeted upon talking to the bot
bot.dialog('/introduce', function (session) {
	session.send("Hello user. This is the scrum master bot. For list of commands, input \"!help\"");
	session.endDialog();
});

//Wipes the team values - if new teams need to be assigned this can be run, followed by !assignTeams
bot.dialog('/teamReset', [
	function (session) {
		var response;
		builder.Prompts.text(session, "ARE YOU SURE? THE TEAMS CANNOT BE RECOVERED (Y/N)");
	},
	function (session, results) {
		response = results.response;
		response = response.toLowerCase();
		if (response == "y" || response == "yes") {
			db.wipeTeams();
			session.endDialog("Teams have been reset");
		}
		else {
			session.endDialog("No changes made");
		}
	}
]);

//Requests update on the status of the user it sends this dialog to
bot.dialog('/updateUserStatus', [
	function (session) { 
		var msg = new builder.Message(session)
			.text("Good Morning User. Please input your working status today (In, Working from home or on Holiday)")
			.suggestedActions(
				//Suggested actions does not actually work yet - this is displayed as a normal message
				builder.SuggestedActions.create(
						session, [
							builder.CardAction.postBack(session, "In", "In"),
							builder.CardAction.postBack(session, "Home", "Home"),
							builder.CardAction.postBack(session, "Holiday", "Holiday")
						]
					));
		builder.Prompts.text(session, msg);
	},
	function (session, results) {
		var skypeID = session.message.address.user.id;
		var newStatus = results.response;
		db.updateStatus(skypeID, newStatus);
		session.endDialog("Status updated");
	}
]);

//Used for assigning teams
var newTeam;
bot.dialog('/assignTeams', [
	function (session) {
		var teamArray;
		var number; 
		var carouselsNeeded;
		builder.Prompts.text(session, "Input the name of the team to add members to");
	},
	function (session, results) {
		newTeam = results.response;
		teamArray = db.findAll("team", "null");
		number = teamArray.length / 2;
		carouselsNeeded = Math.ceil(number)
		console.log(carouselsNeeded);
		for (b = 0; b < carouselsNeeded; b++) {
			var teamSample = new Array;
			console.log("i: " + b)
			for (k = 0; k < 2; k++) {
				var num = (b * 2) + k;
				console.log("num" + num);
				if (num >= teamArray.length) { break; }
				teamSample.push(teamArray[num]);
			}
			var carousel = teamAssign(session, connector, teamSample);
		session.send(carousel);
		}
	session.endDialog();
	}
]);
bot.dialog('/changeTeam', [
	function (session, args) {
		db.updateTeam(args.data, newTeam);
		session.endDialog();
	}
]);
bot.beginDialogAction('changeTeam', '/changeTeam');

//Resets all statuses and requests statusUpdates from all users
//Allows users to effectively run scheduler again on command
bot.dialog('/forceStatusUpdate', function (session) {
	db.wipeStatuses();
	var users = db.findAll("workingStatus", "unknown");
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/updateUserStatus');
	}
});

//Takes inputs from user and saves them as a new report
bot.dialog('/submitReport', [
	function (session) {
		var yesterdayInput;
		var todayInput;
		var issueInput;
		builder.Prompts.text(session, "Input what you did yesterday");
	},
	function (session, results) {
		yesterdayInput = results.response;
		builder.Prompts.text(session, "Input what you plan to do today");
	},
	function (session, results) {
		todayInput = results.response;
		builder.Prompts.text(session, "Input any issues you had (or \"no issues\")");
	},
	function (session, results) {
		issueInput = results.response;
		var skypeID = session.message.address.user.id;
		var team = db.findValue(skypeID, "team");
		var newReport = new report(skypeID, team, yesterdayInput, todayInput, issueInput);
		db.saveReport(newReport);
		session.endDialog("Report saved");
	}
]);

//Requests all users submit another report - similar to !forceStatusUpdate
bot.dialog('/forceSubmitReport', function (session) {
	var team = db.findValue(session.message.address.user.id, "team");
	var users = db.findAll("team", team);
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/submitReport');
	}
});

//Carousel for displaying team status
bot.dialog('/teamStatus', function (session) {
	var searchTeam = db.findValue(session.message.address.user.id, "team");
	var teamArray = db.findAll("team", searchTeam);
	//This section handles the outputting of multiple carousels to avoid skype's constraints
	var number = teamArray.length / 2;
	var carouselsNeeded = Math.ceil(number);
	for (i = 0; i < carouselsNeeded; i++) {
		var teamSample = new Array;
		for (j = 0; j < 2; j++) {
			var num = (i * 2) + j;
			if (num >= teamArray.length) { break; }
			teamSample.push(teamArray[num]);
		}
		var carousel = teamStatus(session, connector, teamSample);
		session.send(carousel);
	}
	session.endDialog();
});

//Outputs the report the user submitted that day
bot.dialog('/userReport', [ 
	function (session, args) {
		var date = datetime.create();
		date = date.format('d/m/Y');
		var report = db.findRecentUserReport(args.data, date);
		session.send("Yesterday: " + report.yesterdayText);
		session.send("Today: " + report.todayText);
		session.send("Issues: " + report.issueText);
		session.endDialog();
	}
]);
//Begins the userReport dialog if the button on the userCard is pressed
bot.beginDialogAction('userReport', '/userReport');





//Schedulers to get daily status updates and reports from everyone in the DB
var statusUpdateRule = new schedule.RecurrenceRule();
statusUpdateRule.minute = 30;
statusUpdateRule.hour = 9;

var statusUpdateJob = schedule.scheduleJob(statusUpdateRule, function(session) {
	//Resets all workingStatuses to "unknown", then runs a search to return everyone
	db.wipeStatuses();
	var users = db.findAll("workingStatus", "unknown");
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/updateUserStatus');
	}
});


var reportUpdateRule = new schedule.RecurrenceRule();
reportUpdateRule.minute = 57;
reportUpdateRule.hour = 15;

var reportUpdateJob = schedule.scheduleJob(reportUpdateRule, function(session) {
	//All users are using the skype channel, so this returns all users
	var users = db.findAll("address/channelId", "skype");
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/submitReport');
	}
});





//This is the root dialog - the default dialog the skype bot runs, and will return to once other dialogs have finished
bot.dialog('/', function (session) {
	//Check if the user is already stored in the DB, if not, run "addFirstTimeUser" and create a new entry for them
	var savedAddress;
	savedAddress = session.message.address;
	var notFirstTime = db.findUser(session.message.address.user.id);
	if (notFirstTime != true) {
		bot.beginDialog(savedAddress, '/addFirstTimeUser');
	//If they already exist, check if their input is a command. Run the introduction if it's not
	} else if (!commands.includes(session.message.text)) {
		savedAddress = db.findValue(session.message.address.user.id, "address");
		bot.beginDialog(savedAddress, '/introduce');
	} 
	//If the user inputs something present in the commands array, determine what they inputted
	//then run the appropriate dialog
	else switch(session.message.text) {
		case "!teamStatus":
			bot.beginDialog(savedAddress, "/teamStatus");
			break;
		case "!help":
			session.send(commands.toString().replace(/,/g , " "));
			break;
		case "!updateStatus":
			bot.beginDialog(savedAddress, '/updateUserStatus');
			break;
		case "!teamReset":
			bot.beginDialog(savedAddress, "/teamReset");
			break;
		case "!assignTeams":
			bot.beginDialog(savedAddress, "/assignTeams");
			break;
		case "!forceStatusUpdate": 
			bot.beginDialog(savedAddress, "/forceStatusUpdate");
			break;
		case "!submitReport":
			bot.beginDialog(savedAddress, "/submitReport");
			break;
		case "!forceSubmitReport":
			bot.beginDialog(savedAddress, "/forceSubmitReport");
			break;
	}
});

