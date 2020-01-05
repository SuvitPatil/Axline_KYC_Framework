/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');

var path = require('path');
var util = require('util');

var nodemailer = require('nodemailer');

var hfc = require('fabric-client');
//var CDB = require('felix-couchdb')
var dbname = "user_details"
//const nano = require('nano')('http://localhost:5984');

hfc.setLogger(logger);

async function getClientForOrg (userorg, username) {
	logger.debug('getClientForOrg - ****** START %s %s', userorg, username)
	// get a fabric client loaded with a connection profile for this org
	let config = '-connection-profile-path';

	// build a client context and load it with a connection profile
	// lets only load the network settings and save the client for later
	let client = hfc.loadFromConfig(hfc.getConfigSetting('network'+config));

	// This will load a connection profile over the top of the current one one
	// since the first one did not have a client section and the following one does
	// nothing will actually be replaced.
	// This will also set an admin identity because the organization defined in the
	// client section has one defined
	client.loadFromConfig(hfc.getConfigSetting(userorg+config));

	// this will create both the state store and the crypto store based
	// on the settings in the client section of the connection profile
	await client.initCredentialStores();

	// The getUserContext call tries to get the user from persistence.
	// If the user has been saved to persistence then that means the user has
	// been registered and enrolled. If the user is found in persistence
	// the call will then assign the user to the client object.
	if(username) {
		let user = await client.getUserContext(username, true);
		if(!user) {
			throw new Error(util.format('User was not found :', username));
		} else {
			logger.debug('User %s was found to be registered and enrolled', username);
		}
	}
	logger.debug('getClientForOrg - ****** END %s %s \n\n', userorg, username)

	return client;
}

var getRegisteredUser = async function(username, userOrg, isJson, password, status) {
	try {
		var client = await getClientForOrg(userOrg);
		logger.debug('Successfully initialized the credential stores');
		//at first set user status InActive
		
				
				//logger.info("userStatus...."+doc)
					// client can now act as an agent for organization Org1
					// first check to see if the user is already enrolled
				var user = await client.getUserContext(username, true);
				if (user && user.isEnrolled()) {
					logger.info('Successfully loaded member from persistence');
					//await saveUserStatus(username, status, "secret")
				} else {
					// user was not enrolled, so we will need an admin user object to register
					logger.info('User %s was not enrolled, so we will need an admin user object to register', username);
					var admins = hfc.getConfigSetting('admins');
					let adminUserObj = await client.setUserContext({username: admins[0].username, password: admins[0].secret});
					if(adminUserObj.getAffiliation() != userOrg.toLowerCase()){
						logger.info('Admin affiliation not registered. Registering now.');
						adminUserObj.setAffiliation(userOrg.toLowerCase());
						adminUserObj.setRoles(['peer','orderer','client','user']);
						adminUserObj = await client.setUserContext(adminUserObj);
					}
					logger.info('Admin User: %s', adminUserObj);

					// Register and enroll the user
					let caClient = client.getCertificateAuthority();
					let affiliation = userOrg.toLowerCase() + '.department1';
					// Check if organization exists
					const affiliationService = caClient.newAffiliationService();
					const registeredAffiliations = await affiliationService.getAll(adminUserObj);
					if(!registeredAffiliations.result.affiliations.some(x => x.name == userOrg.toLowerCase())){
						logger.info('Register the new affiliation: %s ', affiliation);
						await affiliationService.create({name: affiliation, force: true}, adminUserObj);
					}

					let secret = await caClient.register({
						enrollmentID: username,
						enrollmentSecret: password,
						affiliation: affiliation
					}, adminUserObj);
					logger.debug('Successfully got the secret for user %s - %s',username, secret);

					user = await client.setUserContext({username:username, password:secret});
					user.setAffiliation(affiliation);
					user.setRoles(['client']);
					user._enrollmentSecret = secret.toString();
					user = await client.setUserContext(user);
					// let userStatus1 = await saveUserStatus(username, status, secret, function(err, doc){
					// 	if(err){
					// 		logger.error(JSON.stringify(err))
					// 		var response = {
					// 			success: false,
					// 			message: username +" : "+ err,
					// 		};
					// 		return response
					// 	}
					// })						
					await saveUserStatus(username, status, secret)
					logger.info('Successfully save user and enrolled username and setUserContext on the client object: %s', user);
				}
				if(user && user.isEnrolled) {					
					if (isJson && isJson === true) {
						var response = {
							success: true,
							secret: user._enrollmentSecret,
							message: username + ' enrolled Successfully',
						};
						return response;
					}
				} else {
					throw new Error('User was not enrolled ');
				}
			
	}catch(error) {
		logger.error('Failed to get registered user: %s with error: %s', username, error.toString());
		return 'failed '+error.toString();
	}

};


var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting('CC_SRC_PATH'));
};

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('DEBUG');
	return logger;
};

