const chai = require('chai');
const assert = require('chai').assert;
const expect = require('chai').expect;
const should = require('chai').should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const awsContext = require('aws-lambda-mock-context');
const AWS = require("aws-sdk-mock");
const request = require('request');
const sinon = require('sinon');

const index = require('../index');
const logger = require("../components/logger.js");
const configObj = require('../components/config.js');
const crud = require('../components/crud')();
const errorHandler = require("../components/error-handler.js")();
const validateUtils = require("../components/validation")();

describe('jazz_deployments', function () {
  var tableName, global, spy, stub, err, errMessage, errType, dataObj, event, context, callback, callbackObj, logMessage, logStub, indexName, responseObj;

  beforeEach(function () {
    spy = sinon.spy();
    event = {
      "stage": "test",
      "method": "",
      "path": {
        "id": "k!ngd0m_0f_mewni"
      },
      "query": {
        "service": "mag!c",
        "domain": "k!ngd0m",
        "environment": "test-branch"
      },
      "body": {
        "service_id": "dc1b2f36-49c2-ca59-5c88-2a1b930f5607",
        "request_id": "d33f1d40-dea4-4b59-93e7-5d351146a7e2",
        "service": "mag!c",
        "environment_logical_id": "test-branch",
        "scm_branch": "feature/test",
        "status": "successful",
        "domain": "k!ngd0m",
        "provider_build_url": "http://test/job/build_pack_api/211",
        "provider_build_id": "211",
        "scm_commit_hash": "abc123xyz",
        "scm_url": "http://test/k!ngd0m_mag!c.git"
      },
      "headers": {
        "Authorization": "zaqwsxcderfv.qawsedrftg.qxderfvbhy"
      }
    };
    context = awsContext();
    callback = (err, responseObj) => {
      if (err) {
        return err;
      } else {
        return JSON.stringify(responseObj);
      }
    };
    err = {
      "errorType": "svtfoe",
      "message": "starco"
    };
    callbackObj = {
      "callback": callback
    };
    config = configObj(event);
    tableName = config.DEPLOYMENT_TABLE;
    global = {
      authorization: event.headers.Authorization
    };

  });

  describe('genericInputValidation', () => {
    it("should indicate that method is missing/empty", () => {
      errMessage = "method cannot be empty";
      var invalidArray = ["", null, undefined];
      for (i in invalidArray) {
        event.method = invalidArray[0];
        index.genericInputValidation(event)
        .catch(error => {
          expect(error).to.include({result: 'inputError', message:errMessage})
        });
      };
    });

    it("should indicate that query params and path params are missing for GET method", () => {
      event.path = "";
      event.query = "";
      event.method = "GET";
      errMessage = "GET API can be called only with following query params: domain, service and environment OR GET API can be called only with deployment_id as path param.";
      index.genericInputValidation(event)
      .catch(error => {
        expect(error).to.include({result: 'inputError', message:errMessage})
      });
    });

    it("should indicate error if deployment_id is unavailable for GET, PUT and DELETE methods", () => {
      errMessage = "Missing input parameter deployment id";
      event.path.id = "";
      var methods = ["GET", "PUT", "DELETE"];
      for (method in methods) {
        event.method = methods[method];
        index.genericInputValidation(event)
        .catch(error => {
          expect(error).to.include({result: 'inputError',message:errMessage})
        });
      }
    });

    it("should indicate error if update data is not unavailable for PUT method", () => {
      errMessage = "Deployment data is required for updating a deployment";
      event.body = {};
      event.method = "PUT";
      index.genericInputValidation(event)
      .catch(error => {
        expect(error).to.include({result: 'inputError',message:errMessage})
      });
    });

    it("should indicate error if create payload is unavailable for POST method", () => {
      errMessage = "Deployment details are required for creating a deployment";
      event.body = {};
      event.path = {};
      event.method = "POST";
      index.genericInputValidation(event)
      .catch(error => {
        expect(error).to.include({result: 'inputError',message:errMessage})
      });
    });

    it("should indicate error if deployment_id is unavailable for POST method with re-build path", () => {
      errMessage = "Re-build API can be called with deployment_id as path param";
      event.body = {};
      event.path = {
        id: undefined
      };
      event.method = "POST";
      index.genericInputValidation(event)
      .catch(error => {
        expect(error).to.include({result: 'inputError',message:errMessage})
      });
    });
  });

  describe('validateDeploymentDetails', () => {
    it("should validate data for create payload for new deployment", () => {
      event.query = {};
      event.path = {};
      config = configObj(event);
      index.validateDeploymentDetails(config, event.body)
        .then(res => {
          expect(res).to.be.null;
        });
    });

    it("should indicate invalid status error while validating create payload for new deployment", () => {
      event.query = {};
      event.path = {};
      event.body.status = "invalid-status";
      config = configObj(event);
      index.validateDeploymentDetails(config, event.body)
        .catch(error => {
          expect(error).to.include({
            result: 'inputError'
          });
        });
    });

    it("should indicate empty data error while validating create payload for new deployment", () => {
      event.query = {};
      event.path = {};
      event.body = {};
      config = configObj(event);
      index.validateDeploymentDetails(config, event.body)
        .catch(error => {
          expect(error).to.include({
            message: "Input payload cannot be empty"
          });
        });
    });

    it("should indicate missing required data error while validating create payload for new deployment", () => {
      event.query = {};
      event.path = {};
      event.body.service = "";
      index.validateDeploymentDetails(config, event.body)
        .catch(error => {
          expect(error).to.include({
            result: 'inputError'
          });
        });
    });
  });

  describe('addNewDeploymentDetails', () => {
    it("should add new deployment details to dynamodb", () => {
      event.path = {};
      AWS.mock("DynamoDB.DocumentClient", "put", (params, cb) => {
        return cb(null, dataObj);
      });
      index.addNewDeploymentDetails(event.body, tableName)
        .then(res => {
          expect(res).to.have.property('deployment_id');
          AWS.restore("DynamoDB.DocumentClient")
        });
    });

    it("should indicate error while adding new deployment details to dynamodb", () => {
      event.path = {};
      AWS.mock("DynamoDB.DocumentClient", "put", (params, cb) => {
        return cb(err, null);
      });
      index.addNewDeploymentDetails(event.body, tableName)
        .catch(error => {
          expect(error).to.include({ result: 'databaseError'});
          AWS.restore("DynamoDB.DocumentClient")
        });
    });
  });

  describe('validateQueryParams', () => {
    it("should validate query params for deployments list", () => {
      index.validateQueryParams(config, event.query)
        .then(res => {
          expect(res).to.be.null
        });
    });

    it("should indicate invalid field error while validating query params", () => {
      event.query.invalid = "";
      index.validateQueryParams(config, event.query)
        .catch(error => {
          expect(error).to.include({
            "result": "inputError"
          })
        });
    });
  });

  describe('getDeploymentDetailsByQueryParam', () => {
    it("should get list of deployments form dynamdb if query params are defined", () => {
      var responseObj = {
        count: 1,
        deployments: [event.body]
      }
      AWS.mock("DynamoDB", "scan", (params, cb) => {
        var dataObj = {
          Items: [event.body]
        };
        return cb(null, dataObj);
      });
      index.getDeploymentDetailsByQueryParam(tableName, event.query)
        .then(res => {
          expect(res).to.have.property('deployments');
          AWS.restore("DynamoDB");
        });
    });

    it("should indicate error if DynamoDB.scan fails", () => {
      AWS.mock("DynamoDB", "scan", (params, cb) => {
        return cb(err, null);
      });
      index.getDeploymentDetailsByQueryParam(tableName, event.query)
      .catch(error => {
        expect(error).to.include(err);
        AWS.restore("DynamoDB");
      });
    });
  });

  describe('getDeploymentDetailsById', () => {
    it("should get deployment data by deployment_id using DynamoDB.DocumentClient.query", () => {
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        var dataObj = {
          Items: [event.body]
        }
        return cb(null, dataObj);
      });
      index.getDeploymentDetailsById(tableName, event.path.id)
      .then(res => {
        expect(res).to.include(event.body);
        AWS.restore("DynamoDB.DocumentClient");
      });
    });

    it("should indicate notFound error if provided deployment_id does not exist in DynamoDB", () => {
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        var dataObj = {
          Items: []
        }
        return cb(null, dataObj);
      });
      index.getDeploymentDetailsById(tableName, event.path.id)
      .catch(error => {
        expect(error).to.include({result: 'notFound'});
        AWS.restore("DynamoDB.DocumentClient");
      });
    })

    it("should indicate error while accessing deployment data by deployment_id of archived/missing deployments", () => {
      errMessage = "Cannot get details for archived/missing deployments.";
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        event.body.DEPLOYMENT_STATUS = "archived"
        var dataObj = {
          Items: [event.body]
        }
        return cb(null, dataObj);
      });
      index.getDeploymentDetailsById(tableName, event.path.id)
      .catch(error => {
        expect(error).to.include({message: errMessage});
        AWS.restore("DynamoDB.DocumentClient");
      });
    });

    it("should indicate error while accessing deployment data by deployment_id using DynamoDB.DocumentClient.quer", () => {
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        event.body.DEPLOYMENT_STATUS = "archived"
        return cb(err, null);
      });
      index.getDeploymentDetailsById(tableName, event.path.id)
        .catch(error => {
          expect(error).to.include(err);
          AWS.restore("DynamoDB.DocumentClient");
        });
    });
  });

  describe('validateUpdateInput', () => {
    it("should validate update payload for deployment", () => {
      var update_data = {
        status: "in_progress"
      }
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        var dataObj = {
          Items: [event.body]
        }
        return cb(null, dataObj);
      });
      index.validateUpdateInput(config, update_data, tableName, event.path.id)
        .then(res => {
          expect(res).to.include(update_data);
          AWS.restore("DynamoDB.DocumentClient");
        });
    });

    it("should indicate input error while validating update payload for deployment", () => {
      var update_data = {
        status: "invalid-status"
      };
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        var dataObj = {
          Items: [event.body]
        }
        return cb(null, dataObj);
      });
      index.validateUpdateInput(config, update_data, tableName, event.path.id)
        .catch(error => {
          expect(error).to.include({result: "inputError"});
          AWS.restore("DynamoDB.DocumentClient");
        });
    });

    it("should indicate notFound error while validating update payload for deployment", () => {
      var update_data = {
        status: "in_progress"
      }
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        var dataObj = {
          Items: []
        }
        return cb(null, dataObj);
      });
      index.validateUpdateInput(config, update_data, tableName, event.path.id)
      .catch(error => {
        expect(error).to.include({result: 'notFound'});
        AWS.restore("DynamoDB.DocumentClient");
      });
    });

    it("should indicate internal server error while validating update payload for deployment", () => {
      var update_data = {
        status: "in_progress"
      }
      AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
        return cb(err, null);
      });
      index.validateUpdateInput(config, update_data, tableName, event.path.id)
      .catch(error => {
        expect(error).to.include(err);
        AWS.restore("DynamoDB.DocumentClient");
      });
    });
  });

  describe('updateDeploymentDetails', () => {
    it("should update deployment data using DynamoDB.DocumentClient.update", () => {
      var update_data = {
        status: "aborted"
      };
      var dataObj = {
        data: event.body
      }
      AWS.mock("DynamoDB.DocumentClient", "update", (param, cb) => {
        return cb(null, dataObj);
      });
      index.updateDeploymentDetails(tableName, update_data, event.path.id)
        .then(res => {
          expect(res).to.include(dataObj);
          AWS.restore("DynamoDB.DocumentClient");
        });
    });

    it("should indicate error while updating deployment data using DynamoDB.DocumentClient.update", () => {
      var update_data = {
        status: "aborted"
      };
      AWS.mock("DynamoDB.DocumentClient", "update", (param, cb) => {
        return cb(err, null);
      });
      index.updateDeploymentDetails(tableName, update_data, event.path.id)
        .catch(error => {
          expect(error).to.include({result: 'databaseError'});
          AWS.restore("DynamoDB.DocumentClient");
        });
      
    });
  });

  describe('deleteServiceByID', () => {
    it("Should delete deployment data from the dynamoDB using DynamoDB.DocumentClient.delete", () => {
      var responseObj = {
        deploymentId: event.path.id
      }
      AWS.mock("DynamoDB.DocumentClient", "delete", (param, cb) => {
        var dataObj = {
          data: {}
        }
        return cb(null, dataObj);
      });
      index.deleteServiceByID(event.body, tableName, event.path.id)
        .then(res => {
          expect(res).to.include(responseObj);
          AWS.restore("DynamoDB.DocumentClient");
        });
    });

    it("Should indicate error while deleting deployment data from the dynamoDB using DynamoDB.DocumentClient.delete", () => {
      AWS.mock("DynamoDB.DocumentClient", "delete", (param, cb) => {
        return cb(err, null);
      });
      index.deleteServiceByID(event.body, tableName, event.path.id)
        .catch(error => {
          expect(error).to.include(err);
          AWS.restore("DynamoDB.DocumentClient");
        });
    });
  });

  describe('getToken', () => {
    it("should successfully get token on making login request", () => {
      var responseObj = {
        statusCode: 200,
        body: {
          data: {
            token: "zaqwsxcderfv.qawsedrftg.qxderfvbhy"
          }
        }
      };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.getToken(config)
        .then(res => {
          expect(res).to.eq(responseObj.body.data.token);
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });

    it("should indicate error while making request to login api", () => {
      var responseObj = {
        statusCode: 400,
        body: {
          data: {},
          message: "Could not get authentication token"
        }
      };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.getToken(config)
        .catch(error => {
          expect(error).to.include({
            message: 'Could not get authentication token'
          });
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });

    it("should indicate error while making request to login api", () => {
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(err, null, null)
      });
      index.getToken(config)
        .catch(error => {
          expect(error).to.include({
            error: 'Could not get authentication token for updating service catalog.'
          });
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });
  });

  describe('getServiceDetails', () => {
    it("should successfully get service details by making request to services api", () => {
      var authToken = "zaqwsxcderfv.qawsedrftg.qxderfvbhy";
      var responseObj = {
        statusCode: 200,
        body: {
          data: {
            service: "mag!c",
            domain: "k!ngd0m",
            type: "api"
          },
          input: {
            service_id: event.path.id
          }
        }
      };
      responseObj.body = "{\"data\":{\"service\":\"mag!c\",\"domain\":\"k!ngd0m\",\"type\":\"api\"},\"input\":{\"service_id\":\"k!ngd0m_0f_mewni\"}}"
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.getServiceDetails(config, event.body.service_id, authToken)
        .then(res => {
          expect(res).to.have.deep.property('data.service');
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });

    it("should indicate error while accessing service details by making request to services api", () => {
      var authToken = "zaqwsxcderfv.qawsedrftg.qxderfvbhy";
      var responseObj = {
        statusCode: 404,
        body: {
          data: {
            errorType: "NotFound"
          },
          input: {
            service_id: event.path.id
          }
        }
      };
      responseObj.body = "{\"data\":{\"errorType\":\"NotFound\"},\"input\":{\"service_id\":\"k!ngd0m_0f_mewni\"}}"
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.getServiceDetails(config, event.body.service_id, authToken)
        .then(res => {
          expect(res).to.have.deep.property('data.errorType');
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });

    it("should indicate error while accessing service details by making request to services api", () => {
      var authToken = "zaqwsxcderfv.qawsedrftg.qxderfvbhy";
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(err, null, null)
      });
      index.getServiceDetails(config, event.body.service_id, authToken)
        .catch(error => {
          expect(error).to.include(err);
        });
      sinon.assert.calledOnce(reqStub);
      reqStub.restore();
    });
  });

  describe('buildNowRequest', () => {
    it("should successfully initiate deployment re-build", () => {
      var serviceDetails = {
          data: {
            service: "mag!c",
            domain: "k!ngd0m",
            type: "api"
          }
        },
        responseObj = {
          statusCode: 200,
          body: {
            data: {}
          }
        };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.buildNowRequest(serviceDetails, config, event.body)
        .then(res => {
          expect(res).to.include({
            message: 'deployment started.'
          });
          sinon.assert.calledOnce(reqStub);
          reqStub.restore();
        });
    });

    it("should indicate notFound error while initiating deployment re-build", () => {
      var serviceDetails = {
          data: {
            service: "mag!c",
            domain: "k!ngd0m",
            type: "api"
          }
        },
        responseObj = {
          statusCode: 404,
          body: {
            data: {}
          }
        };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.buildNowRequest(serviceDetails, config, event.body)
        .catch(error => {
          expect(error).to.include({
            result: 'notFound'
          });
          sinon.assert.calledOnce(reqStub);
          reqStub.restore();
        });
    });

    it("should indicate error while initiating deployment re-build", () => {
      var serviceDetails = {
          data: {
            service: "mag!c",
            domain: "k!ngd0m",
            type: "api"
          }
        },
        responseObj = {
          statusCode: 500,
          body: {
            data: {}
          }
        };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(null, responseObj, responseObj.body)
      });
      index.buildNowRequest(serviceDetails, config, event.body)
        .catch(error => {
          expect(error).to.include("unknown error occurred");
          sinon.assert.calledOnce(reqStub);
          reqStub.restore();
        });
    });

    it("should indicate error while initiating deployment re-build", () => {
      var serviceDetails = {
          data: {
            service: "mag!c",
            domain: "k!ngd0m",
            type: "api"
          }
        };
      reqStub = sinon.stub(request, "Request").callsFake((obj) => {
        return obj.callback(err, null, null)
      });
      index.buildNowRequest(serviceDetails, config, event.body)
        .catch(error => {
          expect(error).to.include(err);
          sinon.assert.calledOnce(reqStub);
          reqStub.restore();
        });
    });

    it("should indicate error if service details are not provided while initiating deployment re-build", () => {
      var serviceDetails = {
          data: {
            type: "api"
          }
        };
        config.JOB_BUILD_URL = "";
      index.buildNowRequest(serviceDetails, config, event.body)
        .catch(error => {
          expect(error).to.include("unable to find deployment details");
        });
    });

  });

  describe('processDeploymentCreation', () => {
    it("should process deployment creation", () => {
      const validateDeploymentDetails = sinon.stub(index, "validateDeploymentDetails").resolves(null);
      const addNewDeploymentDetails = sinon.stub(index, "addNewDeploymentDetails").resolves({
        result: 'success',
        deployment_id: '123'
      })
      index.processDeploymentCreation(config, event.body, tableName)
        .then(res => {
          expect(res).to.include.keys('result');
          sinon.assert.calledOnce(validateDeploymentDetails);
          sinon.assert.calledOnce(addNewDeploymentDetails);
          validateDeploymentDetails.restore();
          addNewDeploymentDetails.restore();
        });
    });

    it("should indicate error while  processing deployment creation", () => {
      const validateDeploymentDetails = sinon.stub(index, "validateDeploymentDetails").resolves(null);
      const addNewDeploymentDetails = sinon.stub(index, "addNewDeploymentDetails").rejects(err)
      index.processDeploymentCreation(config, event.body, tableName)
        .catch((error) => {
          expect(error).to.be.eq(err);
          sinon.assert.calledOnce(validateDeploymentDetails);
          sinon.assert.calledOnce(addNewDeploymentDetails);
          validateDeploymentDetails.restore();
          addNewDeploymentDetails.restore();
        });
    });
  });

  describe('processDeploymentRebuild', () => {
    it("should process deployment re-build", () => {
      var responseObj = {
        result: 'success',
        message: "deployment started."
      }
      const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").resolves(event.body);
      const reBuildDeployment = sinon.stub(index, "reBuildDeployment").resolves(responseObj);
      index.processDeploymentRebuild(config, event.path.id, tableName)
        .then(res => {
          expect(res).to.be.eq(responseObj)
          sinon.assert.calledOnce(getDeploymentDetailsById);
          sinon.assert.calledOnce(reBuildDeployment);
          getDeploymentDetailsById.restore();
          reBuildDeployment.restore();
        });
    });

    it("should indicate error while processing deployment re-build", () => {
      var responseObj = {
        result: "notFound",
        message: "Unable to rebuild deployment"
      };
      const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").resolves(event.body);
      const reBuildDeployment = sinon.stub(index, "reBuildDeployment").rejects(responseObj);
      index.processDeploymentRebuild(config, event.path.id, tableName)
        .catch(error => {
          expect(error).to.eq(responseObj);
          sinon.assert.calledOnce(getDeploymentDetailsById);
          sinon.assert.calledOnce(reBuildDeployment);
          getDeploymentDetailsById.restore();
          reBuildDeployment.restore();
        })

    });

  });

  describe('processDeploymentsList', () => {
    it("should process deployment list", () => {
      var responseObj = {
        count: 1,
        deployments: [event.body]
      }
      const validateQueryParams = sinon.stub(index, "validateQueryParams").resolves(null);
      const getDeploymentDetailsByQueryParam = sinon.stub(index, "getDeploymentDetailsByQueryParam").resolves(responseObj)
      index.processDeploymentsList(config, event.query, tableName)
        .then(res => {
          expect(res).to.include.keys('deployments');
          sinon.assert.calledOnce(validateQueryParams);
          sinon.assert.calledOnce(getDeploymentDetailsByQueryParam);
          validateQueryParams.restore();
          getDeploymentDetailsByQueryParam.restore();
        });
    });

    it("should indicate error while  processing deployment list", () => {
      const validateQueryParams = sinon.stub(index, "validateQueryParams").resolves(null);
      const getDeploymentDetailsByQueryParam = sinon.stub(index, "getDeploymentDetailsByQueryParam").rejects(err);
      index.processDeploymentsList(config, event.query, tableName)
        .catch((error) => {
          expect(error).to.be.eq(err);
          sinon.assert.calledOnce(validateQueryParams);
          sinon.assert.calledOnce(getDeploymentDetailsByQueryParam);
          validateQueryParams.restore();
          getDeploymentDetailsByQueryParam.restore();
        });
    });
  });

  describe('processDeploymentsUpdate', () => {
    it("should process deployments update", () => {
      var dataObj = {
        Items: [event.body]
      }
      const validateUpdateInput = sinon.stub(index, "validateUpdateInput").resolves({
        message: "Deployment with provided Id exist",
        input: event.body
      })
      const updateDeploymentDetails = sinon.stub(index, "updateDeploymentDetails").resolves(dataObj)
      index.processDeploymentsUpdate(config, event.body, tableName, event.path.id)
        .then((res) => {
          expect(res).to.be.eq(dataObj);
          sinon.assert.calledOnce(validateUpdateInput);
          sinon.assert.calledOnce(updateDeploymentDetails);
          validateUpdateInput.restore();
          updateDeploymentDetails.restore();
        });
    });

    it("should indicate error while processing deployments update", () => {
      const validateUpdateInput = sinon.stub(index, "validateUpdateInput").resolves({
        message: "Deployment with provided Id exist",
        input: event.body
      })
      const updateDeploymentDetails = sinon.stub(index, "updateDeploymentDetails").rejects(err)
      index.processDeploymentsUpdate(config, event.body, tableName, event.path.id)
        .catch(error => {
          expect(error).to.be.eq(err);
          sinon.assert.calledOnce(validateUpdateInput);
          sinon.assert.calledOnce(updateDeploymentDetails);
          validateUpdateInput.restore();
          updateDeploymentDetails.restore();
        });
    });
  });

  describe('processDeploymentsDeletion', () => {
    it("should process deployments deletion", () => {
      var responseObj = {
        deploymentId: event.path.id
      }
      const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").resolves(event.body);
      const deleteServiceByID = sinon.stub(index, "deleteServiceByID").resolves({
        deploymentId: event.path.id
      })
      index.processDeploymentsDeletion(tableName, event.path.id)
        .then(res => {
          expect(res).to.include(responseObj);
          sinon.assert.calledOnce(getDeploymentDetailsById);
          sinon.assert.calledOnce(deleteServiceByID);
          getDeploymentDetailsById.restore();
          deleteServiceByID.restore();
        });
    });

    it("should indicate error while processing deployments deletion", () => {
      const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").resolves(event.body);
      const deleteServiceByID = sinon.stub(index, "deleteServiceByID").rejects(err)
      index.processDeploymentsDeletion(tableName, event.path.id)
        .catch(error => {
          expect(error).to.be.eq(err);
          sinon.assert.calledOnce(getDeploymentDetailsById);
          sinon.assert.calledOnce(deleteServiceByID);
          getDeploymentDetailsById.restore();
          deleteServiceByID.restore();
        });
    });
  });

  describe('reBuildDeployment', () => {
    it("should successfully re-build the  provided deployment", () => {
      var responseObj = {
          statusCode: 200,
          body: {
            data: {
              "service": "mag!c",
              "domain": "k!ngd0m",
              "type": "api"
            },
            "input": {
              "service_id": "k!ngd0m_0f_mewni"
            }
          }
        },
        result = {
          result: 'success',
          message: 'deployment started.'
        };
      const getToken = sinon.stub(index, "getToken").resolves(event.headers.Authorization);
      const getServiceDetails = sinon.stub(index, "getServiceDetails").resolves(responseObj)
      const buildNowRequest = sinon.stub(index, "buildNowRequest").resolves(result)
      index.reBuildDeployment(event.body, config)
        .then((res) => {
          expect(res).to.be.eq(result);
          sinon.assert.calledOnce(getToken);
          sinon.assert.calledOnce(getServiceDetails);
          sinon.assert.calledOnce(buildNowRequest);
          getToken.restore();
          getServiceDetails.restore();
          buildNowRequest.restore();
        });
    });

    it("should indicate error while re-building the deployment", () => {
      const getToken = sinon.stub(index, "getToken").rejects({
        "error": "Could not get authentication token for updating service catalog.",
        "message": err.message
      });
      const getServiceDetails = sinon.stub(index, "getServiceDetails").rejects(err)
      const buildNowRequest = sinon.stub(index, "buildNowRequest").rejects(err)
      index.reBuildDeployment(event.body, config)
        .catch((error) => {
          expect(error).to.include({
            message: err.message
          });
          sinon.assert.calledOnce(getToken);
          sinon.assert.notCalled(getServiceDetails);
          sinon.assert.notCalled(buildNowRequest);
          getToken.restore();
          getServiceDetails.restore();
          buildNowRequest.restore();
        });
    });
  });

  describe('handler', () => {
    it("should indicate input error during the generic validation", () => {
      event.method = undefined;
      const genericInputValidation = sinon.stub(index, "genericInputValidation").rejects({result:"inputError", message:"method cannot be empty"})
      message = '{"errorType":"BadRequest","message":"method cannot be empty"}';
      index.handler(event, context, (err, res) => {
         expect(err).to.include(message);
      });

      sinon.assert.calledOnce(genericInputValidation);
      genericInputValidation.restore();
    });

    it("should indicate internal server error during the generic validation", () => {
      event.method = undefined;
      const genericInputValidation = sinon.stub(index, "genericInputValidation").rejects(err)
      message = '{"errorType":"InternalServerError","message":"Unexpected error occurred."}';
      index.handler(event, context, (err, res) => {
         expect(err).to.include(message);
      });

      sinon.assert.calledOnce(genericInputValidation);
      genericInputValidation.restore();
    });

    describe('handler with success genericInputValidation', () => {
      let genericInputValidation;
      beforeEach(() => {
        genericInputValidation = sinon.stub(index, "genericInputValidation").resolves(null);
      });
      afterEach(() => {
        genericInputValidation.restore();
      })
      it("should successfully create new deployment using POST method", () => {
        event.method = "POST";
        event.path = {};      
        const processDeploymentCreation = sinon.stub(index, "processDeploymentCreation").resolves({
          result: 'success',
          deployment_id: '123'
        });
  
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.deployment_id')
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentCreation);
  
          processDeploymentCreation.restore();
        }); 
      });

      it("should indicate internal server error while creating new deployment using POST method", () => {
        event.method = "POST";
        event.path = {};
        message = '{"errorType":"BadRequest","message":"Input payload cannot be empty"}';

        const processDeploymentCreation = sinon.stub(index, "processDeploymentCreation").rejects({
          result: "inputError",
          message: "Input payload cannot be empty"
        });
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message)
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentCreation);
  
          processDeploymentCreation.restore();
        });
      });
  
      it("should indicate internal server error while creating new deployment using POST method", () => {
        event.method = "POST";
        event.path = {};
        message = '{"errorType":"InternalServerError","message":"unexpected error occurred"}';

        const processDeploymentCreation = sinon.stub(index, "processDeploymentCreation").rejects(err);
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message)
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentCreation);
  
          processDeploymentCreation.restore();
        });
      });
  
      it("should successfully initiate re-build deployment using POST method", () => {
        event.method = "POST";
        var responseObj = {
          result: 'success',
          message: "deployment started."
        };
        
        const processDeploymentRebuild = sinon.stub(index, "processDeploymentRebuild").resolves(responseObj)
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.result');
  
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentRebuild);
  
          processDeploymentRebuild.restore();
        });
  
      });
  
      it("should indicate internal server error while initiating re-build deployment using POST method", () => {
        event.method = "POST";
        message = '{"errorType":"InternalServerError","message":"unhandled error occurred"}'
        
        const processDeploymentRebuild = sinon.stub(index, "processDeploymentRebuild").rejects(err)
        index.handler(event, context, (err, res) => {
          expect(err).include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentRebuild);
  
          processDeploymentRebuild.restore();
        });
  
      });
  
      it("should indicate NotFound error while initiating re-build deployment using POST method", () => {
        event.method = "POST";
        var responseObj = {
          result: "notFound",
          message: "Unable to rebuild deployment"
        };
        message = '{"errorType":"NotFound","message":"Unable to rebuild deployment"}'
        
        const processDeploymentRebuild = sinon.stub(index, "processDeploymentRebuild").rejects(responseObj)
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentRebuild);
  
          processDeploymentRebuild.restore();
        });
      });
  
      it("should successfully get list of deployments with provided query params using GET method", () => {
        event.method = "GET";
        event.path = {};
        var responseObj = {
          count: 1,
          deployments: [event.body]
        };
        
        const processDeploymentsList = sinon.stub(index, "processDeploymentsList").resolves(responseObj)
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.deployments');
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsList);
  
          processDeploymentsList.restore();
        });
      });
  
      it("should indicate error while fecthing list of deployments with provided query params using GET method", () => {
        event.method = "GET";
        event.path = {};
        message = '{"errorType":"BadRequest","message":"Input payload cannot be empty"}'
        
        const processDeploymentsList = sinon.stub(index, "processDeploymentsList").rejects({
          result: "inputError",
          message: "Input payload cannot be empty"
        });
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsList);
  
          processDeploymentsList.restore();
        });
      });

      it("should indicate error while fecthing list of deployments with provided query params using GET method", () => {
        event.method = "GET";
        event.path = {};
        message = '{"errorType":"InternalServerError","message":"unexpected error occurred"}'
        
        const processDeploymentsList = sinon.stub(index, "processDeploymentsList").rejects(err)
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsList);
  
          processDeploymentsList.restore();
        });
      });
  
      it("should successfully get deployment with provided path param using GET method", () => {
        event.method = "GET";
        event.query = {};
        
        const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").resolves(event.body)
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.deployment_id');
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(getDeploymentDetailsById);
        });
        getDeploymentDetailsById.restore();
        
      });
  
      it("should indicate notFound error while fetching deployment data with provided path param using GET method", () => {
        event.method = "GET";
        event.query = {};
        message = '{"errorType":"NotFound","message":"Cannot get details for archived/missing deployments."}'
        
        const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").rejects({
          result: "deployment_already_deleted_error",
          message: "Cannot get details for archived/missing deployments."
        })
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(getDeploymentDetailsById);
  
          getDeploymentDetailsById.restore();
        });
      });
  
      it("should indicate internal server error while fetching deployment data with provided path param using GET method", () => {
        event.method = "GET";
        event.query = {};
        message = '{"errorType":"InternalServerError","message":"unexpected error occurred"}'
        
        const getDeploymentDetailsById = sinon.stub(index, "getDeploymentDetailsById").rejects(err)
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(getDeploymentDetailsById);
  
          getDeploymentDetailsById.restore();
        });
      });
  
      it("should successfully update deployment data using PUT method", () => {
        event.method = "PUT";
        
        const processDeploymentsUpdate = sinon.stub(index, "processDeploymentsUpdate").resolves(event.body)
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.message');
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsUpdate);
  
          processDeploymentsUpdate.restore();
        });
      });
  
      it("should indicate notFound error while updating deployment data using PUT method", () => {
        event.method = "PUT";
        message = '{"errorType":"NotFound","message":"Cannot find deployment details with id :' + event.path.id + '"}'
        
        const processDeploymentsUpdate = sinon.stub(index, "processDeploymentsUpdate").rejects({
          result: "notFound",
          message: 'Cannot find deployment details with id :' + event.path.id
        });
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsUpdate);
  
          processDeploymentsUpdate.restore();
        });
      });
  
      it("should indicate input error while updating deployment data using PUT method", () => {
        event.method = "PUT";
        message = '{"errorType":"BadRequest","message":"Input payload cannot be empty"}'
        
        const processDeploymentsUpdate = sinon.stub(index, "processDeploymentsUpdate").rejects({
          result: "inputError",
          message: "Input payload cannot be empty"
        });
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsUpdate);
  
          processDeploymentsUpdate.restore();
        });
      });
  
      it("should indicate internal server error while updating deployment data using PUT method", () => {
        event.method = "PUT";
        message = '{"errorType":"InternalServerError","message":"unexpected error occurred"}'
        
        const processDeploymentsUpdate = sinon.stub(index, "processDeploymentsUpdate").rejects(err);
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsUpdate);
  
          processDeploymentsUpdate.restore();
        });
      });
  
      it("should successfully delete deployment data using DELETE method", () => {
        event.method = "DELETE";
        const processDeploymentsDeletion = sinon.stub(index, "processDeploymentsDeletion").resolves({
          deploymentId: event.path.id
        })
        index.handler(event, context, (err, res) => {
          expect(res).to.have.deep.property('data.message');
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsDeletion);
  
          processDeploymentsDeletion.restore();
        });
      });
  
      it("should indicate notFound error while deleting deployment data using DELETE method", () => {
        event.method = "DELETE";
        message = '{"errorType":"NotFound","message":"Cannot find deployment details with id :' + event.path.id + '"}'
        
        const processDeploymentsDeletion = sinon.stub(index, "processDeploymentsDeletion").rejects({
          result: "notFound",
          message: 'Cannot find deployment details with id :' + event.path.id
        })
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsDeletion);
  
          processDeploymentsDeletion.restore();
        });
      });
  
      it("should indicate error while deleting deployment data using DELETE method", () => {
        event.method = "DELETE";
        message = '{"errorType":"InternalServerError","message":"unexpected error occurred "}'
        AWS.mock("DynamoDB.DocumentClient", "query", (param, cb) => {
          return cb(err, null);
        });
        
        const processDeploymentsDeletion = sinon.stub(index, "processDeploymentsDeletion").rejects(err)
        index.handler(event, context, (err, res) => {
          expect(err).to.include(message);
          sinon.assert.calledOnce(genericInputValidation);
          sinon.assert.calledOnce(processDeploymentsDeletion);
  
          processDeploymentsDeletion.restore();
        });
      });
    });
  });
});