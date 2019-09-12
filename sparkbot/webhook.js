//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

var express = require("express");
var app = express();
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var debug = require("debug")("sparkbot");
var fine = require("debug")("sparkbot:fine");

var Utils = require("./utils");
var CommandInterpreter = require("./interpreter");
var CommandRouter = require("./router");
var Registration = require("./registration");


/* Creates a Webex Teams webhook with specified configuration structure: 
 *  
 *  { 
 * 		port,				// int: local port on which the webhook is accessible
 * 		path,				// string: path to which new webhook POST events are expected
 * 		token,				// string: Webex Teams API access token
 * 		secret,				// string: (optional) webhook secret used to sign payloads
 * 		softSecretCheck,	// boolean: does not aborts payload processing if the payload signature check fails
 *		trimMention			// boolean: filters out mentions if token owner is a bot
 * 		ignoreSelf			// boolean: ignores message created by token owner
 *  }
 *  
 * If no configuration is specified, the defaults below apply: 
 *  { 
 *		port				: process.env.PORT || 8080,
 *		path				: process.env.WEBHOOK_PATH || "/" ,
 *		token				: process.env.ACCESS_TOKEN,
 *		secret				: process.env.WEBHOOK_SECRET,
 *		softSecretCheck		: will default to false if a secret is defined,
 *		trimMention			: will default to true,
 *		commandPrefix		: process.env.COMMAND_PREFIX || "/",
 *		ignoreSelf			: will default to true if a bot is used, and false otherwise
 *  }
 * 
 */
function Webhook(config) {
   // Inject defaults if no configuration specified
   if (!config) {
      debug("webhook instantiated with default configuration");
      config = {
         // [WORKAROUND] in some container situation (ie, Cisco Shipped), we need to use an OVERRIDE_PORT to force our bot to start and listen to the port defined in the Dockerfile (ie, EXPOSE), 
         // and not the PORT dynamically assigned by the host or scheduler.
         port: process.env.OVERRIDE_PORT || process.env.PORT,
         path: process.env.WEBHOOK_PATH,
         // [COMPAT] SPARK_TOKEN deprecated but still supported
         token: process.env.ACCESS_TOKEN || process.env.SPARK_TOKEN,
         secret: process.env.WEBHOOK_SECRET,
         commandPrefix: process.env.COMMAND_PREFIX || "/"
      };
   }

   // Robustify: it is usually safer not to read ourselves, especially if no commandPrefix is specified
   if (!config.ignoreSelf && !config.commandPrefix) {
      debug("WARNING: configuration does not prevent for reading from yourself => possible infinite loop, continuing...");
   }

   // Abort if mandatory config parameters are not present
   if (!config.port) {
      fine("no port specified, applying default");
      config.port = 8080;
   }
   if (!config.path) {
      fine("no path specified, applying default");
      config.path = "/";
   }

   // If an access token is specified, create a command interpreter
   if (!config.token) {
      debug("no access token specified, will not fetch message contents and room titles, nor interpret commands");
   }
   this.token = config.token;

   // Apply secret if specified
   if (config.secret) {
      this.secret = config.secret;
      // Defaults to false when a secret is specified
      if (!config.softSecretCheck) {
         this.softSecretCheck = false;
      }
   }
   if (config.softSecretCheck) {
      this.softSecretCheck = config.softSecretCheck;
   }


   // Webhook listeners
   this.listeners = {};
   var self = this;
   function fire(trigger) {
      // Retreive listener for incoming event
      var entry = trigger.resource + "/" + trigger.event;
      var listener = self.listeners[entry];
      if (!listener) {
         debug("no listener found for resource/event: " + entry);
         return;
      }

      // Invoke listener
      debug("calling listener for resource/event: " + entry + ", with data context: " + trigger.data.id);
      listener(trigger);
   }

   // Initialize command processors
   this.interpreter = new CommandInterpreter(config);
   this.router = new CommandRouter(this);

   // Webhook API routes
   started = Date.now();
   app.route(config.path)
      .get(function (req, res) {
         debug("healthcheck hitted");
         var package = require("../package.json");
         res.json({
            message: "Congrats, your bot is up and running",
            since: new Date(started).toISOString(),
            framework: package.name + ", " + package.version,
            tip: "Don't forget to create WebHooks to start receiving events from Webex: https://developer.webex.com/endpoint-webhooks-post.html",
            webhook: {
               secret: (self.secret != null),
               softSecretCheck: self.softSecretCheck,
               listeners: Object.keys(self.listeners),
            },
            token: (self.token != null),
            account: {
               type: self.interpreter.accountType,
               nickName: self.interpreter.nickName,
               person: self.interpreter.person
            },
            interpreter: {
               prefix: self.interpreter.prefix,
               trimMention: self.interpreter.trimMention,
               ignoreSelf: self.interpreter.ignoreSelf
            },
            commands: Object.keys(self.router.commands)
         });
      })
      .post(function (req, res) {
         debug("webhook invoked");

         // analyse incoming payload, should conform to Webex Teams webhook specifications
         if (!req.body || !Utils.checkWebhookEvent(req.body)) {
            debug("unexpected payload POSTed, aborting...");
            res.status(400).json({
               message: "Bad payload for Webhook",
               details: "either the bot is misconfigured or Webex is running a new API version"
            });
            return;
         }

         // event is ready to be processed, let's send a response to Webex without waiting any longer
         res.status(200).json({ message: "notification received and being processed by webhook" });

         // process HMAC-SHA1 signature if a secret has been specified
         // [NOTE@ for security reasons, we check the secret AFTER responding to Webex
         if (self.secret) {
            if (!Utils.checkSignature(self.secret, req)) {
               if (!self.softSecretCheck) {
                  debug("HMAC-SHA1 signature does not match secret, aborting payload processing");
                  return;
               }
               else {
                  fine("HMAC-SHA1 signature does not match secret, continuing....");
               }
            }
            fine("signature check ok, continuing...")
         }

         // process incoming resource/event, see https://developer.webex.com/webhooks-explained.html
         fire(req.body);
      });

   // Start bot
   app.listen(config.port, function () {
      debug("bot started on port: " + config.port);
   }).on('error', (err) => {
      console.log(`cannot launch bot, err: ${err.message}`);
      console.log("existing...")
      process.exit(1);
   });
}