var checkRegisteredUser = async function (userorg, username, password) {
	logger.debug('getClientForOrg - ****** START %s %s', userorg, username)
	// get a fabric client loaded with a connection profile for this org
	let config = '-connection-profile-path';

	let client = hfc.loadFromConfig(hfc.getConfigSetting('network'+config));

	client.loadFromConfig(hfc.getConfigSetting(userorg+config));

	// this will create both the state store and the crypto store based
	// on the settings in the client section of the connection profile
	await client.initCredentialStores();

	if(username) {
		let user = await client.getUserContext(username, true);
		const dbcon = await dbConnection()
		var doc = await dbcon.get(username)

		if(user && user.isEnrolled() && doc.name.password == password) {
			logger.info('User %s was found to be registered and enrolled', username);
			//if (isJson && isJson === true) {
				var response = {
					success: true,
					message: username + ' login Successfull',
				};
				return response;
			//}
		} else {
			//throw new Error('User was not enrolled ');
			return 'User '+username+' was not enrolled.. '
			
		}	
	}
}
var update = async function(obj, key, callback) {
	const db = await dbConnection()
	//var db = this;

	db.get(key, function (error, existing) { 
		if(!error) obj._rev = existing._rev;
		db.insert(obj, key, callback);
	});
	
	
}
var sendMailVerification = async function(emailId, password, status) {
	try{
		//var emailId = req.body.emailId;
		var password = "Suvitp@5588";
		
		logger.debug('End point : /sendMailVerification');
		logger.debug('User email : ' + emailId);
		let randNumber = Math.floor(Math.random() * 1000000) + 1;

		//let dbConn = await dbConnection()
		var user = {
			name: {
				email: emailId,
				status: status,
				password: password,
				pin: randNumber
			}
		}
		let getDoc = await update(user, emailId, function(err, res){
			if (err) return console.log('No update!');
			console.log('Updated!');
		})
		
		var transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
			user: 'suvitpatil5588@gmail.com',
			pass: password
			}
		});
		
		var mailOptions = {
			from: 'suvitpatil5588@gmail.com',
			//to: 'gunjpatil@gmail.com',
			to: emailId,
			subject: 'Set Your Pin',
			html: '<h1>Welcome</h1><p>'+randNumber+'</p>'
		};

		transporter.sendMail(mailOptions, function(error, info){
			if (error) {
			console.log(error);
			return(error);
			} else {
			console.log('Email sent: ' + info.response);
			return(info.response);
			}
		});
	}catch(error) {
		logger.error('Failed to send mail: %s with error: %s', username, error.toString());
		return 'failed '+error.toString();
	}
}

var dbConnection = async function() {
	
	let host = hfc.getConfigSetting('couchDBHost')
	let port = hfc.getConfigSetting('couchDBPort')
	let baseUrl = "http://"+host+":"+port
	logger.info("In dbconnection funct: "+baseUrl)
	//var clientDB = CDB.createClient(port, host)

	//const nano = require('nano')('http://localhost:5984');
	const nano = require('nano')(baseUrl);
	var flag = false
	await nano.db.list().then((body) => {
		// body is an array
		body.forEach(function(db) {
		  if(db == dbname){			
			flag = true
			logger.info("in loop"+flag)
		  }
		  })
	  });
	  if(await !flag){
		nano.db.create(dbname)
	  }
	const dbcon = nano.use(dbname)
	return dbcon
	
}

var saveUserStatus = async function (username, status, password) {
	logger.info("In save user.....")
	var user = {
		name: {
			email: username,
			status: status,
			password: password,
			pin: ""
		}
	}
	
	const dbcon = await dbConnection()
	logger.info("dbconn "+dbname+" "+username)
	let getDoc = await dbcon.get(username, function(err, doc){
		if(err){
			dbcon.insert(user, username)
		}
	})
	
	
} 

var verifyPin = async function(username, pin, password) {
	global.flag = false
		
	const dbcon = await dbConnection()
	var doc = await dbcon.get(username)//, function(err, doc){
		if(doc.name.pin == pin){
			var user = {
				name: {
					email: username,
					status: "Active",
					password: password,
					pin: pin
				}
			}
			global.flag = true
			await update(user, username)//), function(err, res){
		}
	// 			if (res1) {
	// 				logger.info("Pin Matched")
	// 				// var response = {
	// 				// 	success: true,
	// 				// 	message: username + ' : Pin match..',
	// 				// };
	// 				global.flag = true
	// 				logger.info("In helper response: ")//+response.message)
	// 				//return response
	// 			}else {
	// 				logger.error(JSON.stringify(err))
	// 				var response = {
	// 					success: false,
	// 					message: username +" : "+ err,
	// 				};
	// 				return response
	// 			}
	// 			//logger.info("updat helper"+flag)
	// 		})
	// 		//logger.info("if helper"+flag)
	// 	}
	// 	//logger.info("get helper"+flag)
	// })
	//if(await flag) {
	//	logger.info("flag---"+await flag)
		return await flag
	//} else {
	//	return "Pin not match.."
	//}
}

exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getRegisteredUser = getRegisteredUser;
exports.checkRegisteredUser = checkRegisteredUser
exports.sendMailVerification = sendMailVerification
exports.saveUserStatus = saveUserStatus
exports.verifyPin = verifyPin
