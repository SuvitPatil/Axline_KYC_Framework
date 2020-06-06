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
const fs = require('fs');
const crypto = require('crypto');
var forge = require('node-forge');
//var imageHash = require('node-image-hash');
const md5File = require('md5-file')
var request = require("request");

var path = require('path');
var util = require('util');

const { promisify } = require('util')


var nodemailer = require('nodemailer');

var hfc = require('fabric-client');
//var CDB = require('felix-couchdb')
var dbname = "user_details"
//const nano = require('nano')('http://localhost:5984');
let host = hfc.getConfigSetting('couchDBHost')
let port = hfc.getConfigSetting('couchDBPort')
let baseUrl = "http://"+host+":"+port

var user = {
	name: {
		kycID: "",
		email: "",
		status: "",
		password: "",
		pin: "",
		passportDoc: "",
		licenseDoc: ""
	}
}

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
	try {
	logger.debug('getClientForOrg - ****** START %s %s', userorg, username)
	// get a fabric client loaded with a connection profile for this org
	let config = '-connection-profile-path';

	let client = hfc.loadFromConfig(hfc.getConfigSetting('network'+config));

	client.loadFromConfig(hfc.getConfigSetting(userorg+config));

	// this will create both the state store and the crypto store based
	// on the settings in the client section of the connection profile
	await client.initCredentialStores();
	global.kycId = ""
	if(username) {
		let users = await client.getUserContext(username, true);
		const dbcon = await dbConnection()
		var doc = await dbcon.get(username)

		if(users && users.isEnrolled() && doc.name.password == password) {
			logger.info('User %s was found to be registered and enrolled', username);
			
			//await dbcon.get(username, function(err, doc){
				if (doc.name.kycID == "") {
					kycId = Math.floor(Math.random() * 10000000) + 1;
					user.name.kycID = kycId
					user.name.email = doc.name.email
					user.name.status = doc.name.status
					user.name.password = doc.name.password
					user.name.pin = doc.name.pin
					console.log("updaating kycID----")
					let getDoc = update(user, username, function(err, res){
						if (err) return console.log('No update!');
						console.log('Updated kycID!');
					})
				} else {
					console.log("In else---")
					kycId = doc.name.kycID
				}
				
		   // })
			var response = {
				success: true,				
				message: username + ' login Successfull',
				kycID: kycId
			};
			return response;
		} else {
			//throw new Error('User was not enrolled ');
			return 'User / Password not found.. '
			
		}	
	}
}catch(error) {
	logger.error('Failed to get registered user: %s with error: %s', username, error.toString());
	return 'failed '+error.toString();
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
		var passwords = "Suvitp@5588";
		
		logger.debug('End point : /sendMailVerification');
		logger.debug('User email : ' + emailId);
		let randNumber = Math.floor(Math.random() * 1000000) + 1;

		//let dbConn = await dbConnection()
		user.name.email = emailId
		user.name.status = status
		user.name.password = password
		user.name.pin = randNumber
		
		let getDoc = await update(user, emailId, function(err, res){
			if (err) return console.log('No update!');
			console.log('Updated!');
		})
		
		var transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
			user: 'suvitpatil5588@gmail.com',
			pass: passwords
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
		logger.error('Failed to send mail: %s with error: %s', emailId, error.toString());
		return 'failed '+error.toString();
	}
}
// var dbConfig = async function() {
// 	let host = hfc.getConfigSetting('couchDBHost')
// 	let port = hfc.getConfigSetting('couchDBPort')
// 	let baseUrl = "http://"+host+":"+port
// 	logger.info("In dbconnection funct: "+baseUrl)
// 	//var clientDB = CDB.createClient(port, host)

// 	//const nano = require('nano')('http://localhost:5984');
// 	const nano = require('nano')(baseUrl);
// 	return nano
// }
var dbConnection = async function() {
	
	const nanoCon = require('nano')(baseUrl);
	var flag = false
	await nanoCon.db.list().then((body) => {
		// body is an array
		body.forEach(function(db) {
		  if(db == dbname){			
			flag = true
			logger.info("in loop"+flag)
		  }
		  })
	  });
	  if(await !flag){
		nanoCon.db.create(dbname)
	  }
	const dbcon = nanoCon.use(dbname)
	return dbcon
	
}

var saveUserStatus = async function (username, status, password) {
	logger.info("In save user.....")
	
	user.name.email = username
	user.name.status = status
	user.name.password = password
	

	const dbcon = await dbConnection()
	logger.info("dbconn "+dbname+" "+username)
	let getDoc = await dbcon.get(username, function(err, doc){
		if(err){
			dbcon.insert(user, username)
		}
	})
	
	
} 