// Registers a listener for new (resource, event) POSTed to our webhook   
Webhook.prototype.onEvent = function (resource, event, listener) {
   if (!listener) {
      debug("on: listener registration error. Please specify a listener for resource/event");
      return;
   }
   // check (resource, event) conforms to Webhook specifications, see https://developer.webex.com/webhooks-explained.html 
   if (!resource || !event) {
      debug("on: listener registration error. please specify a resource/event for listener");
      return;
   }

   switch (resource) {
      case "all":
         if (event != "all") {
            debug("on: listener registration error. Bad configuration: only 'all' events is suported for 'all' resources");
            debug("WARNING: listener not registered for resource/event: " + resource + "/" + event);
            return;
         }

         addAttachmentActionsCreatedListener(this, listener);
         addMessagesCreatedListener(this, listener);
         addMessagesDeletedListener(this, listener);
         addRoomsCreatedListener(this, listener);
         addRoomsUpdatedListener(this, listener);
         addMembershipsCreatedListener(this, listener);
         addMembershipsUpdatedListener(this, listener);
         addMembershipsDeletedListener(this, listener);
         return;

      case "attachmentActions":
         if (event == "all") {
            addAttachmentActionsCreatedListener(this, listener);
            return;
         }
         if (event == "created") {
            addAttachmentActionsCreatedListener(this, listener);
            return;
         }
         break;

      case "messages":
         if (event == "all") {
            addMessagesCreatedListener(this, listener);
            addMessagesDeletedListener(this, listener);
            return;
         }
         if (event == "created") {
            addMessagesCreatedListener(this, listener);
            return;
         }
         if (event == "deleted") {
            addMessagesDeletedListener(this, listener);
            return;
         };
         break;

      case "memberships":
         if (event == "all") {
            addMembershipsCreatedListener(this, listener);
            addMembershipsUpdatedListener(this, listener);
            addMembershipsDeletedListener(this, listener);
            return;
         }
         if (event == "created") {
            addMembershipsCreatedListener(this, listener);
            return;
         }
         if (event == "updated") {
            addMembershipsUpdatedListener(this, listener);
            return;
         };
         if (event == "deleted") {
            addMembershipsDeletedListener(this, listener);
            return;
         };
         break;

      case "rooms":
         if (event == "all") {
            addRoomsCreatedListener(this, listener);
            addRoomsUpdatedListener(this, listener);
            return;
         }
         if (event == "created") {
            addRoomsCreatedListener(this, listener);
            return;
         }
         if (event == "updated") {
            addRoomsUpdatedListener(this, listener);
            return;
         };
         break;

      default:
         break;
   }

   debug("on: listener registration error, bad configuration. Resource: '" + resource + "' and event: '" + event + "' do not comply with Webex Teams webhook specifications.");
}


