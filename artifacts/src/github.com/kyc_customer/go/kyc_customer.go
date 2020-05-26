/*
Copyright IBM Corp. 2016 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main


import (
	"fmt"
	"encoding/json"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

var logger = shim.NewLogger("kyc_customer")

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

type customerDetails struct {
	ObjectType 					string `json:"docType"` //docType is used to distinguish the various types of objects in state database
	KycID                       string `json:"kycId"`  //the fieldtags are needed to keep case from bouncing around
	Email      					string `json:"email"`    
	CustName       				string `json:"custName"`    
	FamilyName					string `json:"familyName"`
	CurrentResidentialAddress   string `json:"currentResidentialAddress"`
	PermanentResidentialAddress	string `json:"permanentResidentialAddress"`
	MobileNo       				string `json:"mobileNo"`
	FaxNo						string `json:"faxNo"`
	UploadPassport				string `json:"uploadPassport"`
	UploadLicense				string `json:"uploadLicense"`
}

type attachment struct {
	KycID                       string `json:"kycId"`  //the fieldtags are needed to keep case from bouncing around
	AttachDesc      			string `json:"attachDesc"`    
	UploadHash       			string `json:"uploadHash"`
}

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response  {
	return shim.Success(nil)
}

// Transaction makes payment of X units from A to B
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### example_cc0 Invoke ###########")

	function, args := stub.GetFunctionAndParameters()
	
	if function == "saveCustomer" {
		// save an entity in its state
		return t.saveCustomer(stub, args)
	}
	if function == "addAttachment" {
		// save an entity in its state
		return t.addAttachment(stub, args)
	}
	if function == "query" {
		// queries an entity state
		return t.query(stub, args)
	}

	logger.Errorf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0])
	return shim.Error(fmt.Sprintf("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'. But got: %v", args[0]))
}

func (t *SimpleChaincode) saveCustomer(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// must be an invoke
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	// ==== Input sanitation ====
	fmt.Println("- start init request")
	fmt.Println(args[0])
	requestDetails := customerDetails{}
	//fmt.Println("requestDetails..."+ requestDetails)
	err1 := json.Unmarshal([]byte(args[0]), &requestDetails)
	if err1 != nil {
        return shim.Error("Failed to unmarshal request: " + err.Error())
    }

	// Get the state from the ledger
	// TODO: will be nice to have a GetAllState call to ledger
	custDetailsBytes, err := stub.GetState(requestDetails.KycID)
	if err != nil {
		return shim.Error("Failed to get state")
	}
	if custDetailsBytes != nil {
		return shim.Error("Customer details already exist: "+requestDetails.KycID)
	}
	
	// ==== Create marble object and marshal to JSON ====
	objectType := "customerDetails"
	customerDetails := &customerDetails{objectType, 
		requestDetails.KycID,
		requestDetails.Email,
		requestDetails.CustName,     				    
		requestDetails.FamilyName,				
		requestDetails.CurrentResidentialAddress,
		requestDetails.PermanentResidentialAddress,
		requestDetails.MobileNo,
		requestDetails.FaxNo,						
		requestDetails.UploadPassport,
		requestDetails.UploadLicense	 }
	customerDetailsJSONasBytes, err := json.Marshal(customerDetails)
	if err != nil {
		return shim.Error(err.Error())
	}
	
	// === Save to state ===
	err = stub.PutState(requestDetails.KycID, customerDetailsJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}


    return shim.Success(nil);
}

func (t *SimpleChaincode) addAttachment(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// must be an invoke
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	// ==== Input sanitation ====
	fmt.Println("- start addAttachment request")
	fmt.Println(args[0])
	
	requestDetails := attachment{}
	err1 := json.Unmarshal([]byte(args[0]), &requestDetails)
	if err1 != nil {
        return shim.Error("Failed to unmarshal request: " + err.Error())
    }
	fmt.Println("- requestDetails------------"+requestDetails.KycID)
	
	
	custDetailsBytes, err := stub.GetState(requestDetails.KycID)
	if err != nil {
		return shim.Error("Failed to get state")
	}
	if custDetailsBytes == nil {
		return shim.Error("Customer details does not exist for: "+requestDetails.KycID)
	}
	
	custDetails := customerDetails{}

	json.Unmarshal(custDetailsBytes, &custDetails)
	if requestDetails.AttachDesc == "Passport" {	
		fmt.Println("- IF requestDetails.AttachDesc------------"+requestDetails.AttachDesc)
		custDetails.UploadPassport = requestDetails.UploadHash
	} 
	if requestDetails.AttachDesc == "License" {
		custDetails.UploadLicense = requestDetails.UploadHash
	}
	
	customerDetailsJSONasBytes, err := json.Marshal(custDetails)
	if err != nil {
		return shim.Error(err.Error())
	}
	
	// === Save to state ===
	err = stub.PutState(requestDetails.KycID, customerDetailsJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}


    return shim.Success(nil);
}

// Query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	var custDetail string // Entities
	var err error
	fmt.Println("- start query request len : "+ args[0])
	// if len(args) != 1 {
	// 	return shim.Error("Incorrect number of arguments. Expecting email/username of the customer to query")
	// }

	custDetail = args[0]

	// Get the state from the ledger
	custDetailBytes, err := stub.GetState(custDetail)
	if err != nil {
		jsonResp := "{\"Error\":\"Failed to get state for " + custDetail + "\"}"
		return shim.Error(jsonResp)
	}

	if custDetailBytes == nil {
		jsonResp := "{\"Error\":\"Nil amount for " + custDetail + "\"}"
		return shim.Error(jsonResp)
	}

	//jsonResp := "{\"Name\":\"" + A + "\",\"Amount\":\"" + string(Avalbytes) + "\"}"
	//logger.Infof("Query Response:%s\n", jsonResp)
	return shim.Success(custDetailBytes)
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		logger.Errorf("Error starting KYC chaincode: %s", err)
	}
}