var verifyPin = async function(username, pin, password) {
	try {
		//const dbcon = await dbConnection()
		var response = {
			success: "",
			message: ""
		};
		var options = { 
			method: 'GET',
			url: baseUrl+'/'+dbname+'/'+username,
			headers: 
			{ 
			'Cache-Control': 'no-cache' 
			} 
		};
	
		return new Promise(function (resolve, reject) {
			request(options, function (error, response1, body) {
					let doc = JSON.parse(body)
					console.log("doc---"+doc)
					if (typeof doc.name === 'undefined') {
						response.success = false
						response.message = "username not found.."
						resolve(response)
					} else if(doc.name.pin == pin) {			
						user.name.email = username
						user.name.status = "Active"
						user.name.password = password
						user.name.pin = pin

						//global.flag = true
						update(user, username, function(err, res){
							if(!err) {
								response.success = true
								response.message = "Pin matched successfully.."
								resolve(response)
							}
						})
					} else {
						response.success = false
						response.message = "Pin not matched.."
						resolve(response)
					}

				
				
			});
	
	
			
		})
	
	} catch(error) {
		logger.error('Failed to check pin for user: %s with error: %s', username, error.toString());
		response.success = false
		response.message = error.toString()
		return response
	}
}

var insertAttachmentAndGenHash = async function(doc, username, attachName, dbcon, attachType) {
	try{
		var response = {
			success: "",
			message: ""
		};
		
		let filename = './images/'+attachName
		var fileExtension = attachName.split(".").pop()
		
		global.flag = false
		var rev = doc._rev

		const readFileAsync = promisify(fs.readFile)
		const resp = await readFileAsync(filename)
		
		let resp1 = await dbcon.attachment.insert(username, attachName, resp, 'image/'+fileExtension,
			{ rev: rev }).then((body) => {
			console.log(body);			  
			global.flag = body.ok
			console.log("-------------"+flag)

		});
		//process.chdir('../')
		if (flag){
			var docWithAttachment = await dbcon.get(username)

			user.name.kycID = docWithAttachment.name.kycID
			user.name.email = docWithAttachment.name.email
			user.name.status = docWithAttachment.name.status
			user.name.password = docWithAttachment.name.password
			user.name.pin = docWithAttachment.name.pin
			user["_attachments"] = docWithAttachment["_attachments"]
			console.log("attach----"+attachType)
			if (attachType == "Passport") {
				user.name.passportDoc = attachName
			} else {
				user.name.passportDoc = docWithAttachment.name.passportDoc
			}
			if (attachType == "License") {
				user.name.licenseDoc = attachName
			} else {
				user.name.licenseDoc = docWithAttachment.name.licenseDoc
			}

			await update(user, username, function(err, res){
				if (err) return console.log('No update!');
				console.log('Updated Passport or license!');
			})
			let hashFile = await getAttachmentHashCouch(username, attachName)
			//hashFile = md5File.sync(filename)
		  	console.log("hash-------------------"+hashFile)
			response.success = flag
			response.message = hashFile
			return response
		} else {
			response.success = false
			response.message = "Failed to insert attachment in database.."
			return response
		}
				
	}catch(error) {
		logger.error('Failed to insert hash for user: %s with error: %s', username, error.toString());
		response.success = false
		response.message = error.toString()
		return response
	}	
}

var addAttachmentProcess = async function(username, attachName, attachType) {
	try {
		const dbcon = await dbConnection()
		let filename = './images/'+attachName
		//var createdHash = ""
		var doc = await dbcon.get(username)//, function(err, doc){
		
		let resp =  await insertAttachmentAndGenHash(doc, username, attachName, dbcon, attachType)//, function(err, data) {
				
		return resp
	
	}catch(error) {
		logger.error('Error in Add Attachment: %s', username, error.toString());
		return 'Error in Add Attachment: %s'+ username, error.toString()
	}
}