// Helper function to retreive message details from a (messages/created) Webhook trigger.
// Expected callback function signature (err, message).
Webhook.prototype.decryptMessage = function (trigger, cb) {
   if (!this.token) {
      debug("no access token configured, cannot read message details.")
      cb(new Error("no access token configured, cannot decrypt message"), null);
      return;
   }

   Utils.readMessage(trigger.data.id, this.token, cb);
}


// Utility function to be notified only as new messages are posted into spaces against which your Webhook has registered to.
// The callback function will directly receive the message contents : combines .on('messages', 'created', ...) and .decryptMessage(...).
// Expects a callback function with signature (err, trigger, message).
// Returns true or false whether registration was successful
Webhook.prototype.onMessage = function (cb) {

   // check args
   if (!cb) {
      debug("no callback function, aborting callback registration...")
      return false;
   }

   // Abort if webhook cannot request Webex for messages details
   var token = this.token;
   if (!token) {
      debug("no access token specified, will not read message details, aborting callback registration...")
      return false;
   }

   addMessagesCreatedListener(this, function (trigger) {
      Utils.readMessage(trigger.data.id, token, function (err, message) {
         if (err) {
            debug("could not fetch message details, err: " + JSON.stringify(err) + ", listener not fired...");
            //cb (err, trigger, null);
            return;
         }

         // Fire listener
         cb(trigger, message);
      });
   });

   return true;
}


// Transforms a message into a Command structure
Webhook.prototype.asCommand = function (message) {
   if (!message) {
      debug("no message to interpret, aborting...")
      return null;
   }

   return this.interpreter.extract(message);
}



// Shortcut to be notified only as new commands are posted into spaces your Webhook has registered against.
// The callback function will directly receive the message contents : combines .on('messages', 'created', ...)  .decryptMessage(...) and .extractCommand(...).
// The expected callback function signature is: function(err, command).
// Note that you may register a "fallback" listener by registering the "fallback" command
Webhook.prototype.onCommand = function (command, cb) {
   if (!command || !cb) {
      debug("wrong arguments for .onCommand, aborting...")
      return;
   }

   this.router.addCommand(command, cb);
}


// Utility function to be notified only as new cards are submitted
// The callback function will directly receive the submitted data contents : combines .on('attachmentActions', 'created', ...) and .decryptMessage(...).
// Expects a callback function with signature (err, trigger, submission).
// Returns true or false whether registration was successful
Webhook.prototype.onCardSubmission = function (cb) {

   // check args
   if (!cb) {
      debug("no callback function, aborting callback registration...")
      return false;
   }

   // Abort if webhook cannot request Webex for messages details
   var token = this.token;
   if (!token) {
      debug("no access token specified, will not be able to read submitted details, aborting callback registration...")
      return false;
   }

   addAttachmentActionsCreatedListener(this, function (trigger) {
      Utils.readAttachmentActions(trigger.data.id, token, function (err, attachmentActions) {
         if (err) {
            debug("could not fetch attachmentActions details, err: " + JSON.stringify(err) + ", listener not fired...");
            //cb (err, trigger, null);
            return;
         }

         // Fire listener
         cb(trigger, attachmentActions);
      });
   });

   return true;
}


