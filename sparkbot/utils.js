//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

const got = require("got");
const crypto = require("crypto");

const debug = require("debug")("sparkbot:utils");
const fine = require("debug")("sparkbot:utils:fine");

const Utils = {};
module.exports = Utils;


// Returns true if specified JSON data complies with the Webhook documentation
// see https://developer.webex.com/webhooks-explained.html 
//
//   {
//     "id":"Y2lzY29zcGFyazovL3VzL1dFQkhPT0svZjRlNjA1NjAtNjYwMi00ZmIwLWEyNWEtOTQ5ODgxNjA5NDk3",         // webhook id
//     "created":"2016-08-23T16:26:02.754Z"                                                             // wehook creation date (does not change, not attached to the event)                                                                     
//     "name":"Guild Chat to http://requestb.in/1jw0w3x1",                                              // as specified at creation
//     "targetUrl":"https://mybot.localtunnel.me/",                                                     // as specified at creation
//     "filter":"roomId=Y2lzY29zcGFyazovL3VzL1JPT00vY2RlMWRkNDAtMmYwZC0xMWU1LWJhOWMtN2I2NTU2ZDIyMDdi",  // optional, as specified at creation
//     "resource":"messages",                                                                           // actual resource that triggered the webhook (different from specified at creation if 'all' was specified)
//     "event":"created",                                                                               // actual event that triggered the webhook (different from specified at creation if 'all' was specified)
//     "actorId":"Y2lzY29zcGFyazovL3VzL1dFQkhPT0svZjRlNjA1NjAtNjYwMi353454123E1221",                    // actual actor who triggered the webhook (source event)
//     "data":{
//          ...
//          EVENT SPECIFIC 
//          ...
//     }
//   } 
const supportedResources = ["attachmentActions", "memberships", "messages", "rooms"];
const supportedEvents = ["created", "deleted", "updated"];
Utils.checkWebhookEvent = function (payload) {
   if (!payload || !payload.id
      || !payload.name
      || !payload.created
      || !payload.targetUrl
      || !payload.resource
      || !payload.event
      || !payload.actorId
      || !payload.data
      || !payload.status
      || !payload.createdBy
      // Extract fields introduced (not checked for now)
      //|| !payload.appId
      //|| !payload.orgId
      //|| !payload.ownedBy
   ) {
      debug("received payload is not compliant with Webhook specifications");
      return false;
   }

   if (supportedResources.indexOf(payload.resource) == -1) {
      debug("incoming resource '" + payload.resource + "' does not comply with webhook specifications");
      return false;
   }
   if (supportedEvents.indexOf(payload.event) == -1) {
      debug("incoming event '" + payload.event + "' does not comply with webhook specifications");
      return false;
   }
   if ((payload.resource == "messages") && (payload.event == "updated")) {
      debug("event 'updated' is not expected for 'messages' resource");
      return false;
   }
   if ((payload.resource == "rooms") && (payload.event == "deleted")) {
      debug("event 'deleted' is not expected for 'rooms' resource");
      return false;
   }
   if ((payload.resource == "attachmentActions") && (payload.event == "updated")) {
      debug("event 'updated' is not expected for 'attachmentActions' resource");
      return false;
   }
   if ((payload.resource == "attachmentActions") && (payload.event == "deleted")) {
      debug("event 'deleted' is not expected for 'attachmentActions' resource");
      return false;
   }

   return true;
};



