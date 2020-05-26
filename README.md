## Balance transfer

A sample Node.js app to demonstrate **__fabric-client__** & **__fabric-ca-client__** Node.js SDK APIs

### Prerequisites and setup:

* [Docker](https://www.docker.com/products/overview) - v1.12 or higher
* [Docker Compose](https://docs.docker.com/compose/overview/) - v1.8 or higher
* [Git client](https://git-scm.com/downloads) - needed for clone commands
* **Node.js** v8.4.0 or higher
* [Download Docker images](http://hyperledger-fabric.readthedocs.io/en/latest/samples.html#binaries)

```
cd fabric-samples/balance-transfer/
```

Once you have completed the above setup, you will have provisioned a local network with the following docker container configuration:

* 2 CAs
* A SOLO orderer
* 4 peers (2 peers per Org)

#### Artifacts
* Crypto material has been generated using the **cryptogen** tool from Hyperledger Fabric and mounted to all peers, the orderering node and CA containers. More details regarding the cryptogen tool are available [here](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html#crypto-generator).
* An Orderer genesis block (genesis.block) and channel configuration transaction (mychannel.tx) has been pre generated using the **configtxgen** tool from Hyperledger Fabric and placed within the artifacts folder. More details regarding the configtxgen tool are available [here](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html#configuration-transaction-generator).

## Running the sample program

There are two options available for running the balance-transfer sample
For each of these options, you may choose to run with chaincode written in golang or in node.js.

### Option 1:

##### Terminal Window 1

* Launch the network using docker-compose

```
docker-compose -f artifacts/docker-compose.yaml up
```
##### Terminal Window 2

* Install the fabric-client and fabric-ca-client node modules

```
npm install
```

* Start the node app on PORT 4000

```
PORT=4000 node app
```

##### Terminal Window 3

* Execute the REST APIs from the section [Sample REST APIs Requests](https://github.com/hyperledger/fabric-samples/tree/master/balance-transfer#sample-rest-apis-requests)


### Option 2:

##### Terminal Window 1

```
cd fabric-samples/balance-transfer

./runApp.sh

```

* This launches the required network on your local machine
* Installs the fabric-client and fabric-ca-client node modules
* And, starts the node app on PORT 4000

##### Terminal Window 2


In order for the following shell script to properly parse the JSON, you must install ``jq``:

instructions [https://stedolan.github.io/jq/](https://stedolan.github.io/jq/)

With the application started in terminal 1, next, test the APIs by executing the script - **testAPIs.sh**:
```
cd fabric-samples/balance-transfer

## To use golang chaincode execute the following command

./testAPIs.sh -l golang

## OR use node.js chaincode

./testAPIs.sh -l node
```


## Sample REST APIs Requests

### Login Request

* Register and enroll new users in Organization - **Org1**:

`curl -s -X POST http://localhost:4000/users -H "content-type: application/x-www-form-urlencoded" -d 'username=Jim&orgName=Org1'`

**OUTPUT:**

```
{
  "success": true,
  "secret": "RaxhMgevgJcm",
  "message": "Jim enrolled Successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk"
}
```

The response contains the success/failure status, an **enrollment Secret** and a **JSON Web Token (JWT)** that is a required string in the Request Headers for subsequent requests.

### Create Channel request

```
curl -s -X POST \
  http://localhost:4000/channels \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"channelName":"mychannel",
	"channelConfigPath":"../../first-network/channel-artifacts/channel.tx"
}'
```

Please note that the Header **authorization** must contain the JWT returned from the `POST /users` call

### Join Channel request

```
curl -s -X POST \
  http://localhost:4000/channels/mychannel/peers \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org1.example.com"]
}'

curl -s -X POST \
  http://localhost:4000/channels/mychannel/peers \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNjAwNzQsInVzZXJuYW1lIjoic3V2cGF0aWxAcmVkaWZmbWFpbC5jb20iLCJvcmdOYW1lIjoiT3JnMiIsImlhdCI6MTU5MDMyNDA3NH0.0D09jNVmF-ITOfj2Q_-VbPs84ZLX1d1UPPsw_fj5ZXo" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org2.example.com"]
}'
```
### Install chaincode

```
curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org1.example.com"],
	"chaincodeName":"mycc",
	"chaincodePath":"github.com/kyc_customer/go",
	"chaincodeType": "golang",
	"chaincodeVersion":"v0"
}'

curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNjAwNzQsInVzZXJuYW1lIjoic3V2cGF0aWxAcmVkaWZmbWFpbC5jb20iLCJvcmdOYW1lIjoiT3JnMiIsImlhdCI6MTU5MDMyNDA3NH0.0D09jNVmF-ITOfj2Q_-VbPs84ZLX1d1UPPsw_fj5ZXo" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org2.example.com"],
	"chaincodeName":"mycc",
	"chaincodePath":"github.com/kyc_customer/go",
	"chaincodeType": "golang",
	"chaincodeVersion":"v0"
}'

curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org3.example.com"],
	"chaincodeName":"mycc",
	"chaincodePath":"github.com/kyc_customer/go",
	"chaincodeType": "golang",
	"chaincodeVersion":"v0"
}'
```

```

### Instantiate chaincode


```
curl -s -X POST \
  http://localhost:4000/channels/mychannel/chaincodes \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org1.example.com"],
	"chaincodeName":"mycc",
	"chaincodeVersion":"v0",
	"chaincodeType": "golang",
	"args":[]
}'
```
**NOTE:** *chaincodeType* must be set to **node** when node.js chaincode is used

### Invoke request

This invoke request is signed by peers from both orgs, *org1* & *org2*.
```
curl -s -X POST \
  http://localhost:4000/channels/mychannel/chaincodes/mycc \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer0.org1.example.com","peer0.org2.example.com"],
	"fcn":"saveCustomer",
	"args":["{\"KycID\": \"8025924\", \"Email\": \"suvit_patil88@rediffmail.com\", \"CustName\": \"Suvit\", \"FamilyName\": \"Patil\", \"CurrentResidentialAddress\": \"old sangvi\", \"PermanentResidentialAddress\": \"Pune\", \"MobileNo\": \"9011454898\", \"FaxNo\": \"Jim\", \"UploadPassport\": \"\", \"UploadLicense\": \"zAGoyB47gezDlB80HFLEzg==\"}"]
}'

```
**NOTE:** Ensure that you save the Transaction ID from the response in order to pass this string in the subsequent query transactions.

### Chaincode Query

```
curl -s -X GET \
  "http://localhost:4000/channels/mychannel/chaincodes/mycc?peer=peer0.org1.example.com&fcn=query&args=%5B%228025924%22%5D" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```
{"success":true,"message":{"currentResidentialAddress":"old sangvi","custName":"Suvit","docType":"customerDetails","email":"suvit_patil88@rediffmail.com","familyName":"Patil","faxNo":"Jim","kycId":"288446","mobileNo":"9011454898","permanentResidentialAddress":"Pune","uploadLicense":"","uploadPassport":""}}
### Query Block by BlockNumber

```
curl -s -X GET \
  "http://localhost:4000/channels/mychannel/blocks/1?peer=peer0.org1.example.com" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```

### Query Transaction by TransactionID

```
curl -s -X GET http://localhost:4000/channels/mychannel/transactions/<put transaction id here>?peer=peer0.org1.example.com \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```
**NOTE**: The transaction id can be from any previous invoke transaction, see results of the invoke request, will look something like `8a95b1794cb17e7772164c3f1292f8410fcfdc1943955a35c9764a21fcd1d1b3`.


### Query ChainInfo

```
curl -s -X GET \
  "http://localhost:4000/channels/mychannel?peer=peer0.org1.example.com" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```

### Query Installed chaincodes

```
curl -s -X GET \
  "http://localhost:4000/chaincodes?peer=peer0.org1.example.com&type=installed" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```

### Query Instantiated chaincodes

```
curl -s -X GET \
  "http://localhost:4000/chaincodes?peer=peer0.org1.example.com&type=instantiated" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```

### Query Channels

```
curl -s -X GET \
  "http://localhost:4000/channels?peer=peer0.org1.example.com" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1OTAzNTk3NTQsInVzZXJuYW1lIjoic3V2aXRfcGF0aWw4OEByZWRpZmZtYWlsLmNvbSIsIm9yZ05hbWUiOiJPcmcxIiwiaWF0IjoxNTkwMzIzNzU0fQ.2I51tZOMmdxSfNz-IVDyhTrG0CRzY1Un2Np21z7ZRHk" \
  -H "content-type: application/json"
```

### Clean the network

The network will still be running at this point. Before starting the network manually again, here are the commands which cleans the containers and artifacts.

```
docker rm -f $(docker ps -aq)
docker rmi -f $(docker images | grep dev | awk '{print $3}')
rm -rf fabric-client-kv-org[1-2]
```

### Network configuration considerations

You have the ability to change configuration parameters by either directly editing the network-config.yaml file or provide an additional file for an alternative target network. The app uses an optional environment variable "TARGET_NETWORK" to control the configuration files to use. For example, if you deployed the target network on Amazon Web Services EC2, you can add a file "network-config-aws.yaml", and set the "TARGET_NETWORK" environment to 'aws'. The app will pick up the settings inside the "network-config-aws.yaml" file.

#### IP Address** and PORT information

If you choose to customize your docker-compose yaml file by hardcoding IP Addresses and PORT information for your peers and orderer, then you MUST also add the identical values into the network-config.yaml file. The url and eventUrl settings will need to be adjusted to match your docker-compose yaml file.

```
peer1.org1.example.com:
  url: grpcs://x.x.x.x:7056
  eventUrl: grpcs://x.x.x.x:7058

```

#### Discover IP Address

To retrieve the IP Address for one of your network entities, issue the following command:

```
# this will return the IP Address for peer0
docker inspect peer0 | grep IPAddress
```

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