// Creates or updates a webhook to Webex
// returns the webhook created or updated
// see https://developer.webex.com/endpoint-webhooks-post.html for arguments
Webhook.prototype.createOrUpdateWebhook = function (name, targetUrl, resource, event, filter, secret, cb) {
   if (!name || !targetUrl) {
      debug("bad arguments for createOrUpdateWebhook, aborting webhook creation...")
      if (cb) cb(new Error("bad arguments for createOrUpdateWebhook"), null);
      return;
   }

   if (!resource) {
      resource = "all";
      event = "all";
   }
   if (!event) {
      event = "all";
   }

   // Check if a webhook already exists with the same name
   var token = this.token;
   Registration.listWebhooks(token, function (err, webhooks) {
      if (err) {
         debug("could not retreive webhooks, aborting webhook creation or update...");
         if (cb) cb(new Error("could not retreive the list of webhooks, check your token"), null);
         return;
      }

      var webhook = null;
      webhooks.forEach(function (elem) {
         if (elem.name === name) {
            webhook = elem;
         }
      });

      // if found, check if webhook is different
      if (webhook) {
         var identical = compareWebhooks(webhook, name, targetUrl, resource, event, filter, secret);
         if (identical) {
            debug("webhook already exists with same properties, no creation needed");
            if (cb) cb(null, webhook);
            return;
         }

         // delete the webhook that pre-exists
         Registration.deleteWebhook(token, webhook.id, function (err, code) {
            if (err != null) {
               debug("could not delete existing webhook")
               if (cb) cb(new Error('webhook with same name already exists and could not be updated'), null);
               return;
            }

            Registration.createWebhook(token, name, targetUrl, resource, event, filter, secret, function (err, webhook) {
               if (err != null) {
                  debug("could not create webhook")
                  if (cb) cb(new Error('could NOT create webhook'), null);
                  return;
               }

               fine("webhook successfully updated");
               if (cb) cb(null, webhook);
               return;
            });
         });
      }

      // create Webhook
      else {
         Registration.createWebhook(token, name, targetUrl, resource, event, filter, secret, function (err, webhook) {
            if (err != null) {
               debug("could not create webhook")
               if (cb) cb(new Error('could NOT create webhook'), null);
               return;
            }

            fine("webhook successfully created");
            if (cb) cb(null, webhook);
            return;
         });
      }
   });
}


module.exports = Webhook


//
// Internals
//

function addAttachmentActionsCreatedListener(webhook, listener) {
   webhook.listeners["attachmentActions/created"] = listener;
   fine("addAttachmentActionsCreatedListener: listener registered");
}

function addMessagesCreatedListener(webhook, listener) {
   webhook.listeners["messages/created"] = listener;
   fine("addMessagesCreatedListener: listener registered");
}

function addMessagesDeletedListener(webhook, listener) {
   webhook.listeners["messages/deleted"] = listener;
   fine("addMessagesDeletedListener: listener registered");
}

function addRoomsCreatedListener(webhook, listener) {
   webhook.listeners["rooms/created"] = listener;
   fine("addRoomsCreatedListener: listener registered");
}

function addRoomsUpdatedListener(webhook, listener) {
   webhook.listeners["rooms/updated"] = listener;
   fine("addRoomsUpdatedListener: listener registered");
}

function addMembershipsCreatedListener(webhook, listener) {
   webhook.listeners["memberships/created"] = listener;
   fine("addMembershipsCreatedListener: listener registered");
}

function addMembershipsUpdatedListener(webhook, listener) {
   webhook.listeners["memberships/updated"] = listener;
   fine("addMembershipsUpdatedListener: listener registered");
}

function addMembershipsDeletedListener(webhook, listener) {
   webhook.listeners["memberships/deleted"] = listener;
   fine("addMembershipsDeletedListener: listener registered");
}

// returns true if webhooks are identical
function compareWebhooks(webhook, name, targetUrl, resource, event, filter, secret) {
   if ((webhook.name !== name)
      || (webhook.targetUrl !== targetUrl)
      || (webhook.resource !== resource)
      || (webhook.event !== event)) {
      return false;
   }

   // they look pretty identifty, let's check optional fields
   if (filter) {
      if (filter !== webhook.filter) {
         fine("webhook look pretty similar BUT filter is different");
         return false;
      }
   }
   else {
      if (webhook.filter) {
         fine("webhook look pretty similar BUT filter is different");
         return false;
      }
   }

   if (secret) {
      if (secret !== webhook.secret) {
         fine("webhook look pretty similar BUT secret is different");
         return false;
      }
   }
   else {
      if (webhook.secret) {
         fine("webhook look pretty similar BUT secret is different");
         return false;
      }
   }
   return true;
}