//  Returns a message if the payload complies with the documentation, undefined otherwise
//  see https://developer.webex.com/endpoint-messages-messageId-get.html for more information
//   {
//   	"id" : "46ef3f0a-e810-460c-ad37-c161adb48195",
//   	"personId" : "49465565-f6db-432f-ab41-34b15f544a36",
//   	"personEmail" : "matt@example.com",
//   	"roomId" : "24aaa2aa-3dcc-11e5-a152-fe34819cdc9a",
//   	"text" : "PROJECT UPDATE - A new project project plan has been published on Box",
//   	"files" : [ "http://www.example.com/images/media.png" ],
//   	"toPersonId" : "Y2lzY29zcGFyazovL3VzL1BFT1BMRS9mMDZkNzFhNS0wODMzLTRmYTUtYTcyYS1jYzg5YjI1ZWVlMmX",
//   	"toPersonEmail" : "julie@example.com",
//   	"created" : "2015-10-18T14:26:16+00:00"
//   }
function checkMessageDetails(payload) {
   if (!payload
      || !payload.id
      || !payload.personId
      || !payload.personEmail
      // As of July 2016, Message Details has been enriched with the Room type,
      // note that Outgoing integrations do not receive the Room type property yet.
      || !payload.roomType
      || !payload.roomId
      || !payload.created) {
      debug("message structure is not compliant: missing property");
      return false;
   }
   if (!payload.text && !payload.files) {
      debug("message structure is not compliant: no text nor file in there");
      return false;
   }
   return true;
}


// Reads message text by requesting Webex Teams API as webhooks only receives message identifiers
Utils.readMessage = function (messageId, token, cb) {
   if (!messageId || !token) {
      debug("undefined messageId or token, cannot read message details");
      cb(new Error("undefined messageId or token, cannot read message details"), null);
      return;
   }

   // Retreive text for message id
   fine("requesting message details for id: " + messageId);

   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      },
      json: true
   });

   const resource = '/messages/' + messageId;
   (async () => {
      try {
         const response = await client.get(resource);
         fine(`GET ${resource} received a: ${response.statusCode}`);

         switch (response.statusCode) {
            case 200:
               break; // we're good, let's continue

            case 401:
               debug("error 401, invalid token");
               debug("? Did you picked a valid access token, worth checking this");
               cb(new Error("Could not fetch message details, statusCode: " + response.statusCode), null);
               return;

            case 404:
               // happens when the message details cannot be accessed, either because no message exists for the specified id,
               // or because the webhook was created with an access token different from the bot (which then can see the events triggered but not decrypt sensitive contents)
               debug("error 404, could not find the message with id: " + messageId);
               debug("? Did you create the Webhook with the same token you configured this bot with ? If so, message may have been deleted before you got the chance to read it");
               cb(new Error("Could not fetch message details, statusCode: " + response.statusCode), null);
               return;

            default:
               debug("error " + response.statusCode + ", could not retreive message details with id: " + messageId);
               cb(new Error("Could not fetch message details, statusCode: " + response.statusCode), null);
               return;
         }

         // Robustify
         const message = response.body;
         if (!checkMessageDetails(message)) {
            debug("unexpected message format");
            cb(new Error("unexpected message format while retreiving message id: " + messageId), null);
            return;
         }

         fine("pushing message details to callback function");
         cb(null, message);

      } catch (error) {
         fine(`error in ${resource}, code: ${error.code}`)
         debug("error while retreiving message details with id: " + messageId + ", error: " + error.message);
         cb(new Error("error while retreiving message"), null);
      }
   })();
}

// Returns true if the request has been signed with the specified secret
// see Webex Teams API to authenticate requests : https://developer.webex.com/webhooks-explained.html#auth
Utils.checkSignature = function (secret, req) {
   var signature = req.headers["x-spark-signature"];
   if (!signature) {
      fine("header X-Spark-Signature not found");
      return false;
   }

   // compute HMAC_SHA1 signature
   var computed = crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('hex');

   // check signature
   if (signature != computed) {
      fine("signatures do not match");
      return false;
   }

   return true;
}


