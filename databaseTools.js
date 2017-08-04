//set up Json database
var JsonDB = require('node-json-db');
var db = new JsonDB("botDB", true, false);



module.exports = {
	saveEmployee: function (employeeToSave) {
		db.push("/users[]", employeeToSave, true);
	},
	//Make sure to install some kind of error reporting in this, in the event of bad info being inputted
	findValue: function (skypeID, variableName) {
		var data;
		var users = db.getData("/users");
		for (i = 0; i < users.length; i++) {
			if (db.getData("/users[" + i + "]/skypeID") == skypeID) {
				data = db.getData("/users[" + i + "]/" + variableName);
			}
		}
		return data;
	},
	//Finds all entries corresponding to a particular variable
	//Same as above - this function must be PERFECT - a lot of features will depend on it
	findAll: function (variableName, variableValue) {
		var successes = new Array;
		var users = db.getData("/users");
		for (i = 0; i < users.length; i++) {
			if (db.getData("/users[" + i + "]/" + variableName) == variableValue) {
				successes.push(db.getData("/users[" + i + "]"));
			}
		}
		return successes;
	},
	//This should probably be made more general purpose, but leave as is until statuses are working and the scheduler is running
	updateStatus: function (skypeID, newStatus) {
		var users = db.getData("/users");
		for (i = 0; i < users.length; i++) {
			if (db.getData("/users[" + i + "]/skypeID") == skypeID) {
				db.push("/users[" + i + "]/workingStatus", newStatus); 
			}
		}
	},
	//Instead of having one function that i can modify, ill have like 5 just to confuse myself even more
	wipeTeams: function () {
		var users = db.getData("/users");
		for (i = 0; i < users.length; i++) {
			db.push("/users[" + i + "]/team", "null");
		}
	},
	wipeStatuses: function () {
		var users = db.getData("/users");
		for (i = 0; i < users.length; i++) {
			db.push("/users[" + i + "]/workingStatus", "unknown");
		}
	}
};