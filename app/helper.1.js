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
var CDB = require('felix-couchdb')
var dbname = "user_details"
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

		if(user && user.isEnrolled()) {
			logger.info('User %s was found to be registered and enrolled', username);
			//if (isJson && isJson === true) {
				var response = {
					success: true,
					message: username + ' already enrolled',
				};
				return response;
			//}
		} else {
			//throw new Error('User was not enrolled ');
			return 'User '+username+' was not enrolled.. '
			
		}	
	}
}

function sendMailVerification(emailId, password) {
	try{
		//var emailId = req.body.emailId;
		var password = "Suvitp@5588";
		
		logger.debug('End point : /sendMailVerification');
		logger.debug('User email : ' + emailId);
		let randNumber = Math.floor(Math.random() * 100000) + 1;

		let dbConn = dbConnection()
			dbConn.getDoc(emailId, function(err,doc) {
				doc.name.pin = randNumber;
				dbConn.saveDoc(emailId, doc);
				if(err){
					logger.error(JSON.stringify(err))
					var response = {
						success: false,
						message: username +" : "+ err,
					};
					return response
				}
			//});
		//}
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
	var clientDB = CDB.createClient(port, host)

	//var user = {name: username, status: status}
	var db = clientDB.db(dbname)

	db.exists(function(err, exists) {
		if (!exists) {
		  db.create();
		  console.log('Database ' + dbname + ' created.');
		} else {
		  console.log('Database ' + dbname + ' exists.');
		}
	  });
	return db
	
}

var saveUserStatus = async function (username, status, password) {
	 let dbConn = dbConnection()
	// 	if (exists) {
		  //db.create();
		  var user = {
			name: {
			  email: username,
			  status: status,
			  password: password,
			  pin: ""
			}
		  }
		
		dbConn.getDoc(username, function(err,doc) {
			if (!doc) {
				dbConn.saveDoc(username, user, function(err){
					if(err){
						logger.error(JSON.stringify(err))
						var response = {
							success: false,
							message: username +" : "+ err,
						};
						return response
					}else {
						logger.info("save document..")
						var response = {
							success: true,
							message: username + ' : Document saved..',
						};
						return response
					}
				})
			}
		});
		//}
	//})	
}

var getDocument = async function(username, dbcon) {
	return dbcon.getDoc(username)
}

var verifyPin = async function(username, pin) {
	var dbcon = await dbConnection()
	var docs = await getDocument(username, dbcon)

			
		
	
	
	logger.info("Outside get doc.."+docs)
}

// var verifyPin = async function(username, pin) {
// 	var flag = false
// 	dbConnection(function(e,dc) {
		
// 		if(dc){
	
// 			dc.getDoc(username, function(err,doc) {
// 		doc.name.status = "Active";
// 		logger.info("doc.name.pin"+doc.name.pin)
// 		logger.info("pin........."+pin)
// 		if (doc.name.pin == pin) {
// 			dc.saveDoc(username, doc, function(err){
// 				if(err){
// 					logger.error(JSON.stringify(err))
// 					var response = {
// 						success: false,
// 						message: username +" : "+ err,
// 					};
// 					//return response
// 					flag = false
// 				}else {
// 					logger.info("Pin Matched")
// 					var response = {
// 						success: true,
// 						message: username + ' : Pin match..',
// 					};
// 					flag = true
// 					//return response
// 				}
// 			})
// 		}
// 	});
// }
// 	});
// //	var response = {}
	
// 	logger.info("Flag...."+flag)

// }

exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getRegisteredUser = getRegisteredUser;
exports.checkRegisteredUser = checkRegisteredUser
exports.sendMailVerification = sendMailVerification
exports.saveUserStatus = saveUserStatus
exports.verifyPin = verifyPin
exports.getDocument = getDocument