//  Returns an attachmentActions if the payload complies with the documentation, undefined otherwise
//  see https://developer.webex.com/docs/api/v1/attachment-actions/get-attachment-action-details for more information
// {
//    "id": "Y2lzY29zcGFyazovL3VzL0NBTExTLzU0MUFFMzBFLUUyQzUtNERENi04NTM4LTgzOTRDODYzM0I3MQo",
//    "personId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS83MTZlOWQxYy1jYTQ0LTRmZ",
//    "roomId": "L3VzL1BFT1BMRS80MDNlZmUwNy02Yzc3LTQyY2UtOWI",
//    "type": "submit",
//    "messageId": "GFyazovL3VzL1BFT1BMRS80MDNlZmUwNy02Yzc3LTQyY2UtOWI4NC",
//    "inputs": {
//       "Name": "John Andersen",
//     "Url": "https://example.com",
//       "Email": "john.andersen@example.com",
//     "Tel": "+1 408 526 7209"
//    },
//    "created": "2016-05-10T19:41:00.100Z"
// }
function checkAttachmentActionsDetails(payload) {
   if (!payload || !payload.id
      || !payload.personId
      || !payload.roomId
      || !payload.type
      || !payload.messageId
      || !payload.inputs
      || !payload.created) {
      debug("attachmentActions structure is not compliant: missing property");
      return false;
   }
   if (Object.keys(payload.inputs).length == 0) {
      debug("attachmentActions structure is not compliant: no inputs");
      return false;
   }
   return true;
}


// Reads submitted data by requesting Webex Teams API as webhooks only receives attachmentActions identifiers
Utils.readAttachmentActions = function (attachmentActionsId, token, cb) {
   if (!attachmentActionsId || !token) {
      debug("undefined attachmentActionsId or token, cannot read message details");
      cb(new Error("undefined attachmentActionsId or token, cannot read message details"), null);
      return;
   }

   // Retreive contents for attachmentActions
   fine("requesting attachmentActions details for id: " + attachmentActionsId);
   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      },
      json: true
   });

   const resource = '/attachment/actions/' + attachmentActionsId;
   (async () => {
      try {
         const response = await client.get(resource);
         fine(`GET ${resource} received a: ${response.statusCode}`);

         switch (response.statusCode) {
            case 200:
               break; // we're good, let's continue

            case 401:
               debug("error 401, invalid token");
               debug("? Did you picked a valid access token, worth checking this");
               cb(new Error("Could not fetch attachmentActions details, statusCode: " + response.statusCode), null);
               return;

            case 404:
               // happens when the attachmentActions details cannot be accessed, either because no attachmentActions exists for the specified id,
               // or because the webhook was created with an access token different from the bot (which then can see the events triggered but not decrypt sensitive contents)
               debug("error 404, could not find the attachmentActions with id: " + attachmentActionsId);
               debug("? Did you create the Webhook with the same token you configured this bot with ? If so, message may have been deleted before you got the chance to read it");
               cb(new Error("Could not fetch attachmentActions details, statusCode: " + response.statusCode), null);
               return;

            default:
               debug("error " + response.statusCode + ", could not retreive attachmentActions details with id: " + attachmentActionsId);
               cb(new Error("Could not fetch attachmentActions details, statusCode: " + response.statusCode), null);
               return;
         }

         // Robustify
         fine("parsing JSON");
         const attachmentActions = response.body; 
         if (!checkAttachmentActionsDetails(attachmentActions)) {
            debug("unexpected attachmentActions format");
            cb(new Error("unexpected format while retreiving attachmentActions id: " + attachmentActionsId), null);
            return;
         }

         fine("pushing attachmentActions details to callback function");
         cb(null, attachmentActions);

      } catch (error) {
         fine(`error in ${resource}, code: ${error.code}`)
         debug("error while retreiving attachmentActions details with id: " + attachmentActionsId + ", error: " + error);
         cb(new Error("error while retreiving attachmentActions"), null);
      }
   })();
}


// Returns true if the request has been signed with the specified secret
// see Webex Teams API to authenticate requests : https://developer.webex.com/webhooks-explained.html#auth
Utils.checkSignature = function (secret, req) {
   var signature = req.headers["x-spark-signature"];
   if (!signature) {
      fine("header X-Spark-Signature not found");
      return false;
   }

   // compute HMAC_SHA1 signature
   var computed = crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('hex');

   // check signature
   if (signature != computed) {
      fine("signatures do not match");
      return false;
   }

   return true;
}