var getAllAttachment = async function(username) {
	try{
		
		
		console.log("base---"+baseUrl)

		var options = { 
			method: 'GET',
			url: baseUrl+'/'+dbname+'/'+username,
			headers: 
				{ 
				'Cache-Control': 'no-cache',
				Authorization: 'application/json' 
				} 
		};

		return new Promise(function (resolve, reject) {
			request(options, function (error, response1, body) {
			  if (!error) {
					console.log("Body ---"+body)
					let obj = JSON.parse(body)
					console.log("fiel name---"+obj["_attachments"]["abc.jpg"].content_type)
					var keysObj = Object.keys(obj["_attachments"])
					console.log("keysObj len -- "+keysObj)
					var attachObj = []
					for (var i = 0; i < keysObj.length; i++) {
						console.log(keysObj[i]);
						console.log("object--"+obj["_attachments"][keysObj[i]])
						var attachJson = obj["_attachments"][keysObj[i]]
						attachJson.uploadImage = keysObj[i]
						if (obj.name.licenseDoc == keysObj[i]) {
							attachJson.attachType = "License"
						}
						if (obj.name.passportDoc == keysObj[i]) {
							attachJson.attachType = "Passport"
						}
						attachObj.push(attachJson)
					}
					
					resolve(attachObj);
				
			  } else {
				reject(error);
			  }
			});
		  });
		
	}catch(error) {
		logger.error('Error in Add Attachment: %s', username, error.toString());
		return 'Error in Add Attachment: %s'+ username, error.toString()
	}
}
var getAttachmentProcess = async function(username, attachName) {
	try {
		console.log("In get attachment --"+username+" --- "+attachName)
		const dbcon = await dbConnection()
		var response = {
			success: "",
			message: ""
		};
		let filename = attachName
		
		return new Promise(function (resolve, reject) {
		dbcon.attachment.get(username, attachName, function(err,body) {
			if(!err){
			fs.writeFile('./downloadedImages/'+attachName, body)
				console.log("success")
				//global.flag = true
				//console.log("in flag"+flag)	
				// hashFile = md5File.sync('./downloadedImages/'+attachName)
				// console.log("in flag"+hashFile)
				response.success = true
				response.message = "Document downloaded successfully"
				resolve(response)
			}
			if(err){				
				console.log("Error -----")
				response.success = false
				response.message = "Error in getting attachment.."
				reject(response)
			}
		});
		})

	}catch(error) {
		logger.error('Error in get Attachment: %s', username, error.toString());
		response.success = false
		response.message = error.toString()
		return response
	}
}

var getAttachmentHashBlockchain = async function(requestBody) {
	try {
		console.log("In getAttachmentHashBlockchain-----")
		let channelName = requestBody.body.channelName
		let userName = requestBody.body.userName
		let attachName = requestBody.body.attachName
		let chainCodeName = requestBody.body.chainCodeName
		let peer = requestBody.body.peer
		let args = requestBody.body.args
		let token = requestBody.body.token
		let	attachDesc= requestBody.body.attachDesc
		
		//console.log("reqJson---"+requestBody)
		var options = { 
			method: 'GET',
			url: 'http://localhost:4000/channels/'+channelName+'/chaincodes/'+chainCodeName+'?peer='+peer+'&fcn=query&args=%5B%22'+args+'%22%5D',
			headers: 
			{ 
				'authorization': 'Bearer '+token ,
				'Cache-Control': 'no-cache' 
			} 
		};

		return new Promise(function (resolve, reject) {
			request(options, function (error, response1, body) {
			  if (!error) {
				if (attachDesc == "Passport") {
					let obj = JSON.parse(body)
					console.log("response3333333------body--"+obj.message.uploadPassport)
					resolve(obj.message.uploadPassport);
				} else {
					let obj = JSON.parse(body)
					console.log("response3333333------body--"+obj.message.uploadLicense)
					resolve(obj.message.uploadLicense);
				}
			  } else {
				reject(error);
			  }
			});
		  });
		
	}catch(error) {
		logger.error('Error in get Attachment: %s', error.toString());
		
		return "response"
	}
}

var getAttachmentHashCouch = async function(username, attachName) {
	try {
		console.log("In getAttachmentHashCouch-----"+username+"skk"+attachName)
		let filename = attachName
		var options = { 
			method: 'GET',
			url: baseUrl+'/'+dbname+'/'+username+'/'+filename,
			headers: 
			{ 
				'Cache-Control': 'no-cache' 
			} 
		};

		return new Promise(function (resolve, reject) {
			request(options, function (error, response1, body) {
			  if (!error) {
				console.log("response1.headers"+response1.headers["content-md5"])
				resolve(response1.headers["content-md5"]);
			  } else {
				reject(error);
			  }
			});
		  });
	
	}catch(error) {
		logger.error('Error in get Attachment: %s', username, error.toString());
		response.success = false
		response.message = error
		return response
	}
}

exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getRegisteredUser = getRegisteredUser;
exports.checkRegisteredUser = checkRegisteredUser
exports.sendMailVerification = sendMailVerification
exports.saveUserStatus = saveUserStatus
exports.verifyPin = verifyPin
exports.addAttachmentProcess = addAttachmentProcess
exports.getAttachmentProcess = getAttachmentProcess
exports.getAllAttachment = getAllAttachment
exports.insertAttachmentAndGenHash = insertAttachmentAndGenHash
exports.getAttachmentHashCouch = getAttachmentHashCouch
exports.getAttachmentHashBlockchain = getAttachmentHashBlockchain